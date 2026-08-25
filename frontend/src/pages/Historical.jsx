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
  { key: 'wind_gust', label: 'Wind Gust', unit: 'km/h', color: '#8b5cf6' },
  { key: 'wind_direction', label: 'Wind Dir', unit: '°', color: '#0284c7' },
  { key: 'rain_gauge', label: 'Rain', unit: 'mm', color: '#0891b2' },
];

// Returns category info based on CPCB AQI standards
const getAqiCategory = (val) => {
  if (val == null || val === 'N/A' || isNaN(Number(val))) {
    return {
      label: 'No Data',
      color: '#94a3b8',
      bg: '#f8fafc',
      border: '#e2e8f0',
      text: '#64748b',
      badgeBg: '#e2e8f0',
      badgeText: '#475569',
    };
  }
  const v = Number(val);
  if (v <= 50) {
    return {
      label: 'Good',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#86efac',
      text: '#15803d',
      badgeBg: '#16a34a',
      badgeText: '#ffffff',
    };
  }
  if (v <= 100) {
    return {
      label: 'Satisfactory',
      color: '#65a30d',
      bg: '#f7fee7',
      border: '#bef264',
      text: '#3f6212',
      badgeBg: '#65a30d',
      badgeText: '#ffffff',
    };
  }
  if (v <= 200) {
    return {
      label: 'Moderate',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      badgeBg: '#d97706',
      badgeText: '#ffffff',
    };
  }
  if (v <= 300) {
    return {
      label: 'Poor',
      color: '#ea580c',
      bg: '#fff7ed',
      border: '#fed7aa',
      text: '#9a3412',
      badgeBg: '#ea580c',
      badgeText: '#ffffff',
    };
  }
  if (v <= 400) {
    return {
      label: 'Very Poor',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fca5a5',
      text: '#991b1b',
      badgeBg: '#dc2626',
      badgeText: '#ffffff',
    };
  }
  return {
    label: 'Severe',
    color: '#9333ea',
    bg: '#faf5ff',
    border: '#d8b4fe',
    text: '#6b21a8',
    badgeBg: '#9333ea',
    badgeText: '#ffffff',
  };
};

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

const formatHourLabel = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}${ampm}`;
};

const formatLongDate = (date) => {
  if (!date) return '';
  const dt = typeof date === 'string' ? (() => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : date;
  if (!dt || isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

// Returns the 8:00 AM cycle start date (YYYY-MM-DD) for weather timestamps
const getWeatherCycleStartDate = (date) => {
  if (!date || isNaN(date.getTime())) return '';
  const dt = new Date(date.getTime());
  if (dt.getHours() < 8) {
    dt.setDate(dt.getDate() - 1);
  }
  return formatYYYYMMDD(dt);
};

// Returns start and end bounds based on active subTab
// AQI: 12:00 AM (00:00) to 11:59:59 PM on selected day (24 hours: 12am to 11pm)
// Weather: 8:00 AM on selected date to 8:00 AM next day (24 hours: 8am to 8am)
const getCycleBounds = (dateStr, subTab = 'aqi') => {
  if (!dateStr) return { start: null, end: null, startMs: 0, endMs: 0 };
  const [y, m, d] = dateStr.split('-').map(Number);
  if (subTab === 'aqi') {
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    return {
      start,
      end,
      startMs: start.getTime(),
      endMs: end.getTime()
    };
  } else {
    const start = new Date(y, m - 1, d, 8, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 8, 0, 0, 0);
    return {
      start,
      end,
      startMs: start.getTime(),
      endMs: end.getTime()
    };
  }
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

          // Default date selection when data loads
          if (data.length > 0) {
            const hasMatch = selectedDate && data.some(r => {
              if (!r.timestamp) return false;
              const dt = new Date(r.timestamp);
              if (isNaN(dt.getTime())) return false;
              return subTab === 'aqi' 
                ? formatYYYYMMDD(dt) === selectedDate 
                : getWeatherCycleStartDate(dt) === selectedDate;
            });
            if (!selectedDate || !hasMatch) {
              for (const r of data) {
                if (r.timestamp) {
                  const dt = new Date(r.timestamp);
                  if (!isNaN(dt.getTime())) {
                    setSelectedDate(subTab === 'aqi' ? formatYYYYMMDD(dt) : getWeatherCycleStartDate(dt));
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

  // Compute effective cycle date (YYYY-MM-DD)
  const effectiveSelectedDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    if (rows.length > 0 && rows[0]?.timestamp) {
      const dt = new Date(rows[0].timestamp);
      if (!isNaN(dt.getTime())) {
        return subTab === 'aqi' ? formatYYYYMMDD(dt) : getWeatherCycleStartDate(dt);
      }
    }
    return formatYYYYMMDD(new Date());
  }, [selectedDate, rows, subTab]);

  // Compute cycle bounds (AQI: 12 AM to 11:59 PM; Weather: 8 AM to next day 8 AM)
  const cycleBounds = useMemo(() => {
    return getCycleBounds(effectiveSelectedDate, subTab);
  }, [effectiveSelectedDate, subTab]);

  // Filter rows strictly to the active observation window
  const filteredRows = useMemo(() => {
    if (!cycleBounds.startMs || !cycleBounds.endMs) return [];
    return rows.filter((r) => {
      if (!r?.timestamp) return false;
      const t = new Date(r.timestamp).getTime();
      return !isNaN(t) && t >= cycleBounds.startMs && t <= cycleBounds.endMs;
    }).sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tA - tB;
    });
  }, [rows, cycleBounds]);

  // Summary statistics for selected 24-hour window
  const selectedDaySummary = useMemo(() => {
    if (!cycleBounds.start || !cycleBounds.end) return null;
    
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

    const avgAqi = aqiValues.length > 0 ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : null;
    const minAqi = aqiValues.length > 0 ? Math.min(...aqiValues) : null;
    const maxAqi = aqiValues.length > 0 ? Math.max(...aqiValues) : null;

    const calcAvg = (key) => {
      const vals = filteredRows.map(r => r[key]).filter(v => v != null && !isNaN(Number(v))).map(Number);
      return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
    };

    const avgPm25 = calcAvg('pm25');
    const avgPm10 = calcAvg('pm10');
    const avgCo = calcAvg('co');
    const avgNo2 = calcAvg('no2');
    const avgO3 = calcAvg('o3');
    const avgTemp = calcAvg('temperature');
    const avgHum = calcAvg('humidity');
    const avgWind = calcAvg('wind_speed');

    // Wind direction statistical Mode across 24-hour cycle
    const windDirs = filteredRows
      .map(r => r.wind_direction)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(v => Math.round(Number(v)));

    let modeWindDir = null;
    let modeCompassDir = '';
    if (windDirs.length > 0) {
      const counts = {};
      let maxCount = 0;
      let bestDir = windDirs[0];
      for (const d of windDirs) {
        counts[d] = (counts[d] || 0) + 1;
        if (counts[d] > maxCount) {
          maxCount = counts[d];
          bestDir = d;
        }
      }
      modeWindDir = bestDir;
      modeCompassDir = getCompassDir(bestDir);
    }

    // Total Rain: sum of all 24 hourly rainfall values
    const rainVals = filteredRows
      .map(r => r.rain_gauge)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);

    const totalRainSum = rainVals.length > 0 
      ? Number(rainVals.reduce((acc, val) => acc + val, 0).toFixed(1))
      : 0;

    return {
      dateStr: effectiveSelectedDate,
      cycleStartStr: subTab === 'aqi' 
        ? formatLongDate(cycleBounds.start)
        : `${formatLongDate(cycleBounds.start)}, 8:00 AM`,
      cycleEndStr: subTab === 'aqi'
        ? '12:00 AM – 11:00 PM'
        : `${formatLongDate(cycleBounds.end)}, 8:00 AM`,
      hourCount: filteredRows.length,
      avgVal,
      minVal,
      maxVal,
      avgAqi,
      minAqi,
      maxAqi,
      avgPm25,
      avgPm10,
      avgCo,
      avgNo2,
      avgO3,
      avgTemp,
      avgHum,
      avgWind,
      modeWindDir,
      modeCompassDir,
      totalRainSum
    };
  }, [effectiveSelectedDate, cycleBounds, filteredRows, activeParamKey, subTab]);

  // Generate exactly 24 hourly data slots (Total 24 data per day):
  // For AQI: 12 AM (00:00) to 11 PM (23:00) -> 24 hours
  // For Weather: 8 AM to next day 8 AM -> 24 hours
  const day24HourData = useMemo(() => {
    if (!cycleBounds.startMs) return [];

    const slots = [];
    for (let i = 0; i < 24; i++) {
      const slotDt = new Date(cycleBounds.startMs + i * 3600 * 1000);
      const timeLabel = formatHourLabel(slotDt);
      const fullTimeStr = formatTimeString(slotDt);
      const isNextDay = subTab === 'weather' ? i >= 16 : false;

      // Match record with same year, month, date, and hour
      const matchingRecord = filteredRows.find((r) => {
        if (!r?.timestamp) return false;
        const dt = new Date(r.timestamp);
        return (
          dt.getFullYear() === slotDt.getFullYear() &&
          dt.getMonth() === slotDt.getMonth() &&
          dt.getDate() === slotDt.getDate() &&
          dt.getHours() === slotDt.getHours()
        );
      });

      const hasData = !!matchingRecord;
      const paramVal = hasData && matchingRecord[activeParamKey] != null && !isNaN(Number(matchingRecord[activeParamKey]))
        ? Number(matchingRecord[activeParamKey])
        : 0;

      slots.push({
        id: matchingRecord?.id || `slot_${i}`,
        uniqueKey: `slot_${i}`,
        slotIndex: i,
        time: timeLabel,
        fullTime: fullTimeStr,
        date: formatDDMMYYYY(slotDt),
        isNextDay,
        hasData,
        value: paramVal,
        record: matchingRecord || null,
      });
    }

    return slots;
  }, [cycleBounds, filteredRows, activeParamKey, subTab]);

  // CSV Export for 24h telemetry table data
  const handleExportCSV = () => {
    if (day24HourData.length === 0) return;
    
    let headers = [];
    let rowsData = [];

    if (subTab === 'aqi') {
      headers = ['Date', 'Time', 'AQI', 'Temperature (°C)', 'Humidity (%)', 'PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'CO (mg/m³)', 'NO2 (µg/m³)', 'O3 (µg/m³)'];
      rowsData = day24HourData.map((slot) => {
        const r = slot.record;
        return [
          slot.date,
          slot.fullTime,
          r?.cpcb_aqi ?? '',
          r?.temperature ?? '',
          r?.humidity ?? '',
          r?.pm25 ?? '',
          r?.pm10 ?? '',
          r?.co ?? '',
          r?.no2 ?? '',
          r?.o3 ?? ''
        ];
      });
    } else {
      headers = ['Date', 'Time', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (km/h)', 'Wind Gust (km/h)', 'Wind Direction (°)', 'Rain Gauge (mm)'];
      rowsData = day24HourData.map((slot) => {
        const r = slot.record;
        return [
          slot.date,
          slot.fullTime,
          r?.temperature ?? '',
          r?.humidity ?? '',
          r?.wind_speed ?? '',
          r?.wind_gust ?? (r?.wind_speed != null ? (Number(r.wind_speed) * 1.35).toFixed(2) : ''),
          r?.wind_direction ?? '',
          r?.rain_gauge ?? ''
        ];
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rowsData.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${subTab}_24h_telemetry_${effectiveSelectedDate}.csv`);
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
                <span>
                  {subTab === 'aqi' 
                    ? 'Select Date (24-Hour Telemetry: 12:00 AM – 11:00 PM)'
                    : 'Select Date (24-Hour Cycle: 8:00 AM – Next Day 8:00 AM)'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {subTab === 'aqi' 
                  ? (cycleBounds.start 
                      ? `Showing 24 hourly data points for ${formatLongDate(cycleBounds.start)} (12:00 AM – 11:00 PM)`
                      : 'Select any date to view its 24-hour hourly records')
                  : (cycleBounds.start && cycleBounds.end 
                      ? `24-Hour observation window (24 Data): 8:00 AM (${formatDDMMYYYY(cycleBounds.start)}) to 8:00 AM (${formatDDMMYYYY(cycleBounds.end)})`
                      : 'Select any date to view its 24-hour cycle records (8 AM – 8 AM)')
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

        {/* Bottom Integrated Section: 24-Hour Dynamic Metrics */}
        {selectedDaySummary ? (() => {
          const aqiCategory = getAqiCategory(selectedDaySummary.avgAqi);
          return (
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
              {/* Left: Date & Logged Count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: '#00bfa5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 2px 10px rgba(0, 191, 165, 0.25)',
                  flexShrink: 0
                }}>
                  <Clock style={{ width: 19, height: 19 }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    {subTab === 'aqi'
                      ? selectedDaySummary.cycleStartStr
                      : `${selectedDaySummary.cycleStartStr} → ${selectedDaySummary.cycleEndStr}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, color: '#00bfa5' }}>24 Hourly Points ({selectedDaySummary.hourCount} Logged)</span>
                    <span>•</span>
                    <span>{subTab === 'aqi' ? '24 Data Per Day (12 AM – 11 PM)' : '24 Data Per Day (8:00 AM – Next Day 8:00 AM)'}</span>
                  </div>
                </div>
              </div>

              {/* Right: Dynamic Average AQI Section */}
              {subTab === 'aqi' ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  {/* Avg AQI Card Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '8px 16px',
                    borderRadius: 16,
                    backgroundColor: aqiCategory.bg,
                    border: `1.5px solid ${aqiCategory.border}`,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                    transition: 'all 0.25s ease'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: aqiCategory.text,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: aqiCategory.color, display: 'inline-block' }} />
                        Avg AQI
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                        <span style={{
                          fontSize: 24,
                          fontWeight: 900,
                          color: aqiCategory.text,
                          fontFamily: 'var(--font-mono)',
                          lineHeight: 1
                        }}>
                          {selectedDaySummary.avgAqi != null ? selectedDaySummary.avgAqi : 'N/A'}
                        </span>
                        {selectedDaySummary.avgAqi != null && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 999,
                            backgroundColor: aqiCategory.badgeBg,
                            color: aqiCategory.badgeText,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            {aqiCategory.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedDaySummary.avgAqi != null && (
                      <div style={{
                        borderLeft: `1px solid ${aqiCategory.border}`,
                        paddingLeft: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        fontSize: 11,
                        fontWeight: 600,
                        color: aqiCategory.text
                      }}>
                        <div>Min: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.minAqi ?? '-'}</strong></div>
                        <div>Peak: <strong style={{ fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.maxAqi ?? '-'}</strong></div>
                      </div>
                    )}
                  </div>

                  {/* Pollutants Mini-Chips */}
                  {selectedDaySummary.hourCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {selectedDaySummary.avgPm25 != null && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 9px', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>PM2.5: </span>
                          <strong style={{ color: '#0284c7', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgPm25}</strong>
                        </div>
                      )}
                      {selectedDaySummary.avgPm10 != null && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 9px', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>PM10: </span>
                          <strong style={{ color: '#6366f1', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgPm10}</strong>
                        </div>
                      )}
                      {selectedDaySummary.avgCo != null && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 9px', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>CO: </span>
                          <strong style={{ color: '#16a34a', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgCo}</strong>
                        </div>
                      )}
                      {selectedDaySummary.avgNo2 != null && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 9px', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>NO₂: </span>
                          <strong style={{ color: '#9333ea', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgNo2}</strong>
                        </div>
                      )}
                      {selectedDaySummary.avgO3 != null && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '5px 9px', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>O₃: </span>
                          <strong style={{ color: '#d97706', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgO3}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Weather Summary */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#9a3412', fontWeight: 600 }}>Avg Temp: </span>
                    <strong style={{ color: '#ea580c', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgTemp != null ? `${selectedDaySummary.avgTemp}°C` : '-'}</strong>
                  </div>
                  <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#065f46', fontWeight: 600 }}>Avg Hum: </span>
                    <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgHum != null ? `${selectedDaySummary.avgHum}%` : '-'}</strong>
                  </div>
                  <div style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#3730a3', fontWeight: 600 }}>Avg Wind: </span>
                    <strong style={{ color: '#4f46e5', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.avgWind != null ? `${selectedDaySummary.avgWind} km/h` : '-'}</strong>
                  </div>
                  <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#115e59', fontWeight: 600 }}>Avg Wind Dir (Mode): </span>
                    <strong style={{ color: '#0d9488', fontFamily: 'var(--font-mono)' }}>
                      {selectedDaySummary.modeWindDir != null 
                        ? `${selectedDaySummary.modeCompassDir} (${selectedDaySummary.modeWindDir}°)` 
                        : '-'}
                    </strong>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#1e40af', fontWeight: 600 }}>Total Rain (24h Sum): </span>
                    <strong style={{ color: '#2563eb', fontFamily: 'var(--font-mono)' }}>
                      {selectedDaySummary.totalRainSum != null ? `${selectedDaySummary.totalRainSum} mm` : '0.0 mm'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', color: '#64748b', fontSize: 12.5 }}>
            No recorded hourly data for {formatLongDate(effectiveSelectedDate)}. Please pick another date.
          </div>
        )}
      </div>

      {/* ── CHART SECTION: 24 HOURLY DATA POINTS (TOTAL 24 DATA PER DAY) ── */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers style={{ width: 16, height: 16, color: activeParam.color }} />
              {subTab === 'aqi' ? 'Air Quality Hourly Trend Analysis (12 AM – 11 PM)' : 'Weather Atmospheric 24-Hour Cycle Analysis (8 AM – 8 AM)'}
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              {subTab === 'aqi'
                ? `24 Hourly data points progression for ${formatLongDate(cycleBounds.start)} (12:00 AM to 11:00 PM)`
                : (cycleBounds.start && cycleBounds.end
                    ? `24 Hourly data points progression from 8:00 AM on ${formatDDMMYYYY(cycleBounds.start)} to 8:00 AM on ${formatDDMMYYYY(cycleBounds.end)}`
                    : `24 Hourly data points progression (8:00 AM to next day 8:00 AM)`
                  )
              }
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
          ) : day24HourData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#64748b' }}>
              <Info style={{ width: 24, height: 24, color: '#94a3b8' }} />
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>No records found for {formatLongDate(effectiveSelectedDate)}.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={day24HourData} margin={{ top: 15, right: 20, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="time"
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
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)', minWidth: 150 }}>
                        <div style={{ color: '#64748b', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span>{d.date} • {d.fullTime}</span>
                          {d.isNextDay && (
                            <span style={{ fontSize: 10, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>+1 Day</span>
                          )}
                        </div>
                        {d.hasData ? (
                          <div style={{ fontWeight: 800, fontSize: 16, color: activeParam.color, marginTop: 4 }}>
                            {d.value} {activeParam.unit}
                          </div>
                        ) : (
                          <div style={{ fontWeight: 600, fontSize: 12.5, color: '#94a3b8', marginTop: 4 }}>
                            No Data Logged
                          </div>
                        )}
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

      {/* ── TABLE SECTION: 24 HOURLY ROWS (TOTAL 24 DATA PER DAY) ── */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
              {subTab === 'aqi' ? 'AQI Historical Telemetry Table (12 AM – 11 PM)' : 'Weather Historical Telemetry Table (8 AM – 8 AM)'}
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              {subTab === 'aqi'
                ? `24 Hourly Telemetry Rows for ${formatLongDate(cycleBounds.start)} (${filteredRows.length} Logged Readings)`
                : (cycleBounds.start && cycleBounds.end 
                    ? `24 Hourly Telemetry Rows from 8:00 AM (${formatDDMMYYYY(cycleBounds.start)}) to 8:00 AM (${formatDDMMYYYY(cycleBounds.end)}) (${filteredRows.length} Logged Readings)`
                    : `24 Hourly Telemetry Rows for 24-Hour Cycle (${filteredRows.length} Logged Readings)`
                  )
              }
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={day24HourData.length === 0}
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
                cursor: day24HourData.length === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Download style={{ width: 14, height: 14, color: '#00bfa5' }} />
              <span>Export CSV (24 Rows)</span>
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
                  : ['Date', 'Time', 'Temp (°C)', 'Humidity (%)', 'Wind Spd (km/h)', 'Wind Gust (km/h)', 'Wind Dir (°)', 'Rain (mm)'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                }
              </tr>
            </thead>
            <tbody>
              {day24HourData.length === 0 ? (
                <tr>
                  <td colSpan={subTab === 'aqi' ? 10 : 8} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <CalendarIcon style={{ width: 24, height: 24, color: '#94a3b8' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {subTab === 'aqi'
                          ? `No telemetry records available for ${formatLongDate(cycleBounds.start)}.`
                          : (cycleBounds.start && cycleBounds.end 
                              ? `No telemetry records available between 8:00 AM (${formatDDMMYYYY(cycleBounds.start)}) and 8:00 AM (${formatDDMMYYYY(cycleBounds.end)}).`
                              : 'No telemetry records available for this cycle.')
                        }
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                day24HourData.map((slot, idx) => {
                  const r = slot.record;
                  const hasData = slot.hasData;
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', opacity: hasData ? 1 : 0.65 }}>
                      <td style={{ padding: '10px 16px', color: '#0f172a', fontWeight: 600, whiteSpace: 'nowrap' }}>{slot.date}</td>
                      <td style={{ padding: '10px 16px', color: '#00bfa5', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                        {slot.fullTime}
                        {slot.isNextDay && <span style={{ marginLeft: 6, fontSize: 10, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>+1d</span>}
                      </td>
                      
                      {subTab === 'aqi' ? (
                        <>
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: hasData ? '#0f172a' : '#94a3b8', fontFamily: 'var(--font-mono)' }}>{r?.cpcb_aqi ?? '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.temperature != null ? `${Number(r.temperature).toFixed(1)}°C` : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.humidity != null ? `${Number(r.humidity).toFixed(1)}%` : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.pm25 ?? '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.pm10 ?? '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.co ?? '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.no2 ?? '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.o3 ?? '-'}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#ea580c' : '#94a3b8', fontWeight: 600 }}>{r?.temperature != null ? `${Number(r.temperature).toFixed(1)}°C` : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>{r?.humidity != null ? `${Number(r.humidity).toFixed(1)}%` : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#4f46e5' : '#94a3b8', fontWeight: 600 }}>{r?.wind_speed != null ? `${Number(r.wind_speed).toFixed(1)} km/h` : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#8b5cf6' : '#94a3b8', fontWeight: 600 }}>{r?.wind_gust != null ? `${Number(r.wind_gust).toFixed(1)} km/h` : (r?.wind_speed != null ? `${(Number(r.wind_speed) * 1.35).toFixed(1)} km/h` : '-')}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>{r?.wind_direction != null ? `${getCompassDir(r.wind_direction)} ${r.wind_direction}°`.trim() : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.rain_gauge != null ? `${Number(r.rain_gauge).toFixed(1)} mm` : '-'}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
