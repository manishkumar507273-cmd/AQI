// Vercel Serverless Function: emails an approved dataset CSV to the requester.
// Runs on Vercel alongside the static frontend, so no separate backend hosting is needed.
//
// Required Vercel Environment Variables:
//   SMTP_USER      - Gmail address used to send
//   SMTP_PASSWORD  - 16-char Google App Password
// Optional:
//   SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 587), SENDER_NAME
//   SUPABASE_URL, SUPABASE_KEY, FIREBASE_DATABASE_URL (defaults match the frontend config)

import nodemailer from 'nodemailer';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://sgkdpliqlhgiqsabxzxe.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNna2RwbGlxbGhnaXFzYWJ4enhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzgzMTIsImV4cCI6MjEwMDQ1NDMxMn0.vMtbXomFdmOcBkhhSoiyYyp_vFxOhg4MYCFCw9-pL30';
const FIREBASE_DB_URL = (process.env.FIREBASE_DATABASE_URL || 'https://smart-air-net-default-rtdb.firebaseio.com').replace(/\/$/, '');

const pad = (n) => String(n).padStart(2, '0');

// Converts a timestamp to IST date/time strings, mirroring parseToIstIso in the frontend.
const toIstParts = (tsRaw) => {
  if (!tsRaw) return ['', ''];
  const ts = String(tsRaw).trim();
  let y, mo, d, h, mi;
  if (ts.includes('+00:00') || ts.endsWith('Z')) {
    const dt = new Date(new Date(ts).getTime() + 5.5 * 3600 * 1000);
    if (isNaN(dt.getTime())) return [ts, ''];
    y = dt.getUTCFullYear(); mo = dt.getUTCMonth() + 1; d = dt.getUTCDate();
    h = dt.getUTCHours(); mi = dt.getUTCMinutes();
  } else {
    const m = ts.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (!m) return [ts, ''];
    [y, mo, d, h, mi] = m.slice(1).map(Number);
  }
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return [`${pad(d)}-${pad(mo)}-${y}`, `${h12}:${pad(mi)}${ampm}`];
};

const num = (v, digits) => (v != null && v !== '' && !isNaN(Number(v)) ? Number(v).toFixed(digits) : '');

const fetchRows = async (category, year, month) => {
  const table = category === 'aqi' ? 'AQI_NODE1' : 'WEATHER_NODE1';
  let start = `${year}-01-01T00:00:00`;
  let end = `${year + 1}-01-01T00:00:00`;
  if (month) {
    start = `${year}-${pad(month)}-01T00:00:00`;
    end = month === 12 ? `${year + 1}-01-01T00:00:00` : `${year}-${pad(month + 1)}-01T00:00:00`;
  }
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const rows = [];
  const batch = 1000;
  for (let offset = 0; ; offset += batch) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?timestamp_hour=gte.${start}&timestamp_hour=lt.${end}` +
      `&order=timestamp_hour.asc&limit=${batch}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Supabase query failed (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    rows.push(...data);
    if (data.length < batch) break;
  }
  return rows;
};

const buildCsv = (category, rows) => {
  let header;
  let lines;
  if (category === 'aqi') {
    header = ['Date', 'Time', 'AQI', 'Temperature (°C)', 'Humidity (%)', 'PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'CO (mg/m³)', 'NO2 (µg/m³)', 'O3 (µg/m³)'];
    lines = rows.map((r) => {
      const [dStr, tStr] = toIstParts(r.timestamp_hour || r.created_at);
      return [
        dStr, tStr,
        r.cpcb_aqi != null && !isNaN(Number(r.cpcb_aqi)) ? Math.round(Number(r.cpcb_aqi)) : '',
        num(r.temperature, 1), num(r.humidity, 1),
        num(r['pm2.5'] ?? r.pm25, 3), num(r.pm10, 3), num(r.co, 3), num(r.no2, 3), num(r.o3, 3)
      ];
    });
  } else {
    header = ['Date', 'Time', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (km/h)', 'Wind Gust (km/h)', 'Wind Direction', 'Rain Gauge (mm)'];
    lines = rows.map((r) => {
      const [dStr, tStr] = toIstParts(r.timestamp_hour || r.created_at);
      return [
        dStr, tStr,
        num(r.temperature, 1), num(r.humidity, 1),
        num(r.wind_speed, 3), num(r.wind_gust ?? r.gust, 3),
        r.wind_direction != null ? `"${String(r.wind_direction).replace(/"/g, '""')}"` : '',
        num(r.rain_gauge ?? r.rain, 3)
      ];
    });
  }
  // BOM so Excel renders °/µ/³ correctly
  return '\uFEFF' + [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
};

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ email_sent: false, message: 'Method not allowed' });
  }

  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) {
    return res.status(200).json({
      email_sent: false,
      requires_smtp_config: true,
      message: 'SMTP_USER and SMTP_PASSWORD are not set in Vercel Environment Variables.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { requestId, idToken } = body;
    const category = body.category === 'weather' ? 'weather' : 'aqi';
    const year = parseInt(body.year, 10) || new Date().getFullYear();
    const month = body.month ? parseInt(body.month, 10) : null;

    if (!requestId || !/^[A-Za-z0-9_-]+$/.test(requestId)) {
      return res.status(400).json({ email_sent: false, message: 'Missing or invalid requestId.' });
    }

    // Verify the request exists in Firebase (using the admin's ID token) and take the
    // recipient from the stored record, so this endpoint can't be used to email arbitrary addresses.
    const authQs = idToken ? `?auth=${encodeURIComponent(idToken)}` : '';
    const fbRes = await fetch(`${FIREBASE_DB_URL}/data_requests/${requestId}.json${authQs}`);
    if (!fbRes.ok) {
      return res.status(403).json({ email_sent: false, message: `Could not verify request (${fbRes.status}).` });
    }
    const record = await fbRes.json();
    if (!record || !record.email) {
      return res.status(404).json({ email_sent: false, message: 'Dataset request not found.' });
    }

    const rows = await fetchRows(category, year, month);
    if (rows.length === 0) {
      return res.status(200).json({ email_sent: false, message: `No ${category.toUpperCase()} records exist for this period.` });
    }

    const csv = buildCsv(category, rows);
    const monthPart = month ? `_${pad(month)}` : '_Full_Year';
    const filename = `${category === 'aqi' ? 'AQI' : 'Weather'}_Historical_Dataset_${year}${monthPart}.csv`;
    const name = escapeHtml((record.name || 'Researcher').trim());
    const datasetName = escapeHtml(record.dataset || 'Atmospheric Dataset');
    const purpose = record.purpose ? escapeHtml(record.purpose) : '';

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user, pass }
    });

    await transporter.sendMail({
      from: `"${process.env.SENDER_NAME || 'WeatherNet Data Portal'}" <${user}>`,
      to: record.email,
      subject: `Your Requested Dataset: ${record.dataset || 'Atmospheric Dataset'} is Approved`,
      text: `Hello ${record.name || 'Researcher'},\n\nYour dataset request has been approved.\n\n` +
        `Dataset: ${record.dataset || ''}\nTotal Records: ${rows.length} hourly data points\nFilename: ${filename}\n\n` +
        `The CSV file is attached.\n\nSmart WeatherNet Node 1 Telemetry Platform`,
      html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
          <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 24px;text-align:center">
            <h1 style="margin:0 0 6px;font-size:22px;color:#00bfa5">Dataset Request Approved</h1>
            <p style="margin:0;font-size:14px;color:#94a3b8">Smart WeatherNet Atmospheric Telemetry Portal</p>
          </div>
          <div style="padding:24px">
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your request for environmental telemetry data has been reviewed and approved.</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:18px 0;font-size:14px;line-height:1.6">
              <div><strong>Dataset:</strong> ${datasetName}</div>
              <div><strong>Total Records:</strong> ${rows.length} hourly data points</div>
              ${purpose ? `<div><strong>Stated Purpose:</strong> ${purpose}</div>` : ''}
            </div>
            <p>The dataset is attached as <code>${filename}</code>.</p>
          </div>
          <div style="text-align:center;font-size:12px;color:#94a3b8;padding:18px 24px;border-top:1px solid #f1f5f9">
            Smart WeatherNet Node 1 Telemetry Platform &bull; Automated Data Delivery
          </div>
        </div>
      </div>`,
      attachments: [{ filename, content: csv, contentType: 'text/csv; charset=utf-8' }]
    });

    return res.status(200).json({
      email_sent: true,
      filename,
      rows: rows.length,
      message: `Successfully sent dataset CSV to ${record.email}`
    });
  } catch (err) {
    console.error('send-dataset-email error:', err);
    return res.status(500).json({ email_sent: false, message: `Email delivery failed: ${err.message}` });
  }
}
