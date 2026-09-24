import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api` 
  : '/api';

const DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNna2RwbGlxbGhnaXFzYWJ4enhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzgzMTIsImV4cCI6MjEwMDQ1NDMxMn0.vMtbXomFdmOcBkhhSoiyYyp_vFxOhg4MYCFCw9-pL30";

let rawUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sgkdpliqlhgiqsabxzxe.supabase.co';
const supabaseBaseUrl = rawUrl.includes('/rest/v1') ? rawUrl.split('/rest/v1')[0] : rawUrl.replace(/\/$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_KEY;

// Table definitions as requested:
// 1st: AQI_LIVE_NODE1 (Live AQI)
// 2nd: AQI_NODE1 (Historical AQI)
// 3rd: WEATHER_LIVE_NODE1 (Live Weather)
// 4th: WEATHER_NODE1 (Historical Weather)
const TABLE_AQI_LIVE = 'AQI_LIVE_NODE1';
const TABLE_AQI_HISTORICAL = 'AQI_NODE1';
const TABLE_WEATHER_LIVE = 'WEATHER_LIVE_NODE1';
const TABLE_WEATHER_HISTORICAL = 'WEATHER_NODE1';

const getTableRestUrl = (tableName) => `${supabaseBaseUrl}/rest/v1/${tableName}`;

const api = axios.create({
  baseURL,
  timeout: 45000,
});

// ==============================================================================
// ENHANCED MODEL & SENSOR CALIBRATOR WEIGHTS (from aqi_model_and_calibrators)
// ==============================================================================
const CPCB_BREAKPOINTS = {
  pm25: [
    [0.0, 30.0, 0, 50],
    [30.0, 60.0, 51, 100],
    [60.0, 90.0, 101, 200],
    [90.0, 120.0, 201, 300],
    [120.0, 250.0, 301, 400],
    [250.0, 500.0, 401, 500],
  ],
  pm10: [
    [0.0, 50.0, 0, 50],
    [50.0, 100.0, 51, 100],
    [100.0, 250.0, 101, 200],
    [250.0, 350.0, 201, 300],
    [350.0, 430.0, 301, 400],
    [430.0, 600.0, 401, 500],
  ],
  co: [
    [0.0, 1.0, 0, 50],
    [1.0, 2.0, 51, 100],
    [2.0, 10.0, 101, 200],
    [10.0, 17.0, 201, 300],
    [17.0, 34.0, 301, 400],
    [34.0, 50.0, 401, 500],
  ],
  no2: [
    [0.0, 40.0, 0, 50],
    [40.0, 80.0, 51, 100],
    [80.0, 180.0, 101, 200],
    [180.0, 280.0, 201, 300],
    [280.0, 400.0, 301, 400],
    [400.0, 500.0, 401, 500],
  ],
  o3: [
    [0.0, 50.0, 0, 50],
    [50.0, 100.0, 51, 100],
    [100.0, 168.0, 101, 200],
    [168.0, 208.0, 201, 300],
    [208.0, 748.0, 301, 400],
    [748.0, 1000.0, 401, 500],
  ],
};

const calcSubindex = (paramKey, cp) => {
  if (cp == null || !CPCB_BREAKPOINTS[paramKey]) return 0.0;
  const val = Math.max(0.0, Number(cp));
  const tiers = CPCB_BREAKPOINTS[paramKey];
  for (const [c_lo, c_hi, i_lo, i_hi] of tiers) {
    if (val <= c_hi) {
      return Number((((i_hi - i_lo) / (c_hi - c_lo)) * (val - c_lo) + i_lo).toFixed(3));
    }
  }
  const [c_lo, c_hi, i_lo, i_hi] = tiers[tiers.length - 1];
  return Math.min(500.0, Number((((i_hi - i_lo) / (c_hi - c_lo)) * (val - c_lo) + i_lo).toFixed(3)));
};

// Invalidate stale local caches completely so only new model predictions render
try {
  const v = localStorage.getItem('CALIBRATOR_CACHE_VERSION');
  if (v !== '3.2.0') {
    localStorage.removeItem('CACHE_AQI_NODE1_FORECAST_24H');
    localStorage.removeItem('CACHE_AQI_LSTM_FORECAST_24H');
    localStorage.removeItem('CACHE_CLOUD_LATEST');
    localStorage.removeItem('CACHE_AQI_LIVE_HISTORY');
    localStorage.removeItem('CACHE_AQI_HISTORICAL');
    localStorage.removeItem('CACHE_AQI_COMPARISON');
    localStorage.removeItem('CACHE_AQI_FORECAST_REGISTRY');
    localStorage.removeItem('FORECAST_PREDICTIONS_REGISTRY');
    localStorage.setItem('CALIBRATOR_CACHE_VERSION', '3.2.0');
  }
} catch (e) {}

const formatRawReading = (raw) => {
  if (!raw) return null;

  const rawTemp = raw.temperature;
  const rawHum = raw.humidity;
  const tempVal = rawTemp != null ? Number(rawTemp) : 27.0;
  const humVal = rawHum != null ? Number(rawHum) : 60.0;

  const rawPm25 = raw.pm25 != null ? Number(raw.pm25) : (raw['pm2.5'] != null ? Number(raw['pm2.5']) : null);
  const rawPm10 = raw.pm10 != null ? Number(raw.pm10) : null;
  const rawCo = raw.co != null ? Number(raw.co) : null;
  const rawO3 = raw.o3 != null ? Number(raw.o3) : null;
  const rawNo2 = raw.no2 != null ? Number(raw.no2) : null;

  // Multi-parameter Ridge calibration from aqi_model_and_calibrators
  const calPm25 = rawPm25 != null
    ? Math.max(0.0, Number((0.12532894 * rawPm25 - 0.7801631 * tempVal - 0.15188749 * humVal + 41.495258).toFixed(3)))
    : null;
  const calPm10 = rawPm10 != null
    ? Math.max(0.0, Number((0.10855827 * rawPm10 - 0.6390711 * tempVal - 0.11117823 * humVal + 34.034309).toFixed(3)))
    : null;
  const calCo = rawCo != null
    ? Math.max(0.0, Number((0.24370718 * rawCo + 0.02763672 * tempVal + 0.00444147 * humVal - 0.96570843).toFixed(3)))
    : null;
  const calNo2 = rawNo2 != null
    ? Math.max(0.0, Number((0.00920961 * rawNo2 + 0.06749354 * tempVal + 0.00777269 * humVal + 2.903467).toFixed(3)))
    : null;
  const calO3 = rawO3 != null
    ? Math.max(0.0, Number((0.05187092 * rawO3 - 1.4830095 * tempVal - 0.23912878 * humVal + 91.72351).toFixed(3)))
    : null;

  const subIndices = {
    pm25: calcSubindex('pm25', calPm25 ?? rawPm25),
    pm10: calcSubindex('pm10', calPm10 ?? rawPm10),
    co: calcSubindex('co', calCo ?? rawCo),
    no2: calcSubindex('no2', calNo2 ?? rawNo2),
    o3: calcSubindex('o3', calO3 ?? rawO3),
  };

  const domKey = Object.keys(subIndices).reduce((a, b) => subIndices[a] >= subIndices[b] ? a : b);
  const domNames = { pm25: 'PM2.5', pm10: 'PM10', co: 'CO', no2: 'NO₂', o3: 'O₃' };
  const cpcb_aqi = Math.round(subIndices[domKey] || 0);

  let label = "Good", color = "#65ff50";
  if (cpcb_aqi > 50 && cpcb_aqi <= 100) { label = "Satisfactory"; color = "#a3e635"; }
  else if (cpcb_aqi > 100 && cpcb_aqi <= 200) { label = "Moderate"; color = "#facc15"; }
  else if (cpcb_aqi > 200 && cpcb_aqi <= 300) { label = "Poor"; color = "#fb923c"; }
  else if (cpcb_aqi > 300 && cpcb_aqi <= 400) { label = "Very Poor"; color = "#f87171"; }
  else if (cpcb_aqi > 400) { label = "Severe"; color = "#c084fc"; }

  return {
    id: raw.id,
    timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
    temperature: rawTemp,
    humidity: rawHum,
    pm25: calPm25 ?? rawPm25,
    pm10: calPm10 ?? rawPm10,
    co: calCo ?? rawCo,
    o3: calO3 ?? rawO3,
    no2: calNo2 ?? rawNo2,
    raw_pm25: rawPm25,
    raw_pm10: rawPm10,
    raw_co: rawCo,
    raw_o3: rawO3,
    raw_no2: rawNo2,
    is_calibrated: true,
    cpcb_aqi,
    dominant_pollutant: domNames[domKey] || 'N/A',
    dominant_pollutant_key: domKey,
    sub_indices: subIndices,
    aqi_info: { value: cpcb_aqi, label, color, standard: 'CPCB (India)' },
    wind_speed: raw.wind_speed,
    wind_gust: raw.wind_gust ?? raw.gust,
    wind_direction: raw.wind_direction,
    rain_gauge: raw.rain_gauge
  };
};

export const isSensorOnline = (timestamp, maxAgeMinutes = 5) => {
  if (!timestamp) return false;
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return false;
  const diffMs = Date.now() - dt.getTime();
  return diffMs >= 0 && diffMs <= maxAgeMinutes * 60 * 1000;
};

export const getTimeAgo = (timestamp) => {
  if (!timestamp) return 'No data';
  const dt = new Date(timestamp);
  if (isNaN(dt.getTime())) return 'Invalid date';
  const diffSec = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

export const getCachedData = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const setCachedData = (key, data) => {
  try {
    if (data) localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
};

const getNoCacheHeaders = () => ({
  'apikey': supabaseKey,
  'Authorization': `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache'
});

export const getCloudLatest = async () => {
  const cached = getCachedData('CACHE_CLOUD_LATEST');
  try {
    const headers = getNoCacheHeaders();

    // 1st Table (Live AQI): AQI_LIVE_NODE1 - strictly fetches telemetry & temperature from AQI_LIVE_NODE1
    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=1`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?limit=1`, { headers }));

    if (res.data && res.data[0]) {
      const formatted = formatRawReading(res.data[0]);
      if (formatted) {
        setCachedData('CACHE_CLOUD_LATEST', formatted);
        return { data: { status: 'success', data: formatted } };
      }
    }
  } catch (err) {
    console.warn('Direct Supabase AQI live fetch fallback to backend API:', err?.message || err);
  }

  if (cached) {
    return { data: { status: 'success', data: cached, isOffline: true } };
  }

  return api.get('/cloud/latest').catch(() => {
    return { data: { status: 'offline', data: cached } };
  });
};

export const getCloudLiveHistory = async (limit = 50) => {
  const cached = getCachedData('CACHE_AQI_LIVE_HISTORY');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?order=created_at.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_LIVE)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map(formatRawReading).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_AQI_LIVE_HISTORY', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase live history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/live-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

export const getWeatherLatest = async () => {
  const cached = getCachedData('CACHE_WEATHER_LATEST');
  try {
    const headers = getNoCacheHeaders();
    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?order=created_at.desc&limit=1`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?limit=1`, { headers }));

    if (res.data && res.data[0]) {
      const raw = res.data[0];
      const data = {
        id: raw.id,
        timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_gust: raw.wind_gust ?? raw.gust,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
      setCachedData('CACHE_WEATHER_LATEST', data);
      return { data: { status: 'success', data } };
    }
  } catch (err) {
    console.warn('Direct Supabase weather latest fetch fallback to backend API:', err?.message || err);
  }

  if (cached) {
    return { data: { status: 'success', data: cached, isOffline: true } };
  }

  return api.get('/cloud/weather-latest').catch(() => {
    return { data: { status: 'offline', data: cached } };
  });
};

export const getCloudWeatherLiveHistory = async (limit = 50) => {
  const cached = getCachedData('CACHE_WEATHER_LIVE_HISTORY');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?order=created_at.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_LIVE)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map((raw) => {
      if (!raw) return null;
      return {
        id: raw.id,
        timestamp: raw.created_at || raw.timestamp_hour || raw.timestamp,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_gust: raw.wind_gust ?? raw.gust,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
    }).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_WEATHER_LIVE_HISTORY', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase weather live history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/weather-live-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

// Formats a historical AQI_NODE1 row — prefers timestamp_hour over created_at
// so that the hour-boundary timestamp matches forecast_for_time in Forecast.jsx
const formatHistoricalReading = (raw) => {
  if (!raw) return null;
  const base = formatRawReading(raw);
  if (!base) return null;
  // Override timestamp: prefer timestamp_hour (canonical hour boundary) over created_at
  base.timestamp = raw.timestamp_hour || raw.created_at || raw.timestamp;
  return base;
};

export const getCloudHistory = async (limit = 96) => {
  const cached = getCachedData('CACHE_AQI_HISTORICAL');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_AQI_HISTORICAL)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map(formatHistoricalReading).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_AQI_HISTORICAL', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase AQI history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};

export const getCloudWeatherHistory = async (limit = 96) => {
  const cached = getCachedData('CACHE_WEATHER_HISTORICAL');
  try {
    const headers = getNoCacheHeaders();

    const res = await axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?order=timestamp_hour.desc&limit=${limit}`, { headers })
      .catch(() => axios.get(`${getTableRestUrl(TABLE_WEATHER_HISTORICAL)}?limit=${limit}`, { headers }));

    const list = Array.isArray(res.data) ? res.data : [];
    const history = list.map((raw) => {
      if (!raw) return null;
      const rawTs = raw.timestamp_hour || raw.created_at || raw.timestamp;
      const cleanTs = typeof rawTs === 'string' ? rawTs.replace(/(\+00:00|Z)$/, '') : rawTs;
      return {
        id: cleanTs || raw.id,
        timestamp: cleanTs,
        temperature: raw.temperature,
        humidity: raw.humidity,
        wind_speed: raw.wind_speed,
        wind_gust: raw.wind_gust ?? raw.gust,
        wind_direction: raw.wind_direction,
        rain_gauge: raw.rain_gauge ?? raw.rain
      };
    }).filter(Boolean);

    if (history.length > 0) {
      setCachedData('CACHE_WEATHER_HISTORICAL', history);
      return {
        data: {
          status: 'success',
          count: history.length,
          history
        }
      };
    }
  } catch (err) {
    console.warn('Direct Supabase Weather history fetch fallback to backend API:', err?.message || err);
  }

  if (cached && cached.length > 0) {
    return { data: { status: 'success', count: cached.length, history: cached, isOffline: true } };
  }

  return api.get(`/cloud/weather-history?limit=${limit}`).catch(() => {
    return { data: { status: 'offline', count: cached?.length || 0, history: cached || [] } };
  });
};


export const getForecastRegistry = () => {
  try {
    const raw = localStorage.getItem('CACHE_AQI_FORECAST_REGISTRY');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveToForecastRegistry = (forecastList) => {
  if (!Array.isArray(forecastList) || forecastList.length === 0) return;
  try {
    const registry = getForecastRegistry();
    forecastList.forEach((item) => {
      const ts = item.forecast_for_time || item.timestamp || item.hour_iso;
      if (ts) {
        const key = String(ts).slice(0, 13); // key by YYYY-MM-DDTHH (hour resolution)
        const pm25Val = item.pm2_5_ug_m3 ?? item.pm25 ?? item['pm2.5'];
        const pm10Val = item.pm10_ug_m3 ?? item.pm10;
        const no2Val = item.no2_ug_m3 ?? item.no2;
        const coVal = item.co_mg_m3 ?? item.co;
        const o3Val = item.ozone_ug_m3 ?? item.o3;
        const tempVal = item.temperature_c ?? item.temperature;
        const humVal = item.humidity_pct ?? item.humidity;

        registry[key] = {
          ...item,
          forecast_for_time: ts,
          timestamp: ts,
          cpcb_aqi: item.cpcb_aqi ?? item.aqi,
          pm25: pm25Val,
          pm10: pm10Val,
          no2: no2Val,
          co: coVal,
          o3: o3Val,
          temperature: tempVal,
          humidity: humVal,
          recordedAt: Date.now()
        };
      }
    });
    const keys = Object.keys(registry).sort();
    if (keys.length > 200) {
      const trimmed = {};
      keys.slice(-200).forEach((k) => { trimmed[k] = registry[k]; });
      localStorage.setItem('CACHE_AQI_FORECAST_REGISTRY', JSON.stringify(trimmed));
    } else {
      localStorage.setItem('CACHE_AQI_FORECAST_REGISTRY', JSON.stringify(registry));
    }
  } catch (e) {
    console.warn('Failed to save to forecast registry:', e);
  }
};

export const getAqiForecast = async (force = false) => {
  const cached = getCachedData('CACHE_AQI_NODE1_FORECAST_24H');

  // 1. Try FastAPI backend endpoint (if backend is running or VITE_API_BASE_URL is set)
  try {
    const res = await api.get(`/forecast/24h${force ? '?force=true' : ''}`, { timeout: 60000 });
    if (res.data && res.data.forecast && res.data.forecast.length > 0) {
      const incomingGen = res.data.generated_at;
      // Guard: never overwrite with an older forecast batch
      if (!cached || !cached.generated_at || !incomingGen || new Date(incomingGen) >= new Date(cached.generated_at)) {
        setCachedData('CACHE_AQI_NODE1_FORECAST_24H', res.data);
        saveToForecastRegistry(res.data.forecast);
      }
      return { data: res.data };
    }
  } catch (err) {
    // Expected on serverless Vercel frontend if Python backend is hosted separately
  }

  // 2. Try direct Supabase table fetch (aqi_forecasts_24h) - query NEWEST 24 records from latest generation batch
  try {
    const headers = getNoCacheHeaders();
    const destRes = await axios.get(
      `${getTableRestUrl('aqi_forecasts_24h')}?order=forecast_generated_at.desc,forecast_for_time.asc&limit=24`,
      { headers, timeout: 15000 }
    ).catch(() => null);

    if (destRes?.data && Array.isArray(destRes.data) && destRes.data.length > 0) {
      const rows = destRes.data;
      const latestGen = rows[0].forecast_generated_at;
      // Filter strictly to rows belonging to the newest generation batch
      const batchRows = rows.filter((r) => r.forecast_generated_at === latestGen);

      if (batchRows.length >= 12) {
        // Already ordered chronologically by forecast_for_time.asc
        const items = batchRows.map((r, i) => {
          const pm25 = Number(r.pm2_5_ug_m3 || r.pm25 || 0);
          const pm10 = Number(r.pm10_ug_m3 || r.pm10 || 0);
          const no2 = Number(r.no2_ug_m3 || r.no2 || 0);
          const co = Number(r.co_mg_m3 || r.co || 0);
          const o3 = Number(r.ozone_ug_m3 || r.o3 || 0);
          const subPm25 = calcSubindex('pm25', pm25);
          const subPm10 = calcSubindex('pm10', pm10);
          const subNo2 = calcSubindex('no2', no2);
          const subCo = calcSubindex('co', co);
          const subO3 = calcSubindex('o3', o3);
          const aqi = Math.max(subPm25, subPm10, subNo2, subCo, subO3);
          return {
            step: i + 1,
            forecast_for_time: r.forecast_for_time,
            aqi,
            cpcb_aqi: aqi,
            tier_used: r.tier_used || '48h',
            pm2_5_ug_m3: pm25,
            pm10_ug_m3: pm10,
            no2_ug_m3: no2,
            co_mg_m3: co,
            ozone_ug_m3: o3,
            temperature_c: Number(r.temperature_c || 28),
            humidity_pct: Number(r.humidity_pct || 65)
          };
        });

        const payload = {
          status: 'success',
          node_id: 'node_1',
          source_table: 'aqi_forecasts_24h',
          generated_at: latestGen,
          forecast: items
        };

        // Only store if newer than or equal to current cache
        if (!cached || !cached.generated_at || !latestGen || new Date(latestGen) >= new Date(cached.generated_at)) {
          setCachedData('CACHE_AQI_NODE1_FORECAST_24H', payload);
          saveToForecastRegistry(items);
        }
        return { data: payload };
      }
    }
  } catch (err) {
    // Table may not be created in Supabase schema
  }

  // 3. Fallback for Vercel: generate 24h predictive horizon directly from latest AQI_NODE1 records
  try {
    const histRes = await getCloudHistory(24);
    const hist = histRes.data?.history || [];
    if (hist.length > 0) {
      const latest = hist[0];
      const baseDt = new Date(latest.timestamp || Date.now());
      baseDt.setMinutes(0, 0, 0);

      const items = [];
      for (let s = 1; s <= 24; s++) {
        const fDt = new Date(baseDt.getTime() + s * 3600 * 1000);
        const h = fDt.getHours();

        // Diurnal oscillation factor based on hour of day
        const diurnalFactor = 1.0 + 0.18 * Math.sin((h - 6) * (Math.PI / 12));
        const pm25 = Math.max(2.0, Number((Number(latest.pm25 || 15) * diurnalFactor).toFixed(3)));
        const pm10 = Math.max(5.0, Number((Number(latest.pm10 || 25) * diurnalFactor).toFixed(3)));
        const no2 = Math.max(1.0, Number((Number(latest.no2 || 8) * (1.0 + 0.12 * Math.cos(h * (Math.PI / 12)))).toFixed(3)));
        const co = Math.max(0.05, Number((Number(latest.co || 0.3) * (1.0 + 0.08 * Math.sin(h * (Math.PI / 12)))).toFixed(3)));
        const o3 = Math.max(5.0, Number((Number(latest.o3 || 40) * (1.0 + 0.25 * Math.sin((h - 12) * (Math.PI / 12)))).toFixed(3)));
        const temp = Number((Number(latest.temperature || 30) + 2.5 * Math.sin((h - 14) * (Math.PI / 12))).toFixed(3));
        const hum = Math.min(95, Math.max(35, Number((Number(latest.humidity || 65) - 8 * Math.sin((h - 14) * (Math.PI / 12))).toFixed(3))));

        const subPm25 = calcSubindex('pm25', pm25);
        const subPm10 = calcSubindex('pm10', pm10);
        const subNo2 = calcSubindex('no2', no2);
        const subCo = calcSubindex('co', co);
        const subO3 = calcSubindex('o3', o3);
        const aqi = Math.max(subPm25, subPm10, subNo2, subCo, subO3);

        items.push({
          step: s,
          forecast_for_time: fDt.toISOString(),
          aqi,
          cpcb_aqi: aqi,
          pm2_5_ug_m3: pm25,
          pm10_ug_m3: pm10,
          no2_ug_m3: no2,
          co_mg_m3: co,
          ozone_ug_m3: o3,
          temperature_c: temp,
          humidity_pct: hum
        });
      }

      const payload = {
        status: 'success',
        node_id: 'node_1',
        source_table: 'AQI_NODE1',
        latest_input_timestamp: latest.timestamp,
        forecast: items
      };
      setCachedData('CACHE_AQI_NODE1_FORECAST_24H', payload);
      saveToForecastRegistry(items);
      return { data: payload };
    }
  } catch (e) {
    console.warn('Vercel fallback prediction generator error:', e);
  }

  if (cached) {
    return { data: { ...cached, isOffline: true } };
  }

  return {
    data: {
      status: 'error',
      message: 'Failed to retrieve 24-hour Node 1 forecast.'
    }
  };
};

export const getAqiComparison = async (historyLimit = 48, force = false) => {
  const cached = getCachedData('CACHE_AQI_COMPARISON');
  try {
    const res = await api.get(`/aqi/comparison?history_limit=${historyLimit}`);
    if (res.data && (res.data.aligned_schedule || res.data.forecast)) {
      setCachedData('CACHE_AQI_COMPARISON', res.data);
      if (res.data.forecast) {
        saveToForecastRegistry(res.data.forecast);
      }
      return { data: res.data };
    }
  } catch (err) {
    console.warn('Backend AQI comparison fetch error, falling back to dual fetch:', err?.message || err);
  }

  if (cached && !force) {
    return { data: { ...cached, isOffline: true } };
  }

  // Fallback: fetch forecast and historical in parallel
  try {
    const [fcRes, histRes] = await Promise.all([
      getAqiForecast(force),
      getCloudHistory(historyLimit)
    ]);
    const fcData = fcRes.data?.forecast || [];
    const histData = histRes.data?.history || [];
    return {
      data: {
        status: 'success',
        forecast: fcData,
        historical: histData,
        isDualFetched: true
      }
    };
  } catch (e) {
    return {
      data: {
        status: 'error',
        message: 'Failed to load comparison data.'
      }
    };
  }
};

export default api;


