import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  CloudSun, 
  Database, 
  RefreshCw, 
  Layers, 
  Table, 
  Calendar as CalendarIcon, 
  Clock, 
  Download,
  Info
} from 'lucide-react';
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
  { key: 'temperature', label: 'Temp', unit: '°C', color: '#f97316' },
  { key: 'humidity', label: 'Hum.', unit: '%', color: '#00bfa5' },
  { key: 'wind_speed', label: 'Wind Spd', unit: 'km/h', color: '#4f46e5' },
  { key: 'wind_direction', label: 'Wind Dir', unit: '°', color: '#0284c7' },
  { key: 'rain_gauge', label: 'Rain', unit: 'mm', color: '#0891b2' },
];

const getCompassDir = (deg) => {
  if (deg == null || isNaN(Number(deg))) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round((((Number(deg) % 360) + 360) % 360) / 22.5) % 16];
};

const formatDDMMYYYY = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
};

const formatYYYYMMDD = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${m}-${d}`;
};

const formatTimeString = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = String(minutes).padStart(2, '0');
  return `${hours}:${minStr}${ampm}`;
};

const formatLongDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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

  // Track if user has manually picked a date
  const hasUserPickedDateRef = useRef(false);

  // Selected Date State: Defaults to latest recorded date in data
  const [selectedDate, setSelectedDate] = useState(() => {
    const cached = getCachedData('CACHE_AQI_HISTORICAL') || [];
    if (cached.length > 0 && cached[0]?.timestamp) {
      const dt = new Date(cached[0].timestamp);
      if (!isNaN(dt.getTime())) return formatYYYYMMDD(dt);
    }
    return formatYYYYMMDD(new Date());
  });

  useEffect(() => {
    let isMounted = true;
    setError(null);

    if (selectedStation !== 'station-1') {
      setRows([]);
      setLoading(false);
      return;
    }

    const fetchHistoryData = (isInitial = false) => {
      if (isInitial && rows.length === 0) {
        setLoading(true);
      }
      const fetcher = subTab === 'aqi' ? getCloudHistory : getCloudWeatherHistory;
      fetcher(1000)
        .then((res) => {
          if (!isMounted) return;
          const data = res.data?.history ?? [];
          
          // Avoid re-rendering state if incoming data is identical
          setRows((prev) => {
            if (prev.length === data.length && prev[0]?.timestamp === data[0]?.timestamp) {
              return prev;
            }
            return data;
          });

          // If no date selected or current date has no records in this tab's dataset, default to latest recorded day
          if (data.length > 0) {
            const hasMatch = selectedDate && data.some(r => r.timestamp && formatYYYYMMDD(new Date(r.timestamp)) === selectedDate);
            if (!selectedDate || !hasMatch) {
              for (const r of data) {
                if (r.timestamp) {
                  const dt = new Date(r.timestamp);
                  if (!isNaN(dt.getTime())) {
                    setSelectedDate(formatYYYYMMDD(dt));
                    break;
                  }
                }
              }
            }
          }

          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Cloud history fetch failed:', err);
          setLoading(false);
        });
    };

    fetchHistoryData(true);
    const interval = setInterval(() => fetchHistoryData(false), 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, selectedStation, subTab]);

  // When switching between AQI and Weather, reset date so it loads the active tab's latest day
  const handleTabChange = (newTab) => {
    setSubTab(newTab);
    hasUserPickedDateRef.current = false;
    setSelectedDate(null);
  };

  // Active parameter
  const activeParam = subTab === 'aqi'
    ? (AQI_PARAMS.find(p => p.key === selectedAqiParam) || AQI_PARAMS[0])
    : (WEATHER_PARAMS.find(p => p.key === selectedWeatherParam) || WEATHER_PARAMS[0]);

  const activeParamKey = activeParam.key;

  // Filter rows strictly to the selected day
  const effectiveSelectedDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (rows.length > 0 && rows[0]?.timestamp) {
      const dt = new Date(rows[0].timestamp);
      if (!isNaN(dt.getTime())) return formatYYYYMMDD(dt);
    }
    return formatYYYYMMDD(new Date());
  }, [selectedDate, rows]);

  const filteredRows = useMemo(() => {
    if (!effectiveSelectedDate) return [];
    return rows.filter((r) => {
      if (!r.timestamp) return false;
      const dt = new Date(r.timestamp);
      return formatYYYYMMDD(dt) === effectiveSelectedDate;
    });
  }, [rows, effectiveSelectedDate]);

  // Summary statistics for selected 24-hour day
  const selectedDaySummary = useMemo(() => {
    if (filteredRows.length === 0) return null;
    
    const values = filteredRows
      .map(r => r[activeParamKey])
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);

    const aqiValues = filteredRows
      .map(r => r.cpcb_aqi)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);

    const avgVal = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 'N/A';
    const minVal = values.length > 0 ? Math.min(...values).toFixed(1) : 'N/A';
    const maxVal = values.length > 0 ? Math.max(...values).toFixed(1) : 'N/A';

    const avgAqi = aqiValues.length > 0 ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : 'N/A';
    const maxAqi = aqiValues.length > 0 ? Math.max(...aqiValues) : 'N/A';

    return {
      dateStr: effectiveSelectedDate,
      longDate: formatLongDate(effectiveSelectedDate),
      hourCount: filteredRows.length,
      avgVal,
      minVal,
      maxVal,
      avgAqi,
      maxAqi
    };
  }, [effectiveSelectedDate, filteredRows, activeParamKey]);

  // Chart data computation (chronological order from earliest to latest hour)
  const chartData = useMemo(() => {
    if (!filteredRows || filteredRows.length === 0) return [];
    
    // Sort chronologically for charting
    const sorted = [...filteredRows].sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tA - tB;
    });

    return sorted.map((r, idx) => {
      const dt = r.timestamp ? new Date(r.timestamp) : new Date();
      const val = r[activeParamKey] != null && !isNaN(Number(r[activeParamKey])) ? Number(r[activeParamKey]) : 0;
      return {
        id: r.id || idx,
        uniqueKey: dt && !isNaN(dt) ? `${dt.getTime()}_${idx}` : `p_${idx}`,
        time: formatTimeString(dt),
        date: formatDDMMYYYY(dt),
        rawHour: dt.getHours(),
        value: val,
      };
    });
  }, [filteredRows, activeParamKey]);

  // CSV Export for filtered 24h table data
  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;
    
    let headers = [];
    let rowsData = [];

    if (subTab === 'aqi') {
      headers = ['Date', 'Time', 'AQI', 'Temperature (°C)', 'Humidity (%)', 'PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'CO (mg/m³)', 'NO2 (µg/m³)', 'O3 (µg/m³)'];
      rowsData = filteredRows.map(r => {
        const dt = new Date(r.timestamp);
        return [
          formatDDMMYYYY(dt),
          formatTimeString(dt),
          r.cpcb_aqi ?? '',
          r.temperature ?? '',
          r.humidity ?? '',
          r.pm25 ?? '',
          r.pm10 ?? '',
          r.co ?? '',
          r.no2 ?? '',
          r.o3 ?? ''
        ];
      });
    } else {
      headers = ['Date', 'Time', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (km/h)', 'Wind Direction (°)', 'Rain Gauge (mm)'];
      rowsData = filteredRows.map(r => {
        const dt = new Date(r.timestamp);
        return [
          formatDDMMYYYY(dt),
          formatTimeString(dt),
          r.temperature ?? '',
          r.humidity ?? '',
          r.wind_speed ?? '',
          r.wind_direction ?? '',
          r.rain_gauge ?? ''
        ];
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rowsData.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${subTab}_telemetry_${effectiveSelectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#0f172a' }}>
      
      {/* ── Page Header ── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database style={{ width: 22, height: 22, color: '#00bfa5' }} />
          Analytics Archive
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>
          Longitudinal Sensor Trends &amp; 24-Hour Daily Telemetry Explorer
        </p>
      </motion.div>

      {/* ── Sub-Navigation Selector: AQI Historical vs Weather Historical ── */}
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
            onClick={() => handleTabChange('aqi')}
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
            onClick={() => handleTabChange('weather')}
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

      {/* ── UNIFIED DATE SELECTOR & 24-HOUR SUMMARY CARD ── */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: '20px 24px',
        border: '1.5px solid #00bfa5',
        boxShadow: '0 4px 20px rgba(0, 191, 165, 0.08)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
      }}>
        {/* Top Header Row: Date Selector & Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          {/* Left Title & Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00bfa5'
            }}>
              <CalendarIcon style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Select Date (24-Hour Telemetry)</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {effectiveSelectedDate 
                  ? `Showing 24-hour log records for ${formatLongDate(effectiveSelectedDate)}`
                  : 'Select any date to view its 24-hour hourly records'
                }
              </div>
            </div>
          </div>

          {/* Right Action Controls: Native Calendar Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <input
                type="date"
                value={effectiveSelectedDate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  hasUserPickedDateRef.current = true;
                  setSelectedDate(val || null);
                }}
                style={{
                  padding: '8px 14px 8px 34px',
                  borderRadius: 12,
                  border: '1.5px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none'
                }}
              />
              <CalendarIcon style={{ position: 'absolute', left: 11, width: 15, height: 15, color: '#00bfa5', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Bottom Integrated Section: 24-Hour Metrics */}
        {selectedDaySummary ? (
          <div style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#00bfa5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(0, 191, 165, 0.25)'
              }}>
                <Clock style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  {selectedDaySummary.longDate}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, color: '#00bfa5' }}>{selectedDaySummary.hourCount} Hourly Log Records</span>
                  <span>•</span>
                  <span>Full 24-Hour Day Progression</span>
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>24h Avg {activeParam.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: activeParam.color, fontFamily: 'var(--font-mono)' }}>
                  {selectedDaySummary.avgVal} {activeParam.unit}
                </div>
              </div>

              <div style={{ padding: '6px 14px', borderRadius: 12, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>24h Min / Max</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                  {selectedDaySummary.minVal} / {selectedDaySummary.maxVal} {activeParam.unit}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: 12.5 }}>
            No recorded hourly data for {formatLongDate(effectiveSelectedDate)}. Please pick another date.
          </div>
        )}
      </div>

      {/* ── CHART SECTION ── */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers style={{ width: 16, height: 16, color: activeParam.color }} />
              {subTab === 'aqi' ? 'Air Quality Hourly Trend Analysis' : 'Weather Atmospheric Trend Analysis'}
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              24-Hour hourly progression for {formatLongDate(effectiveSelectedDate)}
            </p>
          </div>

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
          ) : chartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
              <Info style={{ width: 24, height: 24, color: '#94a3b8' }} />
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>No records found for {formatLongDate(effectiveSelectedDate)}.</p>
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
                  interval={0}
                />
                <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#64748b' }} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>{d.date} • {d.time}</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: activeParam.color, marginTop: 2 }}>{d.value} {activeParam.unit}</div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="value" fill={activeParam.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── TABLE SECTION: RENDER SPECIFIC COLUMNS FOR AQI OR WEATHER ── */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
              {subTab === 'aqi' ? 'AQI Historical Telemetry Table' : 'Weather Historical Telemetry Table'}
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              Calculated 1-Hour Aggregated Averages for {formatLongDate(effectiveSelectedDate)} ({filteredRows.length} Hourly Records)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={filteredRows.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: filteredRows.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Download style={{ width: 14, height: 14, color: '#00bfa5' }} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: 440 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 2 }}>
              <tr style={{ color: '#475569', fontSize: 12 }}>
                {subTab === 'aqi'
                  ? ['Date', 'Time', 'AQI', 'Temp (°C)', 'Humidity (%)', 'PM2.5', 'PM10', 'CO', 'NO₂', 'O₃'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  : ['Date', 'Time', 'Temp (°C)', 'Humidity (%)', 'Wind Spd (km/h)', 'Wind Dir (°)', 'Rain (mm)'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={subTab === 'aqi' ? 10 : 7} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <CalendarIcon style={{ width: 24, height: 24, color: '#94a3b8' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>No telemetry records available for {formatLongDate(effectiveSelectedDate)}.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
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
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#ea580c', fontWeight: 600 }}>{row.temperature != null ? `${Number(row.temperature).toFixed(1)}°C` : '-'}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#0284c7', fontWeight: 600 }}>{row.humidity != null ? `${Number(row.humidity).toFixed(1)}%` : '-'}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#4f46e5', fontWeight: 600 }}>{row.wind_speed != null ? `${Number(row.wind_speed).toFixed(1)} km/h` : '-'}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#0284c7', fontWeight: 600 }}>{row.wind_direction != null ? `${getCompassDir(row.wind_direction)} ${row.wind_direction}°`.trim() : '-'}</td>
                        <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.rain_gauge != null ? `${Number(row.rain_gauge).toFixed(1)} mm` : '0.0 mm'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
