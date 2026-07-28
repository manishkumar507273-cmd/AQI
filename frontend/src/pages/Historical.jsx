import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getCloudHistory } from '../api';

const PARAMS = [
  { key: 'cpcb_aqi',    label: 'AQI',   unit: '',        color: '#38bdf8' },
  { key: 'pm25',        label: 'PM2.5', unit: 'µg/m³',   color: '#f59e0b' },
  { key: 'pm10',        label: 'PM10',  unit: 'µg/m³',   color: '#ef4444' },
  { key: 'co',          label: 'CO',    unit: 'mg/m³',   color: '#64748b' },
  { key: 'no2',         label: 'NO₂',   unit: 'µg/m³',   color: '#a855f7' },
  { key: 'o3',          label: 'O₃',    unit: 'µg/m³',   color: '#06b6d4' },
  { key: 'temperature', label: 'Temp',  unit: '°C',      color: '#f97316' },
  { key: 'humidity',    label: 'Hum.',  unit: '%',        color: '#8b5cf6' },
];

const getAQIBadge = (val) => {
  if (!val) return { label: 'N/A', bg: '#f1f5f9', text: '#64748b' };
  if (val <= 50)  return { label: 'Good',        bg: '#dcfce7', text: '#15803d' };
  if (val <= 100) return { label: 'Satisfactory', bg: '#fef9c3', text: '#a16207' };
  if (val <= 200) return { label: 'Moderate',    bg: '#ffedd5', text: '#c2410c' };
  if (val <= 300) return { label: 'Poor',        bg: '#fee2e2', text: '#b91c1c' };
  if (val <= 400) return { label: 'Very Poor',   bg: '#f3e8ff', text: '#6b21a8' };
  return          { label: 'Severe',             bg: '#fce7f3', text: '#9d174d' };
};

const fmt = (val, d = 2) => (val != null ? Number(val).toFixed(d) : 'N/A');

export default function Historical({ refreshKey }) {
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedParam, setSelectedParam] = useState('cpcb_aqi');

  useEffect(() => {
    let isMounted = true;
    setError(null);

    getCloudHistory(200)
      .then((res) => {
        if (!isMounted) return;
        const history = res.data?.history ?? [];
        setRows(history);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Cloud history fetch failed:', err);
        setError('Unable to fetch history from cloud.');
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [refreshKey]);

  const activeParam = PARAMS.find(p => p.key === selectedParam) || PARAMS[0];

  const chartData = rows.map((r) => {
    const dt = r.timestamp ? new Date(r.timestamp) : null;
    return {
      time: dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
      date: dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—',
      value: r[selectedParam] != null ? Number(r[selectedParam]) : null,
    };
  });

  const tableRows = [...rows].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: 'var(--font-sans)', color: '#334155' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Analytics &amp; Trends
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Historical Sensor Data
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
            Live from Supabase cloud · last {rows.length} readings from your ESP32
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>LIVE</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            · Updates every 30s{lastUpdated ? ` · Last: ${lastUpdated.toLocaleTimeString()}` : ''}
          </span>
        </div>
      </div>

      <div style={{ background: '#ffffff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Parameter Trends</h2>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: '#f8fafc', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            {PARAMS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedParam(p.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: selectedParam === p.key ? p.color : 'transparent',
                  color: selectedParam === p.key ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                  boxShadow: selectedParam === p.key ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ width: '100%', height: 340 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Loading chart data from cloud...
            </div>
          ) : error ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Data is not available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }} barCategoryGap="8%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  interval={Math.max(Math.floor(chartData.length / 12), 0)}
                  label={{ value: 'Time', position: 'bottom', offset: 20, style: { fontSize: 12, fill: '#94a3b8', fontWeight: 600 } }}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div style={{ backgroundColor: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 20px rgba(0,0,0,0.12)', minWidth: 150 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>{d.date}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>{d.time}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: activeParam.color, display: 'inline-block' }} />
                            <span>{payload[0].value != null ? `${payload[0].value} ${activeParam.unit}` : 'N/A'}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" fill={activeParam.color} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {!loading && chartData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginTop: -8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{chartData[0]?.date}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{chartData[chartData.length - 1]?.date}</span>
          </div>
        )}
      </div>

      <div style={{ background: '#ffffff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Sensor Log Table</h2>
          <span style={{ fontSize: 13, color: '#64748b' }}>Showing {tableRows.length} readings from Supabase cloud (newest first)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>AQI</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Temp (°C)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Humidity (%)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>PM2.5 (µg/m³)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>PM10 (µg/m³)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>CO (mg/m³)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>NO₂ (µg/m³)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>O₃ (µg/m³)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Dominant</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Loading...' : 'Data is not available'}
                  </td>
                </tr>
              ) : tableRows.map((row, idx) => {
                const dt = row.timestamp ? new Date(row.timestamp) : null;
                const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A';
                const status = getAQIBadge(row.cpcb_aqi);
                return (
                  <tr key={row.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>{timeStr}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0284c7', fontSize: 15 }}>{row.cpcb_aqi ?? 'N/A'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: status.bg, color: status.text }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.temperature, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.humidity, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.pm25)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.pm10)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.co)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.no2)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{fmt(row.o3)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{row.dominant_pollutant ?? 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

