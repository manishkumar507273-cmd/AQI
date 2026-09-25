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
  Info,
  TrendingUp,
  BarChart2,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getCloudHistory, getCloudWeatherHistory, getCachedData, downloadHistoricalDataset, getAvailablePeriods } from '../api';
import { logUserActivity } from '../firebase';
import { useAuth } from '../context/AuthContext';

const START_YEAR = 2026;

const ALL_MONTHS = [
  { value: 1, label: '01 - January' },
  { value: 2, label: '02 - February' },
  { value: 3, label: '03 - March' },
  { value: 4, label: '04 - April' },
  { value: 5, label: '05 - May' },
  { value: 6, label: '06 - June' },
  { value: 7, label: '07 - July' },
  { value: 8, label: '08 - August' },
  { value: 9, label: '09 - September' },
  { value: 10, label: '10 - October' },
  { value: 11, label: '11 - November' },
  { value: 12, label: '12 - December' },
];

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
  { key: 'wind_direction', label: 'Wind Dir', unit: '', color: '#0284c7' },
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

const COMPASS_MAP = {
  'n': { deg: 0, abbr: 'N', name: 'North' },
  'north': { deg: 0, abbr: 'N', name: 'North' },
  'nne': { deg: 22.5, abbr: 'NNE', name: 'North-Northeast' },
  'northnortheast': { deg: 22.5, abbr: 'NNE', name: 'North-Northeast' },
  'ne': { deg: 45, abbr: 'NE', name: 'Northeast' },
  'northeast': { deg: 45, abbr: 'NE', name: 'Northeast' },
  'ene': { deg: 67.5, abbr: 'ENE', name: 'East-Northeast' },
  'eastnortheast': { deg: 67.5, abbr: 'ENE', name: 'East-Northeast' },
  'e': { deg: 90, abbr: 'E', name: 'East' },
  'east': { deg: 90, abbr: 'E', name: 'East' },
  'ese': { deg: 112.5, abbr: 'ESE', name: 'East-Southeast' },
  'eastsoutheast': { deg: 112.5, abbr: 'ESE', name: 'East-Southeast' },
  'se': { deg: 135, abbr: 'SE', name: 'Southeast' },
  'southeast': { deg: 135, abbr: 'SE', name: 'Southeast' },
  'sse': { deg: 157.5, abbr: 'SSE', name: 'South-Southeast' },
  'southsoutheast': { deg: 157.5, abbr: 'SSE', name: 'South-Southeast' },
  's': { deg: 180, abbr: 'S', name: 'South' },
  'south': { deg: 180, abbr: 'S', name: 'South' },
  'ssw': { deg: 202.5, abbr: 'SSW', name: 'South-Southwest' },
  'southsouthwest': { deg: 202.5, abbr: 'SSW', name: 'South-Southwest' },
  'sw': { deg: 225, abbr: 'SW', name: 'Southwest' },
  'southwest': { deg: 225, abbr: 'SW', name: 'Southwest' },
  'wsw': { deg: 247.5, abbr: 'WSW', name: 'West-Southwest' },
  'westsouthwest': { deg: 247.5, abbr: 'WSW', name: 'West-Southwest' },
  'w': { deg: 270, abbr: 'W', name: 'West' },
  'west': { deg: 270, abbr: 'W', name: 'West' },
  'wnw': { deg: 292.5, abbr: 'WNW', name: 'West-Northwest' },
  'westnorthwest': { deg: 292.5, abbr: 'WNW', name: 'West-Northwest' },
  'nw': { deg: 315, abbr: 'NW', name: 'Northwest' },
  'northwest': { deg: 315, abbr: 'NW', name: 'Northwest' },
  'nnw': { deg: 337.5, abbr: 'NNW', name: 'North-Northwest' },
  'northnorthwest': { deg: 337.5, abbr: 'NNW', name: 'North-Northwest' }
};

const COMPASS_DIRS = [
  { abbr: 'N', name: 'North', deg: 0 },
  { abbr: 'NNE', name: 'North-Northeast', deg: 22.5 },
  { abbr: 'NE', name: 'Northeast', deg: 45 },
  { abbr: 'ENE', name: 'East-Northeast', deg: 67.5 },
  { abbr: 'E', name: 'East', deg: 90 },
  { abbr: 'ESE', name: 'East-Southeast', deg: 112.5 },
  { abbr: 'SE', name: 'Southeast', deg: 135 },
  { abbr: 'SSE', name: 'South-Southeast', deg: 157.5 },
  { abbr: 'S', name: 'South', deg: 180 },
  { abbr: 'SSW', name: 'South-Southwest', deg: 202.5 },
  { abbr: 'SW', name: 'Southwest', deg: 225 },
  { abbr: 'WSW', name: 'West-Southwest', deg: 247.5 },
  { abbr: 'W', name: 'West', deg: 270 },
  { abbr: 'WNW', name: 'West-Northwest', deg: 292.5 },
  { abbr: 'NW', name: 'Northwest', deg: 315 },
  { abbr: 'NNW', name: 'North-Northwest', deg: 337.5 }
];

const parseWindDir = (val) => {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === 'N/A' || s === '-' || s === 'null' || s === 'undefined') return null;
  
  const numOnly = s.replace(/°/g, '').trim();
  if (!isNaN(Number(numOnly)) && numOnly !== '') {
    const deg = Math.round(((Number(numOnly) % 360) + 360) % 360);
    const item = COMPASS_DIRS[Math.round(deg / 22.5) % 16];
    return { deg, abbr: item.abbr, name: item.name, label: item.name };
  }

  const match = s.match(/([A-Za-z-]+)/);
  const clean = match ? match[1].toLowerCase().replace(/[\s_-]+/g, '') : s.toLowerCase().replace(/[\s_-]+/g, '');
  if (COMPASS_MAP[clean]) {
    const { deg, abbr, name } = COMPASS_MAP[clean];
    return { deg: Math.round(deg), abbr, name, label: name };
  }

  return { deg: null, abbr: s, name: s, label: s };
};

const getCompassDir = (val) => {
  if (val == null) return '';
  const parsed = parseWindDir(val);
  return parsed ? parsed.name : String(val);
};

const getRowParamValue = (row, paramKey) => {
  if (!row) return null;
  if (paramKey === 'wind_direction') {
    const p = parseWindDir(row.wind_direction);
    return p?.deg ?? null;
  }
  const val = row[paramKey];
  return (val != null && !isNaN(Number(val))) ? Number(val) : null;
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

// Returns canonical YYYY-MM-DD for any date or timestamp
const getWeatherCycleDate = (date) => {
  if (!date) return '';
  const dt = typeof date === 'string' ? (() => {
    if (date.includes('T')) return new Date(date);
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : date;
  if (!dt || isNaN(dt.getTime())) return '';
  return formatYYYYMMDD(dt);
};

// Returns start and end bounds for the selected calendar day (12:00 AM / 00:00 to 11:59:59 PM)
const getCycleBounds = (dateStr) => {
  if (!dateStr) return { start: null, end: null, startMs: 0, endMs: 0 };
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    start,
    end,
    startMs: start.getTime(),
    endMs: end.getTime()
  };
};

export default function Historical({ refreshKey, selectedStation = 'station-1' }) {
  const { currentUser } = useAuth();
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
  const [chartType, setChartType] = useState('area'); // 'area' | 'bar'

  // Track if user has manually picked a date
  const hasUserPickedDateRef = useRef(false);

  // Selected Date State: Defaults to latest recorded cycle date in data
  const [selectedDate, setSelectedDate] = useState(() => {
    const cached = getCachedData('CACHE_AQI_HISTORICAL') || [];
    if (cached.length > 0 && cached[0]?.timestamp) {
      const dt = new Date(cached[0].timestamp);
      if (!isNaN(dt.getTime())) return formatYYYYMMDD(dt);
    }
    return formatYYYYMMDD(new Date());
  });

  const [serverPeriods, setServerPeriods] = useState(null);

  // Fetch verified active periods with data from database
  useEffect(() => {
    let isMounted = true;
    getAvailablePeriods(subTab).then((res) => {
      if (isMounted && res?.periods) {
        setServerPeriods(res.periods);
      }
    });
    return () => { isMounted = false; };
  }, [subTab, refreshKey]);

  // Dynamically computes available years from 2026 forward
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let maxDataYear = START_YEAR;

    if (serverPeriods) {
      const serverYears = Object.keys(serverPeriods).map(Number).filter(y => !isNaN(y));
      if (serverYears.length > 0) {
        maxDataYear = Math.max(maxDataYear, ...serverYears);
      }
    }

    if (Array.isArray(rows)) {
      for (const r of rows) {
        const ts = r.timestamp || r.timestamp_hour || r.created_at;
        if (ts) {
          const y = new Date(ts).getFullYear();
          if (!isNaN(y) && y > maxDataYear) {
            maxDataYear = y;
          }
        }
      }
    }
    const endYear = Math.max(START_YEAR, currentYear, maxDataYear);
    const years = [];
    for (let y = START_YEAR; y <= endYear; y++) {
      years.push(y);
    }
    return years;
  }, [rows, serverPeriods]);

  const [selectedDatasetYear, setSelectedDatasetYear] = useState(() => {
    const currentYear = new Date().getFullYear();
    return currentYear >= 2026 ? currentYear : 2026;
  });

  // Compute active months for the currently selected year (strictly only months with data)
  const availableMonthsForYear = useMemo(() => {
    if (serverPeriods && serverPeriods[selectedDatasetYear]) {
      return serverPeriods[selectedDatasetYear];
    }
    const monthsSet = new Set();
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const ts = r.timestamp || r.timestamp_hour || r.created_at;
        if (ts && ts.length >= 7) {
          const y = parseInt(ts.slice(0, 4), 10);
          const m = parseInt(ts.slice(5, 7), 10);
          if (y === selectedDatasetYear && m >= 1 && m <= 12) {
            monthsSet.add(m);
          }
        }
      }
    }
    return Array.from(monthsSet).sort((a, b) => a - b);
  }, [serverPeriods, selectedDatasetYear, rows]);

  // Dynamic period options: ONLY lists months that actually contain data in database
  const periodOptions = useMemo(() => {
    const options = [];

    if (availableMonthsForYear.length > 0) {
      options.push({
        value: 'all',
        label: `Complete Year ${selectedDatasetYear} (${availableMonthsForYear.length} Active Month${availableMonthsForYear.length > 1 ? 's' : ''})`
      });
    }

    for (const mNum of availableMonthsForYear) {
      const monthObj = ALL_MONTHS.find(m => m.value === mNum);
      if (monthObj) {
        options.push(monthObj);
      }
    }

    return options;
  }, [availableMonthsForYear, selectedDatasetYear]);

  const [selectedDatasetMonth, setSelectedDatasetMonth] = useState('all'); // 'all' or 1..12

  // Sync selected month if previous selection has no data in current year
  useEffect(() => {
    if (periodOptions.length > 0) {
      const isValid = periodOptions.some(opt => opt.value === selectedDatasetMonth);
      if (!isValid) {
        setSelectedDatasetMonth(periodOptions[0].value);
      }
    }
  }, [periodOptions, selectedDatasetMonth]);

  const [isDownloadingDataset, setIsDownloadingDataset] = useState(false);
  const [datasetDownloadStatus, setDatasetDownloadStatus] = useState(null);

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
              return formatYYYYMMDD(dt) === selectedDate;
            });
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

    return () => {
      isMounted = false;
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
        return formatYYYYMMDD(dt);
      }
    }
    const now = new Date();
    return formatYYYYMMDD(now);
  }, [selectedDate, rows]);

  // Compute cycle bounds (12 AM to 11:59 PM)
  const cycleBounds = useMemo(() => {
    return getCycleBounds(effectiveSelectedDate);
  }, [effectiveSelectedDate]);

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

  // Summary statistics for selected observation window
  const selectedDaySummary = useMemo(() => {
    if (!cycleBounds.start || !cycleBounds.end) return null;
    
    const values = filteredRows
      .map(r => getRowParamValue(r, activeParamKey))
      .filter(v => v != null && !isNaN(Number(v)));

    const aqiValues = filteredRows
      .map(r => r.cpcb_aqi)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);

    const isTempOrHum = activeParamKey === 'temperature' || activeParamKey === 'humidity';
    const isAqiParam = activeParamKey === 'cpcb_aqi';
    const activeDecimals = isAqiParam ? 0 : (isTempOrHum ? 1 : 3);

    const avgVal = values.length > 0 ? (isAqiParam ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : (values.reduce((a, b) => a + b, 0) / values.length).toFixed(activeDecimals)) : 'N/A';
    const minVal = values.length > 0 ? (isAqiParam ? Math.round(Math.min(...values)) : Math.min(...values).toFixed(activeDecimals)) : 'N/A';
    const maxVal = values.length > 0 ? (isAqiParam ? Math.round(Math.max(...values)) : Math.max(...values).toFixed(activeDecimals)) : 'N/A';

    const avgAqi = aqiValues.length > 0 ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : null;
    const minAqi = aqiValues.length > 0 ? Math.round(Math.min(...aqiValues)) : null;
    const maxAqi = aqiValues.length > 0 ? Math.round(Math.max(...aqiValues)) : null;

    const calcAvg = (key, d = 3) => {
      const vals = filteredRows.map(r => r[key]).filter(v => v != null && !isNaN(Number(v))).map(Number);
      return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(d) : null;
    };

    const avgPm25 = calcAvg('pm25', 3);
    const avgPm10 = calcAvg('pm10', 3);
    const avgCo = calcAvg('co', 3);
    const avgNo2 = calcAvg('no2', 3);
    const avgO3 = calcAvg('o3', 3);
    const avgTemp = calcAvg('temperature', 1);
    const avgHum = calcAvg('humidity', 1);
    const avgWind = calcAvg('wind_speed', 3);

    // Wind direction statistical Mode across observation cycle
    const parsedDirs = filteredRows
      .map(r => parseWindDir(r.wind_direction))
      .filter(Boolean);

    let modeWindDir = null;
    let modeCompassDir = '';
    let modeDisplay = '-';
    if (parsedDirs.length > 0) {
      const counts = {};
      let maxCount = 0;
      let bestItem = parsedDirs[0];
      for (const item of parsedDirs) {
        const key = item.name || item.abbr || item.label;
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > maxCount) {
          maxCount = counts[key];
          bestItem = item;
        }
      }
      modeWindDir = bestItem.deg;
      modeCompassDir = bestItem.name;
      modeDisplay = bestItem.name;
    }

    // Total Rain: sum of all hourly rainfall values in observation cycle
    const rainVals = filteredRows
      .map(r => r.rain_gauge)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);

    const totalRainSum = rainVals.length > 0 
      ? Number(rainVals.reduce((acc, val) => acc + val, 0).toFixed(3))
      : 0;

    // Maximum Wind Gust across the day / observation cycle
    const gustVals = filteredRows
      .map(r => r.wind_gust)
      .filter(v => v != null && !isNaN(Number(v)))
      .map(Number);
    const maxWindGust = gustVals.length > 0 ? Math.max(...gustVals).toFixed(3) : null;

    return {
      dateStr: effectiveSelectedDate,
      cycleStartStr: formatLongDate(cycleBounds.start),
      cycleEndStr: '12:00 AM – 11:00 PM',
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
      maxWindGust,
      modeWindDir,
      modeCompassDir,
      modeDisplay,
      totalRainSum
    };
  }, [effectiveSelectedDate, cycleBounds, filteredRows, activeParamKey, subTab]);

  // Generate hourly data slots:
  // For AQI: 12 AM (00:00) to 11 PM (23:00) -> 24 hours
  // For Weather: 8 AM Day 1 to 8 AM Day 2 -> 25 hours (from 8 to 8)
  const day24HourData = useMemo(() => {
    if (!cycleBounds.startMs) return [];

    const slotCount = 24;
    const slots = [];
    for (let i = 0; i < slotCount; i++) {
      const slotDt = new Date(cycleBounds.startMs + i * 3600 * 1000);
      const timeLabel = formatHourLabel(slotDt);
      const fullTimeStr = formatTimeString(slotDt);

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
      let paramVal = 0;
      if (hasData) {
        const calculated = getRowParamValue(matchingRecord, activeParamKey);
        if (calculated != null) {
          paramVal = calculated;
        }
      }

      slots.push({
        id: matchingRecord?.id || `slot_${i}`,
        uniqueKey: `slot_${i}`,
        slotIndex: i,
        time: timeLabel,
        fullTime: fullTimeStr,
        date: formatDDMMYYYY(slotDt),
        isNextDay: false,
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
          r?.cpcb_aqi != null && !isNaN(Number(r.cpcb_aqi)) ? Math.round(Number(r.cpcb_aqi)) : (r?.cpcb_aqi ?? ''),
          r?.temperature != null && !isNaN(Number(r.temperature)) ? Number(r.temperature).toFixed(1) : '',
          r?.humidity != null && !isNaN(Number(r.humidity)) ? Number(r.humidity).toFixed(1) : '',
          r?.pm25 != null && !isNaN(Number(r.pm25)) ? Number(r.pm25).toFixed(3) : '',
          r?.pm10 != null && !isNaN(Number(r.pm10)) ? Number(r.pm10).toFixed(3) : '',
          r?.co != null && !isNaN(Number(r.co)) ? Number(r.co).toFixed(3) : '',
          r?.no2 != null && !isNaN(Number(r.no2)) ? Number(r.no2).toFixed(3) : '',
          r?.o3 != null && !isNaN(Number(r.o3)) ? Number(r.o3).toFixed(3) : ''
        ];
      });
    } else {
      headers = ['Date', 'Time', 'Temperature (°C)', 'Humidity (%)', 'Wind Speed (km/h)', 'Wind Gust (km/h)', 'Wind Direction', 'Rain Gauge (mm)'];
      rowsData = day24HourData.map((slot) => {
        const r = slot.record;
        return [
          slot.date,
          slot.fullTime,
          r?.temperature != null && !isNaN(Number(r.temperature)) ? Number(r.temperature).toFixed(1) : '',
          r?.humidity != null && !isNaN(Number(r.humidity)) ? Number(r.humidity).toFixed(1) : '',
          r?.wind_speed != null && !isNaN(Number(r.wind_speed)) ? Number(r.wind_speed).toFixed(3) : '',
          r?.wind_gust != null && !isNaN(Number(r.wind_gust)) ? Number(r.wind_gust).toFixed(3) : '',
          r?.wind_direction != null ? getCompassDir(r.wind_direction) : '',
          r?.rain_gauge != null && !isNaN(Number(r.rain_gauge)) ? Number(r.rain_gauge).toFixed(3) : ''
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

  // Bulk Dataset Download for full year or specific month
  const handleDownloadDataset = async () => {
    setIsDownloadingDataset(true);
    setDatasetDownloadStatus(null);
    try {
      const monthVal = selectedDatasetMonth === 'all' ? null : Number(selectedDatasetMonth);
      const res = await downloadHistoricalDataset({
        category: subTab,
        year: Number(selectedDatasetYear),
        month: monthVal
      });
      if (currentUser) {
        logUserActivity(currentUser, 'dataset_download', {
          category: subTab,
          year: Number(selectedDatasetYear),
          month: monthVal,
          filename: res.filename,
          recordCount: res.count
        });
      }
      setDatasetDownloadStatus({
        type: 'success',
        text: `Downloaded ${res.filename}${res.count != null ? ` (${res.count} records)` : ''}`
      });
      setTimeout(() => setDatasetDownloadStatus(null), 6000);
    } catch (err) {
      setDatasetDownloadStatus({
        type: 'error',
        text: err?.message || 'Download failed. Please check connection and try again.'
      });
      setTimeout(() => setDatasetDownloadStatus(null), 6000);
    } finally {
      setIsDownloadingDataset(false);
    }
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
        <div className="subtab-pill-container" style={{
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
            className="subtab-pill-btn"
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
            <span style={{ zIndex: 1 }} className="desktop-only-inline">AQI Historical Analytics</span>
            <span style={{ zIndex: 1 }} className="mobile-only-inline">AQI Analytics</span>
          </button>

          <button
            onClick={() => handleTabChange('weather')}
            className="subtab-pill-btn"
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
            <span style={{ zIndex: 1 }} className="desktop-only-inline">Weather Historical Analytics</span>
            <span style={{ zIndex: 1 }} className="mobile-only-inline">Weather Analytics</span>
          </button>
        </div>
      </div>

      {/* ── UNIFIED DATE SELECTOR & 24-HOUR SUMMARY CARD ── */}
      <div
        className="mobile-card-compact"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 24,
          padding: '20px 24px',
          border: '1.5px solid #00bfa5',
          boxShadow: '0 4px 20px rgba(0, 191, 165, 0.08)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        {/* Top Header Row: Date Selector & Controls */}
        <div className="mobile-stack" style={{
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
                <span className="desktop-only-inline">
                  Select Date (24-Hour Telemetry: 12:00 AM – 11:00 PM)
                </span>
                <span className="mobile-only-inline">
                  {subTab === 'weather' ? 'Weather Daily Records' : 'Daily Archive Records'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                <span className="desktop-only-inline">
                  {cycleBounds.start 
                    ? `Showing 24 hourly data points for ${formatLongDate(cycleBounds.start)} (12:00 AM – 11:00 PM)`
                    : 'Select any date to view its 24-hour hourly records'
                  }
                </span>
                <span className="mobile-only-inline">
                  24 hourly points • 12 AM – 11 PM
                </span>
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
                    {selectedDaySummary.cycleStartStr}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="desktop-only-inline" style={{ fontWeight: 700, color: '#00bfa5' }}>
                      24 Hourly Points ({selectedDaySummary.hourCount} Logged) • 12 AM – 11 PM
                    </span>
                    <span className="mobile-only-inline" style={{ fontWeight: 700, color: '#00bfa5' }}>
                      {selectedDaySummary.hourCount}/24 Hours Logged
                    </span>
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
                    <div className="filter-chips-container" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
                <div className="filter-chips-container" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                  <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#6b21a8', fontWeight: 600 }}>Max Wind Gust: </span>
                    <strong style={{ color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>{selectedDaySummary.maxWindGust != null ? `${selectedDaySummary.maxWindGust} km/h` : '-'}</strong>
                  </div>
                  <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: '6px 12px', fontSize: 11.5 }}>
                    <span style={{ color: '#115e59', fontWeight: 600 }}>Avg Wind Dir (Mode): </span>
                    <strong style={{ color: '#0d9488', fontFamily: 'var(--font-mono)' }}>
                      {selectedDaySummary.modeDisplay || '-'}
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
      <div className="mobile-card-compact" style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 24, border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers style={{ width: 16, height: 16, color: activeParam.color }} />
              <span className="desktop-only-inline">
                {subTab === 'aqi' ? 'Air Quality Hourly Trend Analysis (12 AM – 11 PM)' : 'Weather Hourly Trend Analysis (12 AM – 11 PM)'}
              </span>
              <span className="mobile-only-inline">
                {subTab === 'aqi' ? 'Hourly Air Quality Trend' : 'Hourly Weather Trend'}
              </span>
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              <span className="desktop-only-inline">
                24 Hourly data points progression for {formatLongDate(cycleBounds.start)} (12:00 AM to 11:00 PM)
              </span>
              <span className="mobile-only-inline">
                24-hour cycle ({formatLongDate(cycleBounds.start)})
              </span>
            </p>
          </div>

          {/* Right Action: Parameter Chips & Chart Type Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Chart Type Toggle */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setChartType('area')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartType === 'area' ? '#ffffff' : 'transparent',
                  color: chartType === 'area' ? '#0f172a' : '#64748b',
                  boxShadow: chartType === 'area' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <TrendingUp style={{ width: 13, height: 13, color: chartType === 'area' ? '#00bfa5' : '#64748b' }} />
                <span>Curve</span>
              </button>
              <button
                onClick={() => setChartType('bar')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: chartType === 'bar' ? '#ffffff' : 'transparent',
                  color: chartType === 'bar' ? '#0f172a' : '#64748b',
                  boxShadow: chartType === 'bar' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <BarChart2 style={{ width: 13, height: 13, color: chartType === 'bar' ? '#00bfa5' : '#64748b' }} />
                <span>Bars</span>
              </button>
            </div>

            {/* Parameter Filter Chips */}
            <div className="filter-chips-container" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', background: '#f8fafc', padding: 3, borderRadius: 999, border: '1px solid #e2e8f0', maxWidth: '100%' }}>
              {(subTab === 'aqi' ? AQI_PARAMS : WEATHER_PARAMS).map((p) => {
                const isSelected = subTab === 'aqi' ? selectedAqiParam === p.key : selectedWeatherParam === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => subTab === 'aqi' ? setSelectedAqiParam(p.key) : setSelectedWeatherParam(p.key)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      fontSize: 11.5, fontWeight: 600,
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
        </div>

        <div className="chart-responsive" style={{ width: '100%', height: 300, minWidth: 0 }}>
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
              {chartType === 'area' ? (
                <AreaChart data={day24HourData} margin={{ top: 12, right: 12, left: -16, bottom: 8 }}>
                  <defs>
                    <linearGradient id={`histGrad_${activeParam.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeParam.color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={activeParam.color} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={10.5}
                    tick={{ fill: '#64748b' }}
                    interval="preserveStartEnd"
                    minTickGap={22}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10.5}
                    tick={{ fill: '#64748b' }}
                    width={38}
                    domain={activeParam.key === 'cpcb_aqi' ? [0, 'auto'] : ['auto', 'auto']}
                  />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#ffffff',
                          borderRadius: 12,
                          padding: '10px 14px',
                          fontSize: 12,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                          minWidth: 150
                        }}>
                          <div style={{ color: '#94a3b8', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                            <span>{d.date} • {d.fullTime}</span>
                            {d.isNextDay && (
                              <span style={{ fontSize: 9.5, backgroundColor: '#0284c7', color: '#ffffff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>+1 Day</span>
                            )}
                          </div>
                          {d.hasData ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 18, color: activeParam.color, fontFamily: 'var(--font-mono)' }}>
                                {activeParam.key === 'wind_direction' && d.record?.wind_direction
                                  ? getCompassDir(d.record.wind_direction)
                                  : (d.value != null && !isNaN(Number(d.value))
                                      ? (activeParam.key === 'cpcb_aqi'
                                          ? Math.round(Number(d.value))
                                          : Number(d.value).toFixed(activeParam.key === 'temperature' || activeParam.key === 'humidity' ? 1 : 3))
                                      : d.value)}
                              </span>
                              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                                {activeParam.key === 'wind_direction' ? '' : activeParam.unit}
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: '#94a3b8' }}>
                              No Data Logged
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={activeParam.label}
                    stroke={activeParam.color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#histGrad_${activeParam.key})`}
                    dot={false}
                    activeDot={{ r: 5, fill: activeParam.color, stroke: '#ffffff', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              ) : (
                <BarChart data={day24HourData} margin={{ top: 12, right: 12, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="time"
                    stroke="#94a3b8"
                    fontSize={10.5}
                    tick={{ fill: '#64748b' }}
                    interval="preserveStartEnd"
                    minTickGap={22}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={10.5}
                    tick={{ fill: '#64748b' }}
                    width={38}
                    domain={activeParam.key === 'cpcb_aqi' ? [0, 'auto'] : ['auto', 'auto']}
                  />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#ffffff',
                          borderRadius: 12,
                          padding: '10px 14px',
                          fontSize: 12,
                          boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
                          minWidth: 150
                        }}>
                          <div style={{ color: '#94a3b8', fontSize: 10.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                            <span>{d.date} • {d.fullTime}</span>
                            {d.isNextDay && (
                              <span style={{ fontSize: 9.5, backgroundColor: '#0284c7', color: '#ffffff', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>+1 Day</span>
                            )}
                          </div>
                          {d.hasData ? (
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                              <span style={{ fontWeight: 800, fontSize: 18, color: activeParam.color, fontFamily: 'var(--font-mono)' }}>
                                {activeParam.key === 'wind_direction' && d.record?.wind_direction
                                  ? getCompassDir(d.record.wind_direction)
                                  : (d.value != null && !isNaN(Number(d.value))
                                      ? (activeParam.key === 'cpcb_aqi'
                                          ? Math.round(Number(d.value))
                                          : Number(d.value).toFixed(activeParam.key === 'temperature' || activeParam.key === 'humidity' ? 1 : 3))
                                      : d.value)}
                              </span>
                              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                                {activeParam.key === 'wind_direction' ? '' : activeParam.unit}
                              </span>
                            </div>
                          ) : (
                            <div style={{ fontWeight: 600, fontSize: 11.5, color: '#94a3b8' }}>
                              No Data Logged
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar
                    dataKey="value"
                    fill={activeParam.color}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── TABLE SECTION: 24 HOURLY ROWS (TOTAL 24 DATA PER DAY) ── */}
      <div className="mobile-card-compact" style={{ backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ padding: '20px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
              <span className="desktop-only-inline">{subTab === 'aqi' ? 'AQI Historical Telemetry Table (12 AM – 11 PM)' : 'Weather Historical Telemetry Table (12 AM – 11 PM)'}</span>
              <span className="mobile-only-inline">{subTab === 'aqi' ? 'Hourly AQI Table' : 'Hourly Weather Table'}</span>
            </h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2, margin: 0 }}>
              24 Hourly Telemetry Rows for {formatLongDate(cycleBounds.start)} ({filteredRows.length} Logged Readings)
            </p>
          </div>

        </div>

        {/* ── Bulk Dataset Download Bar (Complete Year / Month) ── */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div className="mobile-stack" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
              <FileSpreadsheet style={{ width: 17, height: 17, color: '#00bfa5' }} />
              <span>Bulk Dataset Download:</span>
            </div>

            {/* Year Selector (2026 and forward dynamically) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Year:</label>
              <select
                value={selectedDatasetYear}
                onChange={(e) => setSelectedDatasetYear(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#0f172a',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Selector (Only months that actually contain data in database) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Period:</label>
              <select
                value={selectedDatasetMonth}
                onChange={(e) => setSelectedDatasetMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                disabled={periodOptions.length === 0}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: periodOptions.length === 0 ? '#f1f5f9' : '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: periodOptions.length === 0 ? '#94a3b8' : '#0f172a',
                  cursor: periodOptions.length === 0 ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)'
                }}
              >
                {periodOptions.length === 0 ? (
                  <option value="" disabled>
                    No recorded data for {selectedDatasetYear}
                  </option>
                ) : (
                  periodOptions.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Download Dataset Button */}
            <button
              onClick={handleDownloadDataset}
              disabled={isDownloadingDataset || periodOptions.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 18px',
                borderRadius: 999,
                border: 'none',
                backgroundColor: (isDownloadingDataset || periodOptions.length === 0) ? '#94a3b8' : '#00bfa5',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: (isDownloadingDataset || periodOptions.length === 0) ? 'not-allowed' : 'pointer',
                boxShadow: (isDownloadingDataset || periodOptions.length === 0) ? 'none' : '0 2px 10px rgba(0, 191, 165, 0.28)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {isDownloadingDataset ? (
                <>
                  <RefreshCw style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                  <span>Preparing Dataset...</span>
                </>
              ) : periodOptions.length === 0 ? (
                <>
                  <Download style={{ width: 14, height: 14 }} />
                  <span>No Records in {selectedDatasetYear}</span>
                </>
              ) : (
                <>
                  <Download style={{ width: 14, height: 14 }} />
                  <span>
                    Download {subTab === 'aqi' ? 'AQI' : 'Weather'}{' '}
                    {selectedDatasetMonth === 'all'
                      ? `Year ${selectedDatasetYear}`
                      : ALL_MONTHS.find((m) => m.value === selectedDatasetMonth)?.label || 'Month'}{' '}
                    Dataset
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Success / Error notification badge */}
          {datasetDownloadStatus && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: 8,
              backgroundColor: datasetDownloadStatus.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: datasetDownloadStatus.type === 'success' ? '#047857' : '#b91c1c',
              border: `1px solid ${datasetDownloadStatus.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            }}>
              {datasetDownloadStatus.type === 'success' && <CheckCircle2 style={{ width: 14, height: 14 }} />}
              <span>{datasetDownloadStatus.text}</span>
            </div>
          )}
        </div>

        <div className="table-responsive-wrapper" style={{ maxHeight: 440 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, minWidth: 750 }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', zIndex: 2 }}>
              <tr style={{ color: '#475569', fontSize: 12 }}>
                {subTab === 'aqi'
                  ? ['Date', 'Time', 'AQI', 'Temp (°C)', 'Humidity (%)', 'PM2.5 (µg/m³)', 'PM10 (µg/m³)', 'CO (mg/m³)', 'NO₂ (µg/m³)', 'O₃ (µg/m³)'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                    ))
                  : ['Date', 'Time', 'Temp (°C)', 'Humidity (%)', 'Wind Spd (km/h)', 'Wind Gust (km/h)', 'Wind Dir', 'Rain (mm)'].map((h) => (
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
                        {cycleBounds.start 
                          ? `No telemetry records available for ${formatLongDate(cycleBounds.start)}.`
                          : 'No telemetry records available for this date.'}
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
                        {slot.isNextDay && (
                          <span style={{
                            marginLeft: 6,
                            fontSize: 10,
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            padding: '1px 5px',
                            borderRadius: 4,
                            fontWeight: 700,
                            fontFamily: 'var(--font-sans)',
                            display: 'inline-block'
                          }}>
                            +1d
                          </span>
                        )}
                      </td>
                      
                      {subTab === 'aqi' ? (
                        <>
                          <td style={{ padding: '10px 16px', fontWeight: 800, color: hasData ? '#0f172a' : '#94a3b8', fontFamily: 'var(--font-mono)' }}>{r?.cpcb_aqi != null && !isNaN(Number(r.cpcb_aqi)) ? Math.round(Number(r.cpcb_aqi)) : (r?.cpcb_aqi ?? '-')}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.temperature != null && !isNaN(Number(r.temperature)) ? Number(r.temperature).toFixed(1) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.humidity != null && !isNaN(Number(r.humidity)) ? Number(r.humidity).toFixed(1) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.pm25 != null && !isNaN(Number(r.pm25)) ? Number(r.pm25).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.pm10 != null && !isNaN(Number(r.pm10)) ? Number(r.pm10).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.co != null && !isNaN(Number(r.co)) ? Number(r.co).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.no2 != null && !isNaN(Number(r.no2)) ? Number(r.no2).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.o3 != null && !isNaN(Number(r.o3)) ? Number(r.o3).toFixed(3) : '-'}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#ea580c' : '#94a3b8', fontWeight: 600 }}>{r?.temperature != null && !isNaN(Number(r.temperature)) ? Number(r.temperature).toFixed(1) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>{r?.humidity != null && !isNaN(Number(r.humidity)) ? Number(r.humidity).toFixed(1) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData ? '#4f46e5' : '#94a3b8', fontWeight: 600 }}>{r?.wind_speed != null && !isNaN(Number(r.wind_speed)) ? Number(r.wind_speed).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: hasData && r?.wind_gust != null ? '#8b5cf6' : '#94a3b8', fontWeight: 600 }}>{r?.wind_gust != null && !isNaN(Number(r.wind_gust)) ? Number(r.wind_gust).toFixed(3) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-sans)', color: hasData ? '#0284c7' : '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{r?.wind_direction != null ? getCompassDir(r.wind_direction) : '-'}</td>
                          <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{r?.rain_gauge != null && !isNaN(Number(r.rain_gauge)) ? Number(r.rain_gauge).toFixed(3) : '-'}</td>
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
