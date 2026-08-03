import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getCloudHistory } from '../api';

const PARAMS = [
  { key: 'cpcb_aqi',       label: 'AQI',      unit: 'IN',      color: '#84cc16' },
  { key: 'pm25',           label: 'PM2.5',    unit: 'µg/m³',   color: '#f59e0b' },
  { key: 'pm10',           label: 'PM10',     unit: 'µg/m³',   color: '#ef4444' },
  { key: 'co',             label: 'CO',       unit: 'mg/m³',   color: '#64748b' },
  { key: 'no2',            label: 'NO₂',      unit: 'µg/m³',   color: '#a855f7' },
  { key: 'o3',             label: 'O₃',       unit: 'µg/m³',   color: '#06b6d4' },
  { key: 'temperature',    label: 'Temp',     unit: '°C',      color: '#f97316' },
  { key: 'humidity',       label: 'Hum.',     unit: '%',       color: '#8b5cf6' },
  { key: 'wind_speed',     label: 'Wind Spd', unit: 'km/h',    color: '#0284c7' },
  { key: 'wind_direction', label: 'Wind Dir', unit: '°',       color: '#0d9488' },
  { key: 'rain_gauge',     label: 'Rain',     unit: 'mm',      color: '#3b82f6' },
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

export default function Historical({ refreshKey }) {
  const [rows,          setRows]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [selectedParam, setSelectedParam] = useState('cpcb_aqi');

  useEffect(() => {
    let isMounted = true;
    setError(null);

    getCloudHistory(500)
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

  // Process data directly from real database rows
  const { chartData, startDateStr, endDateStr } = useMemo(() => {
    if (!rows || rows.length === 0) {
      return { chartData: [], startDateStr: '', endDateStr: '' };
    }

    let maxVal = -1;
    const computed = rows.map((r, idx) => {
      const dt = r.timestamp ? new Date(r.timestamp) : new Date();
      const val = r[selectedParam] != null ? Number(r[selectedParam]) : 0;
      if (val > maxVal) maxVal = val;

      const timeStr = formatTimeString(dt);
      const dateStr = formatDDMMYYYY(dt);

      return {
        time: timeStr,
        date: dateStr,
        fullTime: `${dateStr} ${timeStr}`,
        value: val,
        rawDateObj: dt,
        cpcb_aqi: r.cpcb_aqi
      };
    });

    const finalData = computed.map(d => ({
      ...d,
      isPeak: d.value === maxVal && maxVal > 0,
    }));

    const startStr = finalData[0]?.date || '';
    const endStr = finalData[finalData.length - 1]?.date || '';

    return { chartData: finalData, startDateStr: startStr, endDateStr: endStr };
  }, [rows, selectedParam]);


  const tableRows = [...rows].reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, fontFamily: 'var(--font-sans)', color: '#334155' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Analytics &amp; Trends
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Historical Sensor Data
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>LIVE</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            · Updates every 30s{lastUpdated ? ` · Last: ${lastUpdated.toLocaleTimeString()}` : ''}
          </span>
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Parameter Trends</h2>
          </div>

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

        {/* 15-Min Bar Chart */}
        <div style={{ width: '100%', height: 380, position: 'relative' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Loading 15-minute gap history...
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
              <BarChart data={chartData} margin={{ top: 15, right: 25, left: 30, bottom: 45 }} barCategoryGap="10%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={5}
                  label={{
                    value: 'Time',
                    position: 'bottom',
                    offset: 25,
                    style: { fontSize: 13, fill: '#475569', fontWeight: 700 },
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 'dataMax + 5']}
                  label={{
                    value: selectedParam === 'cpcb_aqi' ? 'AQI (IN)' : `${activeParam.label} (${activeParam.unit})`,
                    angle: -90,
                    position: 'insideLeft',
                    offset: -18,
                    style: { fontSize: 13, fill: '#475569', fontWeight: 700, textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const status = getAQIBadge(d.value);
                      return (
                        <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: 10, padding: '12px 16px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', minWidth: 170 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>{d.date}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#0284c7', marginBottom: 8 }}>{d.fullTime}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                              {d.value} <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{activeParam.unit}</span>
                            </span>
                            {selectedParam === 'cpcb_aqi' && (
                              <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: status.bg, color: status.text }}>
                                {status.label}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isPeak ? '#eab308' : '#84cc16'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom Date Footers (DD-MM-YYYY) matching reference image */}
        {!loading && chartData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 30px', marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{startDateStr}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{endDateStr}</span>
          </div>
        )}
      </div>

      {/* Sensor Log Table */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '24px 28px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>Sensor Log Table</h2>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
            backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1'
          }}>
            1 Hour Average
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: 12, letterSpacing: '0.02em' }}>
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Wind Speed (km/h)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Wind Dir (°)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rain (mm)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Dominant</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Loading...' : 'Data is not available'}
                  </td>
                </tr>
              ) : tableRows.map((row, idx) => {
                const dt = row.timestamp ? new Date(row.timestamp) : null;
                const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'NaN';
                const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'NaN';
                const status = getAQIBadge(row.cpcb_aqi);
                const valOrNaN = (v, d = 2) => (v != null && v !== 'N/A' && !Number.isNaN(Number(v))) ? Number(v).toFixed(d) : 'NaN';

                return (
                  <tr key={row.id ?? idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{dateStr}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>{timeStr}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0284c7', fontSize: 15 }}>{row.cpcb_aqi ?? 'NaN'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, backgroundColor: status.bg, color: status.text }}>
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.temperature, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.humidity, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.pm25)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.pm10)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.co)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.no2)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.o3)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.wind_speed, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.wind_direction, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{valOrNaN(row.rain_gauge, 1)}</td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>{row.dominant_pollutant ?? 'NaN'}</td>
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
