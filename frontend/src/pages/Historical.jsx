import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getCloudHistory } from '../api';

const PARAMS = [
  { key: 'cpcb_aqi',       label: 'AQI',      unit: '',        color: '#00bfa5' },
  { key: 'pm25',           label: 'PM2.5',    unit: 'µg/m³',   color: '#38bdf8' },
  { key: 'pm10',           label: 'PM10',     unit: 'µg/m³',   color: '#818cf8' },
  { key: 'co',             label: 'CO',       unit: 'mg/m³',   color: '#94a3b8' },
  { key: 'no2',            label: 'NO₂',      unit: 'µg/m³',   color: '#c084fc' },
  { key: 'o3',             label: 'O₃',       unit: 'µg/m³',   color: '#fbbf24' },
  { key: 'temperature',    label: 'Temp',     unit: '°C',      color: '#f97316' },
  { key: 'humidity',       label: 'Hum.',     unit: '%',       color: '#38bdf8' },
  { key: 'wind_speed',     label: 'Wind Spd', unit: 'km/h',    color: '#818cf8' },
  { key: 'wind_direction', label: 'Wind Dir', unit: '°',       color: '#22d3ee' },
  { key: 'rain_gauge',     label: 'Rain',     unit: 'mm',      color: '#38bdf8' },
];

const getCompassDir = (deg) => {
  if (deg == null || isNaN(Number(deg))) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16];
};

const formatDDMMYYYY = (date) => {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

const formatTimeString = (date) => {
  if (!date) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = String(minutes).padStart(2, '0');
  return `${hours}:${minStr}${ampm}`;
};

export default function Historical({ refreshKey, selectedStation = 'station-1' }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedParam, setSelectedParam] = useState('cpcb_aqi');

  useEffect(() => {
    let isMounted = true;
    setError(null);

    if (selectedStation !== 'station-1') {
      setRows([]);
      setLoading(false);
      return;
    }

    getCloudHistory(500)
      .then((res) => {
        if (!isMounted) return;
        setRows(res.data?.history ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Cloud history fetch failed:', err);
        setError('Unable to fetch history from cloud.');
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [refreshKey, selectedStation]);

  const activeParam = PARAMS.find(p => p.key === selectedParam) || PARAMS[0];

  const { chartData } = useMemo(() => {
    if (!rows || rows.length === 0) return { chartData: [] };
    const reversed = [...rows].reverse();
    const computed = reversed.map((r, idx) => {
      const dt = r.timestamp ? new Date(r.timestamp) : new Date();
      const val = r[selectedParam] != null ? Number(r[selectedParam]) : 0;
      return {
        id: r.id || idx,
        uniqueKey: dt && !isNaN(dt) ? `${dt.getTime()}_${idx}` : `p_${idx}`,
        time: formatTimeString(dt),
        date: formatDDMMYYYY(dt),
        value: val,
      };
    });
    return { chartData: computed };
  }, [rows, selectedParam]);

  const tableRows = [...rows].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Historical Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          Longitudinal sensor trends &amp; telemetry records
        </p>
      </motion.div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 24,
          padding: '28px 32px',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Telemetry Archive
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
            {rows.length} <span style={{ fontSize: 14, fontWeight: 500, color: '#64748b' }}>Recorded Data Points</span>
          </div>
        </div>

        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: '14px 20px',
          fontSize: 13,
          color: '#0f172a',
        }}>
          📊 Active Parameter: <strong style={{ color: activeParam.color }}>{activeParam.label}</strong>
        </div>
      </motion.div>

      {/* Chart Container */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Parameter Trends</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: '#f8fafc', padding: 4, borderRadius: 999, border: '1px solid #e2e8f0' }}>
            {PARAMS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedParam(p.key)}
                style={{
                  padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: selectedParam === p.key ? p.color : 'transparent',
                  color: selectedParam === p.key ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 340, minWidth: 0 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="uniqueKey"
                  tickFormatter={(val) => {
                    const item = chartData.find(d => d.uniqueKey === val);
                    return item ? item.time : val;
                  }}
                  stroke="#94a3b8"
                  fontSize={11}
                  tick={{ fill: '#64748b' }}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#64748b' }} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{d.date} {d.time}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: activeParam.color }}>{d.value} {activeParam.unit}</div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="value" fill={activeParam.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Network Log Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ padding: '20px 24px 12px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Sensor Log History</h2>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr style={{ color: '#475569', fontSize: 12 }}>
                {['Date', 'Time', 'AQI', 'PM2.5', 'PM10', 'CO', 'NO₂', 'O₃', 'Temp (°C)', 'Humidity (%)', 'Wind Spd (km/h)', 'Wind Dir (°)', 'Rain (mm)', 'Dominant'].map((h) => (
                  <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 16px', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.timestamp ? formatDDMMYYYY(new Date(row.timestamp)) : '-'}</td>
                  <td style={{ padding: '10px 16px', color: '#00bfa5', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{row.timestamp ? formatTimeString(new Date(row.timestamp)) : '-'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{row.cpcb_aqi || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm25 || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm10 || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.co || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.no2 || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.o3 || '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.temperature != null ? `${row.temperature}°C` : '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.humidity != null ? `${row.humidity}%` : '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#4f46e5', fontWeight: 600 }}>{row.wind_speed != null ? `${row.wind_speed} km/h` : '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#0284c7', fontWeight: 600 }}>{row.wind_direction != null ? `${getCompassDir(row.wind_direction)} ${row.wind_direction}°`.trim() : '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.rain_gauge != null ? row.rain_gauge : '-'}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.dominant_pollutant || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
