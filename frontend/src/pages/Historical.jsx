import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, CloudSun, Database, RefreshCw, Layers, Table } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getCloudHistory, getCloudWeatherHistory, getCachedData } from '../api';

const AQI_PARAMS = [
  { key: 'cpcb_aqi', label: 'AQI', unit: '', color: '#00bfa5' },
  { key: 'temperature', label: 'Temp', unit: '°C', color: '#f97316' },
  { key: 'humidity', label: 'Hum.', unit: '%', color: '#00bfa5' },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', color: '#0284c7' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', color: '#6366f1' },
  { key: 'co', label: 'CO', unit: 'mg/m³', color: '#16a34a' },
  { key: 'no2', label: 'NO₂', unit: 'µg/m³', color: '#9333ea' },
  { key: 'o3', label: 'O₃', unit: 'µg/m³', color: '#d97706' },
];

const WEATHER_PARAMS = [
  { key: 'wind_speed', label: 'Wind Spd', unit: 'km/h', color: '#4f46e5' },
  { key: 'wind_direction', label: 'Wind Dir', unit: '°', color: '#0284c7' },
  { key: 'rain_gauge', label: 'Rain', unit: 'mm', color: '#0284c7' },
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
  const [subTab, setSubTab] = useState('aqi'); // 'aqi' or 'weather'
  const [rows, setRows] = useState(() => {
    if (selectedStation !== 'station-1') return [];
    return getCachedData('CACHE_AQI_HISTORICAL') || [];
  });
  const [loading, setLoading] = useState(() => {
    if (selectedStation !== 'station-1') return false;
    return (getCachedData('CACHE_AQI_HISTORICAL') || []).length === 0;
  });
  const [error, setError] = useState(null);

  const [selectedAqiParam, setSelectedAqiParam] = useState('cpcb_aqi');
  const [selectedWeatherParam, setSelectedWeatherParam] = useState('wind_speed');

  useEffect(() => {
    let isMounted = true;
    setError(null);
    setLoading(true);

    if (selectedStation !== 'station-1') {
      setRows([]);
      setLoading(false);
      return;
    }

    const fetchHistoryData = () => {
      const fetcher = subTab === 'aqi' ? getCloudHistory : getCloudWeatherHistory;
      fetcher(500)
        .then((res) => {
          if (!isMounted) return;
          setRows(res.data?.history ?? []);
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Cloud history fetch failed:', err);
          setLoading(false);
        });
    };

    fetchHistoryData();
    const interval = setInterval(fetchHistoryData, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, selectedStation, subTab]);

  const activeParam = subTab === 'aqi'
    ? (AQI_PARAMS.find(p => p.key === selectedAqiParam) || AQI_PARAMS[0])
    : (WEATHER_PARAMS.find(p => p.key === selectedWeatherParam) || WEATHER_PARAMS[0]);

  const activeParamKey = activeParam.key;

  const { chartData } = useMemo(() => {
    if (!rows || rows.length === 0) return { chartData: [] };
    const reversed = [...rows].reverse();
    const computed = reversed.map((r, idx) => {
      const dt = r.timestamp ? new Date(r.timestamp) : new Date();
      const val = r[activeParamKey] != null && !isNaN(Number(r[activeParamKey])) ? Number(r[activeParamKey]) : 0;
      return {
        id: r.id || idx,
        uniqueKey: dt && !isNaN(dt) ? `${dt.getTime()}_${idx}` : `p_${idx}`,
        time: formatTimeString(dt),
        date: formatDDMMYYYY(dt),
        value: val,
      };
    });
    return { chartData: computed };
  }, [rows, activeParamKey]);

  const tableRows = rows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database style={{ width: 22, height: 22, color: '#00bfa5' }} />
              Analytics Archive
            </h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>
              Longitudinal Sensor Trends &amp; Telemetry Log Records
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sub-Navigation Selector: AQI Historical vs Weather Historical */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '5px',
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
          gap: 6,
        }}>
          <button
            onClick={() => setSubTab('aqi')}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: subTab === 'aqi' ? '#ffffff' : '#64748b',
              transition: 'color 0.15s ease',
            }}
          >
            {subTab === 'aqi' && (
              <motion.div
                layoutId="historicalSubTabPill"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#00bfa5',
                  borderRadius: 999,
                  boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                  zIndex: 0,
                }}
              />
            )}
            <Activity style={{ width: 17, height: 17, zIndex: 1 }} />
            <span style={{ zIndex: 1 }}>AQI Historical Analytics</span>
          </button>

          <button
            onClick={() => setSubTab('weather')}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: subTab === 'weather' ? '#ffffff' : '#64748b',
              transition: 'color 0.15s ease',
            }}
          >
            {subTab === 'weather' && (
              <motion.div
                layoutId="historicalSubTabPill"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#00bfa5',
                  borderRadius: 999,
                  boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                  zIndex: 0,
                }}
              />
            )}
            <CloudSun style={{ width: 17, height: 17, zIndex: 1 }} />
            <span style={{ zIndex: 1 }}>Weather Historical Analytics</span>
          </button>
        </div>
      </div>

      {/* Chart Section */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers style={{ width: 16, height: 16, color: activeParam.color }} />
            {subTab === 'aqi' ? 'Air Quality Trend Analysis' : 'Weather Atmospheric Trend Analysis'}
          </h2>

          {/* Parameter Filter Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: '#f8fafc', padding: 4, borderRadius: 999, border: '1px solid #e2e8f0' }}>
            {(subTab === 'aqi' ? AQI_PARAMS : WEATHER_PARAMS).map((p) => {
              const isSelected = subTab === 'aqi' ? selectedAqiParam === p.key : selectedWeatherParam === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => subTab === 'aqi' ? setSelectedAqiParam(p.key) : setSelectedWeatherParam(p.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: isSelected ? p.color : 'transparent',
                    color: isSelected ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: '100%', height: 340, minWidth: 0 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <RefreshCw style={{ width: 18, height: 18, animation: 'spin 1s linear infinite', marginRight: 8, color: '#00bfa5' }} />
              Loading chart...
            </div>
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

      {/* Table Section: Render specific columns for AQI or Weather */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ padding: '20px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
              {subTab === 'aqi' ? 'AQI Historical Log Records' : 'Weather Historical Log Records'}
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              Calculated 1-Hour Aggregated Averages
            </p>
          </div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 420 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr style={{ color: '#475569', fontSize: 12 }}>
                {subTab === 'aqi'
                  ? ['Date', 'Time', 'AQI', 'Temp (°C)', 'Humidity (%)', 'PM2.5', 'PM10', 'CO', 'NO₂', 'O₃'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  : ['Date', 'Time', 'Wind Spd (km/h)', 'Wind Dir (°)', 'Rain (mm)'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 16px', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.timestamp ? formatDDMMYYYY(new Date(row.timestamp)) : '-'}</td>
                  <td style={{ padding: '10px 16px', color: '#00bfa5', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{row.timestamp ? formatTimeString(new Date(row.timestamp)) : '-'}</td>
                  
                  {subTab === 'aqi' ? (
                    <>
                      <td style={{ padding: '10px 16px', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>{row.cpcb_aqi || '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.temperature != null ? `${Number(row.temperature).toFixed(1)}°C` : '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.humidity != null ? `${Number(row.humidity).toFixed(1)}%` : '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm25 || '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm10 || '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.co || '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.no2 || '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.o3 || '-'}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#4f46e5', fontWeight: 600 }}>{row.wind_speed != null ? `${Number(row.wind_speed).toFixed(1)} km/h` : '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#0284c7', fontWeight: 600 }}>{row.wind_direction != null ? `${getCompassDir(row.wind_direction)} ${row.wind_direction}°`.trim() : '-'}</td>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.rain_gauge != null ? `${Number(row.rain_gauge).toFixed(1)} mm` : '0.0 mm'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
