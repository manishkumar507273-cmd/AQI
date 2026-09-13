import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  RefreshCw,
  Layers,
  Activity,
  Thermometer,
  Droplets,
  Wind,
  Table as TableIcon,
  BarChart2,
  Sliders,
  TrendingUp,
  ArrowLeftRight,
  TrendingDown,
  Minus,
  History,
  Info,
  CheckCircle2,
  Clock,
  Calendar,
  Filter,
  Radio
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { getAqiForecast, getCloudHistory, getCachedData, getTimeAgo, getForecastRegistry, saveToForecastRegistry } from '../api';

const PARAM_CONFIG = {
  aqi: { name: 'Air Quality Index (AQI)', key: 'aqi', unit: 'AQI', color: '#00bfa5', desc: 'CPCB India composite air quality index' },
  pm25: { name: 'PM2.5', key: 'pm25', unit: 'µg/m³', color: '#0ea5e9', desc: 'Fine inhalable particulate matter' },
  pm10: { name: 'PM10', key: 'pm10', unit: 'µg/m³', color: '#6366f1', desc: 'Coarse respirable dust particles' },
  co: { name: 'Carbon Monoxide', key: 'co', unit: 'mg/m³', color: '#64748b', desc: 'Combustion byproduct' },
  no2: { name: 'Nitrogen Dioxide', key: 'no2', unit: 'µg/m³', color: '#f59e0b', desc: 'Combustion emissions' },
  o3: { name: 'Ozone', key: 'o3', unit: 'µg/m³', color: '#10b981', desc: 'Photochemical ground-level oxidant' },
  temperature: { name: 'Temperature', key: 'temperature', unit: '°C', color: '#f43f5e', desc: 'Ambient thermal measurement' },
  humidity: { name: 'Humidity', key: 'humidity', unit: '%', color: '#06b6d4', desc: 'Relative atmospheric moisture' }
};


// CPCB AQI Breakpoints (India Standard): [C_LO, C_HI, I_LO, I_HI]
// Formula: Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO
const CPCB_BREAKPOINTS = {
  pm25: [
    [0.0, 30.0, 0, 50],
    [30.0, 60.0, 51, 100],
    [60.0, 90.0, 101, 200],
    [90.0, 120.0, 201, 300],
    [120.0, 250.0, 301, 400],
    [250.0, 500.0, 401, 500]
  ],
  pm10: [
    [0.0, 50.0, 0, 50],
    [50.0, 100.0, 51, 100],
    [100.0, 250.0, 101, 200],
    [250.0, 350.0, 201, 300],
    [350.0, 430.0, 301, 400],
    [430.0, 600.0, 401, 500]
  ],
  co: [
    [0.0, 1.0, 0, 50],
    [1.0, 2.0, 51, 100],
    [2.0, 10.0, 101, 200],
    [10.0, 17.0, 201, 300],
    [17.0, 34.0, 301, 400],
    [34.0, 50.0, 401, 500]
  ],
  no2: [
    [0.0, 40.0, 0, 50],
    [40.0, 80.0, 51, 100],
    [80.0, 180.0, 101, 200],
    [180.0, 280.0, 201, 300],
    [280.0, 400.0, 301, 400],
    [400.0, 500.0, 401, 500]
  ],
  o3: [
    [0.0, 50.0, 0, 50],
    [50.0, 100.0, 51, 100],
    [100.0, 168.0, 101, 200],
    [168.0, 208.0, 201, 300],
    [208.0, 748.0, 301, 400],
    [748.0, 1000.0, 401, 500]
  ]
};

const calculateSubIndex = (paramKey, cp) => {
  const tiers = CPCB_BREAKPOINTS[paramKey];
  if (!tiers) return 0;
  const val = Math.max(0, Number(cp) || 0);
  for (let i = 0; i < tiers.length; i++) {
    const [cLo, cHi, iLo, iHi] = tiers[i];
    if (val <= cHi) {
      const ip = ((iHi - iLo) / (cHi - cLo)) * (val - cLo) + iLo;
      return Math.round(Math.max(0, ip));
    }
  }
  const [cLo, cHi, iLo, iHi] = tiers[tiers.length - 1];
  const ip = ((iHi - iLo) / (cHi - cLo)) * (val - cLo) + iLo;
  return Math.min(500, Math.round(Math.max(0, ip)));
};

const getAqiCategory = (val) => {
  const v = Math.round(Number(val) || 0);
  if (v <= 50) return { label: 'Good', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
  if (v <= 100) return { label: 'Satisfactory', color: '#65a30d', bg: '#f7fee7', border: '#d9f99d' };
  if (v <= 200) return { label: 'Moderate', color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
  if (v <= 300) return { label: 'Poor', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
  if (v <= 400) return { label: 'Very Poor', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
  return { label: 'Severe', color: '#7f1d1d', bg: '#fdf2f8', border: '#fbcfe8' };
};

const computeAqiForRow = (row) => {
  if (row.aqi !== undefined && row.aqi !== null && row.dominant_pollutant) {
    const cat = getAqiCategory(row.aqi);
    return {
      aqi: row.aqi,
      dominant: row.dominant_pollutant,
      category: cat,
      subIndices: row.sub_indices || {}
    };
  }
  const pm25Sub = calculateSubIndex('pm25', row.pm25);
  const pm10Sub = calculateSubIndex('pm10', row.pm10);
  const coSub = calculateSubIndex('co', row.co);
  const no2Sub = calculateSubIndex('no2', row.no2);
  const o3Sub = calculateSubIndex('o3', row.o3);

  const subMap = [
    { key: 'pm25', name: 'PM2.5', val: pm25Sub },
    { key: 'pm10', name: 'PM10', val: pm10Sub },
    { key: 'co', name: 'CO', val: coSub },
    { key: 'no2', name: 'NO₂', val: no2Sub },
    { key: 'o3', name: 'O₃', val: o3Sub }
  ];
  subMap.sort((a, b) => b.val - a.val);
  const maxSub = subMap[0].val;
  const dominant = subMap[0].name;
  return {
    aqi: maxSub,
    dominant,
    category: getAqiCategory(maxSub),
    subIndices: { pm25: pm25Sub, pm10: pm10Sub, co: coSub, no2: no2Sub, o3: o3Sub }
  };
};

export default function Forecast({ refreshKey, selectedStation }) {
  const cachedInitial = useMemo(() => getCachedData('CACHE_AQI_LSTM_FORECAST_24H'), []);
  const [forecastData, setForecastData] = useState(cachedInitial);
  const [historicalList, setHistoricalList] = useState(() => {
    const cached = getCachedData('CACHE_AQI_HISTORICAL');
    return Array.isArray(cached) ? cached : [];
  });
  const [loading, setLoading] = useState(!cachedInitial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('aqi'); // 'aqi' | 'pollutants' | 'comparison'
  const [compareParam, setCompareParam] = useState('aqi');
  const [scheduleFilter, setScheduleFilter] = useState('all'); // 'all' | 'verified' | 'pending'
  const [visiblePollutants, setVisiblePollutants] = useState({
    pm25: true,
    pm10: true,
    co: true,
    no2: true,
    o3: true
  });
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  const fetchForecast = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
      try {
        localStorage.removeItem('CACHE_AQI_LSTM_FORECAST_24H');
        localStorage.removeItem('CACHE_AQI_COMPARISON');
        localStorage.removeItem('CACHE_AQI_FORECAST_REGISTRY');
      } catch (e) {}
    } else if (!forecastData) {
      setLoading(true);
    }
    setError(null);

    try {
      const [fcRes, histRes] = await Promise.all([
        getAqiForecast(isManual),
        getCloudHistory(48)
      ]);

      if (fcRes.data && fcRes.data.status === 'success' && Array.isArray(fcRes.data.forecast)) {
        setForecastData(fcRes.data);
        saveToForecastRegistry(fcRes.data.forecast);
        setLastRefreshed(Date.now());
      } else if (!forecastData) {
        setError(fcRes.data?.message || 'Unable to generate telemetry forecast from LSTM model.');
      }

      if (histRes.data && Array.isArray(histRes.data.history) && histRes.data.history.length > 0) {
        setHistoricalList(histRes.data.history);
      }
    } catch (err) {
      console.error('Forecast fetch failed:', err);
      if (!forecastData) {
        setError('Connection to backend LSTM forecast engine failed.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, [refreshKey, selectedStation]);

  // Periodic real-time background sync: poll every 45s to dynamically ingest newly arrived telemetry
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchForecast(false);
    }, 45000);
    return () => clearInterval(pollInterval);
  }, []);

  const rawForecastList = useMemo(() => forecastData?.forecast || [], [forecastData]);
  const summary = forecastData?.summary || {};


  // Enrich each forecast step with formula-derived AQI, Category, and Dominant Pollutant
  const forecastList = useMemo(() => {
    return rawForecastList.map((item) => {
      const aqiRes = computeAqiForRow(item);
      return {
        ...item,
        aqi: item.aqi ?? aqiRes.aqi,
        dominant_pollutant: item.dominant_pollutant ?? aqiRes.dominant,
        aqi_category: item.aqi_info?.label ?? aqiRes.category.label,
        aqi_color: item.aqi_info?.color ?? aqiRes.category.color,
        aqi_bg: aqiRes.category.bg,
        aqi_border: aqiRes.category.border,
        sub_indices: item.sub_indices ?? aqiRes.subIndices
      };
    });
  }, [rawForecastList]);

  // Overall 24-Hour Projected AQI Summary
  const aqiSummary = useMemo(() => {
    if (summary.aqi_stats && summary.aqi_stats.avg_aqi !== undefined) {
      const st = summary.aqi_stats;
      return {
        avg: st.avg_aqi,
        min: st.min_aqi,
        max: st.max_aqi,
        peakTime: st.peak_display_time || st.peak_hour,
        dominant: st.dominant_pollutant,
        category: getAqiCategory(st.avg_aqi)
      };
    }
    if (!forecastList || forecastList.length === 0) return null;
    const aqiVals = forecastList.map((f) => f.aqi);
    const avg = Math.round(aqiVals.reduce((a, b) => a + b, 0) / aqiVals.length);
    const max = Math.max(...aqiVals);
    const min = Math.min(...aqiVals);
    const peakIdx = aqiVals.indexOf(max);
    const doms = forecastList.map((f) => f.dominant_pollutant);
    const mostDom = max > 0 ? (doms.sort((a,b) => doms.filter(v => v===a).length - doms.filter(v => v===b).length).pop()) : 'PM2.5';
    return {
      avg,
      min,
      max,
      peakTime: forecastList[peakIdx]?.display_time || '',
      dominant: mostDom,
      category: getAqiCategory(avg)
    };
  }, [summary.aqi_stats, forecastList]);

  // Compute parameter statistics dynamically
  const paramStats = useMemo(() => {
    const fromSummary = summary.parameter_stats;
    if (fromSummary && Object.keys(fromSummary).length > 0 && fromSummary.pm25 && fromSummary.pm25.avg !== undefined) {
      return fromSummary;
    }
    if (!forecastList || forecastList.length === 0) return {};
    const keys = ['pm25', 'pm10', 'co', 'no2', 'o3', 'temperature', 'humidity'];
    const res = {};
    keys.forEach((k) => {
      const vals = forecastList
        .map((item) => (item[k] !== undefined && item[k] !== null ? Number(item[k]) : NaN))
        .filter((v) => !isNaN(v));

      if (vals.length > 0) {
        const minVal = Math.min(...vals);
        const maxVal = Math.max(...vals);
        const avgVal = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(k === 'co' ? 3 : 1));
        const maxIndex = vals.indexOf(maxVal);
        const minIndex = vals.indexOf(minVal);

        res[k] = {
          avg: avgVal,
          min: minVal,
          max: maxVal,
          peak_hour: forecastList[maxIndex]?.hour_label || '',
          peak_display_time: forecastList[maxIndex]?.display_time || '',
          lowest_hour: forecastList[minIndex]?.hour_label || '',
          lowest_display_time: forecastList[minIndex]?.display_time || ''
        };
      }
    });
    return res;
  }, [summary.parameter_stats, forecastList]);

  const togglePollutant = (key) => {
    setVisiblePollutants((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Process historical telemetry in chronological order (past to present) with CPCB AQI
  const processedHistorical = useMemo(() => {
    if (!historicalList || historicalList.length === 0) return [];
    const recent = [...historicalList].slice(0, 24).reverse();
    return recent.map((item, idx) => {
      const aqiRes = computeAqiForRow(item);
      const dt = item.timestamp ? new Date(item.timestamp) : null;
      const displayTime = dt && !isNaN(dt.getTime())
        ? dt.toLocaleTimeString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
        : `T-${recent.length - idx}h`;
      return {
        ...item,
        display_time: displayTime,
        aqi: item.cpcb_aqi ?? item.aqi ?? aqiRes.aqi,
        dominant_pollutant: item.dominant_pollutant ?? aqiRes.dominant,
        aqi_category: aqiRes.category.label,
        aqi_color: aqiRes.category.color,
        aqi_bg: aqiRes.category.bg,
        aqi_border: aqiRes.category.border,
        sub_indices: aqiRes.subIndices
      };
    });
  }, [historicalList]);

  // Extract normalized hour key: "YYYY-MM-DD HH:00"
  const getHourSlotKey = (val) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      if (typeof val === 'string' && val.length >= 13) {
        return val.slice(0, 13).replace('T', ' ') + ':00';
      }
      return null;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:00`;
  };

  const formatSlotDisplayTime = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    if (isYesterday) return `Yesterday ${timeStr}`;
    return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${timeStr}`;
  };

  // 2. Same Time-Point Forecast vs Historical Telemetry Dataset
  // Aligns forecast and historical actuals by identical time points.
  // Future hours (where actuals are not yet available) have historical_val=null (blank placeholder).
  // When telemetry arrives dynamically, it is automatically joined to the exact timestamp row.
  const sameTimeComparisonData = useMemo(() => {
    if (!forecastList && !historicalList) return [];
    const targetKey = compareParam === 'aqi' ? 'aqi' : compareParam;

    // 1. Gather all forecast points from current forecast and persistent archive
    const registry = getForecastRegistry();
    const fcMap = {};

    Object.values(registry).forEach((item) => {
      const ts = item.timestamp || item.hour_iso;
      const k = getHourSlotKey(ts);
      if (k) {
        fcMap[k] = { ...item, ...computeAqiForRow(item) };
      }
    });

    (forecastList || []).forEach((item) => {
      const ts = item.timestamp || item.hour_iso;
      const k = getHourSlotKey(ts);
      if (k) {
        fcMap[k] = item;
      }
    });

    // 2. Gather historical telemetry points
    const histMap = {};
    (processedHistorical || []).forEach((item) => {
      const ts = item.timestamp || item.timestamp_hour;
      const k = getHourSlotKey(ts);
      if (k) {
        histMap[k] = item;
      }
    });

    // 3. Union of time keys within a focused window
    const now = new Date();
    const pastLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const futureLimit = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const fcKeys = Object.keys(fcMap).sort();
    const earliestFc = fcKeys.length > 0 ? new Date(fcKeys[0]) : now;
    // For focused forecast window: start from whichever is earlier: earliest forecast hour or 3 hours before current time
    const focusedPastLimit = new Date(Math.min(now.getTime() - 3 * 60 * 60 * 1000, earliestFc.getTime()));

    const allKeys = Array.from(new Set([...Object.keys(fcMap), ...Object.keys(histMap)])).filter((k) => {
      const dt = new Date(k);
      return !isNaN(dt.getTime()) && dt >= focusedPastLimit && dt <= futureLimit;
    });

    allKeys.sort();

    return allKeys.map((slotKey, idx) => {
      const fcItem = fcMap[slotKey];
      const histItem = histMap[slotKey];
      const refDate = new Date(slotKey);

      const fcVal = fcItem ? (targetKey === 'aqi' ? fcItem.aqi : Number(fcItem[targetKey] ?? 0)) : null;
      const histVal = histItem ? (targetKey === 'aqi' ? (histItem.aqi ?? histItem.cpcb_aqi ?? 0) : Number(histItem[targetKey] ?? 0)) : null;

      const diffMs = refDate.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      const horizonLabel = diffHours === 0 ? 'Now' : (diffHours > 0 ? `+${diffHours}h` : `${diffHours}h`);
      const isFuture = diffHours > 0;

      const isPending = histVal === null;
      const hasFc = fcVal !== null;

      let delta = null;
      let deltaPct = null;
      if (fcVal !== null && histVal !== null) {
        delta = Number((fcVal - histVal).toFixed(targetKey === 'co' ? 3 : 1));
        deltaPct = histVal !== 0 ? Number(((delta / histVal) * 100).toFixed(1)) : 0;
      }

      let status = 'awaiting_data';
      if (!isPending && hasFc) {
        status = 'verified';
      } else if (!isPending && !hasFc) {
        status = 'historical_only';
      } else {
        status = 'awaiting_data';
      }

      return {
        slot_key: slotKey,
        step_index: idx + 1,
        step_label: horizonLabel,
        display_time: formatSlotDisplayTime(slotKey),
        hour_time: refDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timestamp: slotKey,
        is_future: isFuture,
        is_pending: isPending,
        status,
        historical_val: histVal,
        forecast_val: fcVal,
        delta,
        deltaPct,
        hist_aqi: histItem?.aqi,
        hist_cat: histItem?.aqi_category,
        hist_color: histItem?.aqi_color,
        fc_aqi: fcItem?.aqi,
        fc_cat: fcItem?.aqi_category,
        fc_color: fcItem?.aqi_color,
        fc_item: fcItem,
        hist_item: histItem
      };
    });
  }, [forecastList, processedHistorical, compareParam]);

  // Alias for backward compatibility
  const overlayComparisonData = sameTimeComparisonData;

  // Comparative KPIs for same-time points
  const comparisonKpis = useMemo(() => {
    if (!sameTimeComparisonData || sameTimeComparisonData.length === 0) return null;
    const verified = sameTimeComparisonData.filter((d) => d.status === 'verified' && d.historical_val !== null && d.forecast_val !== null);
    const pending = sameTimeComparisonData.filter((d) => d.status === 'awaiting_data' && d.forecast_val !== null);
    const nonFutureWithHist = sameTimeComparisonData.filter((d) => !d.is_future && d.historical_val !== null);

    const latestSensorSlot = nonFutureWithHist[nonFutureWithHist.length - 1] || null;
    const nextForecastSlot = pending[0] || null;

    const isWeather = compareParam === 'temperature' || compareParam === 'humidity';

    const fcVals = (pending.length > 0 ? pending : verified).map((d) => d.forecast_val).filter((v) => v !== null && !isNaN(v));
    const fcAvg = fcVals.length > 0 ? Number((fcVals.reduce((a, b) => a + b, 0) / fcVals.length).toFixed(compareParam === 'co' ? 3 : 1)) : 0;

    const histVals = verified.map((d) => d.historical_val);
    const histAvg = histVals.length > 0 ? Number((histVals.reduce((a, b) => a + b, 0) / histVals.length).toFixed(compareParam === 'co' ? 3 : 1)) : (latestSensorSlot?.historical_val ?? 0);

    const avgDiff = Number((fcAvg - histAvg).toFixed(compareParam === 'co' ? 3 : 1));
    const avgDiffPct = histAvg !== 0 ? Number(((avgDiff / histAvg) * 100).toFixed(1)) : 0;

    return {
      verifiedCount: verified.length,
      pendingCount: pending.length,
      latestSensor: latestSensorSlot,
      nextForecast: nextForecastSlot,
      histAvg,
      fcAvg,
      avgDiff,
      avgDiffPct,
      isWeather,
      nextExpectedTime: nextForecastSlot?.hour_time || 'Next Hour'
    };
  }, [sameTimeComparisonData, compareParam]);

  const currentHourSlot = useMemo(() => {
    if (!sameTimeComparisonData || sameTimeComparisonData.length === 0) return null;
    const nonFuture = sameTimeComparisonData.filter((d) => !d.is_future && d.historical_val !== null);
    return nonFuture[nonFuture.length - 1] || null;
  }, [sameTimeComparisonData]);

  // Specialized Comparison Tooltip
  const ComparisonTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    const cfg = PARAM_CONFIG[compareParam] || PARAM_CONFIG.aqi;

    // Same Time-Point Comparison Tooltip
    const isPending = item.is_pending || item.historical_val === null;
    const diff = item.delta;
    const diffPct = item.deltaPct;
    const isHigher = diff > 0;
    return (
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '8px 12px',
        color: '#ffffff',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
        minWidth: 200,
        fontSize: 11,
        fontFamily: 'var(--font-sans)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: 5, marginBottom: 6, gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 11.5, color: '#f8fafc' }}>
              {item.display_time}
            </div>
            <div style={{ fontSize: 9.5, color: '#94a3b8' }}>
              {item.step_label === 'Now' ? 'Current' : (item.is_future ? `Future (${item.step_label})` : `Past (${item.step_label})`)}
            </div>
          </div>
          <span style={{
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 700,
            backgroundColor: isPending ? '#d9770625' : '#16a34a25',
            color: isPending ? '#f59e0b' : '#34d399',
            border: `1px solid ${isPending ? '#d9770650' : '#16a34a50'}`,
            whiteSpace: 'nowrap'
          }}>
            {isPending ? 'Pending' : 'Recorded'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#38bdf8' }} />
              Sensor:
            </span>
            {isPending ? (
              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 10 }}>
                — Pending
              </span>
            ) : (
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                {item.historical_val} {cfg.unit} {item.hist_cat ? `(${item.hist_cat})` : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#00bfa5', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00bfa5' }} />
              Forecast:
            </span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#00bfa5' }}>
              {item.forecast_val !== null ? `${item.forecast_val} ${cfg.unit} ${item.fc_cat ? `(${item.fc_cat})` : ''}` : '—'}
            </span>
          </div>

          {!isPending && diff !== null && (
            <div style={{
              marginTop: 3,
              paddingTop: 4,
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12
            }}>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>Diff:</span>
              <span style={{
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: diff === 0 ? '#94a3b8' : (isHigher ? '#f59e0b' : '#34d399')
              }}>
                {diff > 0 ? `+${diff}` : diff} {cfg.unit} ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Custom Chart Tooltip with Calculated AQI Indicator

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;

    return (
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #334155',
        borderRadius: 12,
        padding: '12px 16px',
        color: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
        minWidth: 230,
        fontSize: 12,
        fontFamily: 'var(--font-sans)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: 6, marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: '#f8fafc' }}>{item.display_time || label}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
            Step +{item.hour_index}h
          </span>
        </div>

        {/* Highlight Calculated AQI */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1e293b',
          padding: '6px 10px',
          borderRadius: 8,
          marginBottom: 8
        }}>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Calculated AQI:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.aqi_color || '#38bdf8' }}>
              {item.aqi}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: item.aqi_color || '#38bdf8' }}>
              {item.aqi_category}
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8', backgroundColor: '#334155', padding: '1px 5px', borderRadius: 4 }}>
              {item.dominant_pollutant}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {payload.map((p) => {
            const cfg = PARAM_CONFIG[p.dataKey];
            if (p.dataKey === 'aqi') {
              return (
                <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ color: '#00bfa5', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#00bfa5' }} />
                    Air Quality Index (AQI):
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#00bfa5' }}>
                    {p.value}
                  </span>
                </div>
              );
            }
            return (
              <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ color: p.color || '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
                  {cfg ? cfg.name : p.name}:
                </span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {p.value} {cfg ? cfg.unit : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading && !forecastData) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 450,
        gap: 16,
        color: '#64748b'
      }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
          <RefreshCw style={{ width: 36, height: 36, color: '#00bfa5' }} />
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Running Bidirectional LSTM Inference</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Ingesting 48-hour historical telemetry and predicting 24-hour horizon with sub-index AQI calculation...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', boxSizing: 'border-box' }}>

      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              24-Hour Predictive Telemetry &amp; AQI Forecast
            </h1>
          </div>
        </div>

        {/* Engine Controls & Refresh (Model Architecture button removed as requested) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => fetchForecast(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              backgroundColor: '#00bfa5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: refreshing ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 191, 165, 0.25)',
              transition: 'background-color 0.15s'
            }}
          >
            <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
              <RefreshCw style={{ width: 14, height: 14 }} />
            </motion.div>
            {refreshing ? 'Repredicting...' : 'Repredict Forecast'}
          </button>
        </div>
      </div>

      {/* Main Interactive Forecast Visualizations */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: '24px 28px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
      }}>

        {/* Tab & View Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 16 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, flexWrap: 'wrap' }}>
            {[
              { id: 'aqi', label: 'Predicted AQI Index', icon: Activity },
              { id: 'pollutants', label: 'All Pollutants Comparison', icon: Layers },
              { id: 'comparison', label: 'Historical vs Forecast Comparison', icon: ArrowLeftRight }
            ].map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: activeTab === id ? 700 : 500,
                  backgroundColor: activeTab === id ? '#ffffff' : 'transparent',
                  color: activeTab === id ? '#0f172a' : '#64748b',
                  boxShadow: activeTab === id ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <TabIcon style={{ width: 14, height: 14, color: activeTab === id ? '#00bfa5' : '#94a3b8' }} />
                {label}
              </button>
            ))}
          </div>

          {/* Contextual Controls for Comparison View */}
          {activeTab === 'comparison' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Parameter Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Target:
                </span>
                <select
                  value={compareParam}
                  onChange={(e) => setCompareParam(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: 11,
                    fontWeight: 700,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {Object.entries(PARAM_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.name} ({cfg.unit})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Filter Chips for Pollutants View */}
          {activeTab === 'pollutants' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginRight: 4 }}>
                Toggle:
              </span>
              {['pm25', 'pm10', 'co', 'no2', 'o3'].map((key) => {
                const cfg = PARAM_CONFIG[key];
                const active = visiblePollutants[key];
                return (
                  <button
                    key={key}
                    onClick={() => togglePollutant(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 8,
                      border: `1px solid ${active ? cfg.color : '#e2e8f0'}`,
                      backgroundColor: active ? `${cfg.color}15` : '#f8fafc',
                      color: active ? cfg.color : '#94a3b8',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: active ? cfg.color : '#cbd5e1' }} />
                    {cfg.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Comparison KPI Analytics Cards */}
        {activeTab === 'comparison' && comparisonKpis && (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 14,
              marginBottom: 16
            }}>
              {/* Card 1: Right Now (Latest Sensor Measurement) */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '14px 16px'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📍 Recorded Up to Now</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 6,
                    backgroundColor: '#0284c715',
                    color: '#0284c7'
                  }}>
                    {comparisonKpis.latestSensor?.hour_time || '3:00 PM'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                    {comparisonKpis.latestSensor?.historical_val !== null && comparisonKpis.latestSensor?.historical_val !== undefined
                      ? comparisonKpis.latestSensor.historical_val
                      : '—'}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                    {PARAM_CONFIG[compareParam]?.unit}
                  </span>
                  {compareParam === 'aqi' && comparisonKpis.latestSensor?.hist_cat && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      backgroundColor: `${comparisonKpis.latestSensor.hist_color}20`,
                      color: comparisonKpis.latestSensor.hist_color
                    }}>
                      {comparisonKpis.latestSensor.hist_cat}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  Real sensor telemetry recorded at <strong style={{ color: '#0f172a' }}>{comparisonKpis.latestSensor?.display_time || 'Right Now'}</strong>.
                </div>
              </div>

              {/* Card 2: Upcoming AI Prediction (Next Hour) */}
              <div style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '14px 16px'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🔮 Next Hour AI Prediction</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 6,
                    backgroundColor: '#00bfa515',
                    color: '#00bfa5'
                  }}>
                    {comparisonKpis.nextForecast?.hour_time || '4:00 PM'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#00bfa5' }}>
                    {comparisonKpis.nextForecast?.forecast_val !== null && comparisonKpis.nextForecast?.forecast_val !== undefined
                      ? comparisonKpis.nextForecast.forecast_val
                      : '—'}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                    {PARAM_CONFIG[compareParam]?.unit}
                  </span>
                  {compareParam === 'aqi' && comparisonKpis.nextForecast?.fc_cat && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 4,
                      backgroundColor: `${comparisonKpis.nextForecast.fc_color}20`,
                      color: comparisonKpis.nextForecast.fc_color
                    }}>
                      {comparisonKpis.nextForecast.fc_cat}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  AI forecast expected for <strong style={{ color: '#0f172a' }}>{comparisonKpis.nextForecast?.display_time || 'Next Hour'}</strong>.
                </div>
              </div>
            </div>

            {/* Visual Guide Banner */}
            <div style={{
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '10px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <div style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                backgroundColor: '#dbeafe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1d4ed8',
                flexShrink: 0
              }}>
                <Info style={{ width: 15, height: 15 }} />
              </div>
              <div style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 1.5 }}>
                <strong>How to understand this chart:</strong>
                {' '}
                <span style={{ color: '#0284c7', fontWeight: 700 }}>● Solid Blue Line</span> = Actual sensor data recorded up to <strong>{currentHourSlot?.hour_time || '3:00 PM'}</strong>.
                {' '}|{' '}
                <span style={{ color: '#00bfa5', fontWeight: 700 }}>● Dotted Green Line</span> = AI forecast for the next 24 hours.
                {' '}|{' '}
                <span style={{ color: '#d97706', fontWeight: 600 }}>⏳ Blank Line after {currentHourSlot?.hour_time || '3:00 PM'}</span> = Left blank for future hours until physical sensor readings arrive!
              </div>
            </div>
          </div>
        )}


        {/* Visualization Canvas */}
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">

            {/* View 0: Predicted AQI Index Area Chart */}
            {activeTab === 'aqi' && (
              <AreaChart data={forecastList} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="predictedAqiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00bfa5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00bfa5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="display_time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <ReferenceLine y={50} stroke="#16a34a" strokeDasharray="3 3" label={{ value: 'Good (50)', fill: '#16a34a', fontSize: 10, position: 'insideTopRight' }} />
                <ReferenceLine y={100} stroke="#65a30d" strokeDasharray="3 3" label={{ value: 'Satisfactory (100)', fill: '#65a30d', fontSize: 10, position: 'insideTopRight' }} />
                <ReferenceLine y={200} stroke="#d97706" strokeDasharray="3 3" label={{ value: 'Moderate (200)', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }} />
                <Area
                  type="monotone"
                  dataKey="aqi"
                  name="Predicted AQI (Formula Derived)"
                  stroke="#00bfa5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#predictedAqiGrad)"
                  dot={{ r: 3, fill: '#00bfa5' }}
                  activeDot={{ r: 6, fill: '#00bfa5', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            )}

            {/* View 1: All Pollutants Multi-Line Chart */}
            {activeTab === 'pollutants' && (
              <LineChart data={forecastList} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="display_time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                {visiblePollutants.pm25 && (
                  <Line type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke={PARAM_CONFIG.pm25.color} strokeWidth={2.5} dot={false} />
                )}
                {visiblePollutants.pm10 && (
                  <Line type="monotone" dataKey="pm10" name="PM10 (µg/m³)" stroke={PARAM_CONFIG.pm10.color} strokeWidth={2.5} dot={false} />
                )}
                {visiblePollutants.co && (
                  <Line type="monotone" dataKey="co" name="CO (mg/m³)" stroke={PARAM_CONFIG.co.color} strokeWidth={2.5} dot={false} />
                )}
                {visiblePollutants.no2 && (
                  <Line type="monotone" dataKey="no2" name="NO₂ (µg/m³)" stroke={PARAM_CONFIG.no2.color} strokeWidth={2.5} dot={false} />
                )}
                {visiblePollutants.o3 && (
                  <Line type="monotone" dataKey="o3" name="O₃ (µg/m³)" stroke={PARAM_CONFIG.o3.color} strokeWidth={2.5} dot={false} />
                )}
              </LineChart>
            )}

            {/* Same Time-Point Forecast vs Historical Telemetry Comparison */}
            {activeTab === 'comparison' && (
              <LineChart data={sameTimeComparisonData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="display_time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'auto']} unit={` ${PARAM_CONFIG[compareParam]?.unit || ''}`} />
                <Tooltip content={<ComparisonTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                {currentHourSlot && (
                  <ReferenceLine
                    x={currentHourSlot.display_time}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `📍 RIGHT NOW (${currentHourSlot.hour_time})`,
                      fill: '#d97706',
                      fontSize: 11,
                      fontWeight: 800,
                      position: 'insideTopLeft'
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="historical_val"
                  name={`Sensor Actual Telemetry (${PARAM_CONFIG[compareParam]?.name})`}
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7' }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast_val"
                  name={`AI Model Forecast (${PARAM_CONFIG[compareParam]?.name})`}
                  stroke="#00bfa5"
                  strokeWidth={2.5}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#00bfa5' }}
                  connectNulls={false}
                />
              </LineChart>
            )}

          </ResponsiveContainer>
        </div>

      </div>

      {/* Hourly Forecast Telemetry Matrix or Comparison Schedule */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: '24px 28px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)'
      }}>

        {activeTab === 'comparison' ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 20
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Same Time-Point Telemetry Comparison: AI Forecast vs Historical Actuals
                </h3>
              </div>

              {/* Schedule Filter Tabs */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#f1f5f9',
                padding: 4,
                borderRadius: 12,
                gap: 4
              }}>
                {[
                  { key: 'all', label: 'All Hours', count: sameTimeComparisonData.length },
                  { key: 'verified', label: 'Recorded Hours (Compared)', count: sameTimeComparisonData.filter((r) => !r.is_pending && r.forecast_val !== null).length }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setScheduleFilter(tab.key)}
                    style={{
                      border: 'none',
                      backgroundColor: scheduleFilter === tab.key ? '#ffffff' : 'transparent',
                      color: scheduleFilter === tab.key ? '#0f172a' : '#64748b',
                      fontWeight: scheduleFilter === tab.key ? 700 : 500,
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: scheduleFilter === tab.key ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{tab.label}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      backgroundColor: scheduleFilter === tab.key ? '#e0f2fe' : '#e2e8f0',
                      color: scheduleFilter === tab.key ? '#0284c7' : '#64748b'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Side-by-Side Hourly Telemetry Comparison Matrix */}
            <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Target Time Point</th>
                    <th style={{ padding: '12px 16px' }}>Horizon</th>
                    <th style={{ padding: '12px 16px' }}>AI Predicted Forecast ({PARAM_CONFIG[compareParam]?.unit})</th>
                    <th style={{ padding: '12px 16px' }}>Real Sensor Reading ({PARAM_CONFIG[compareParam]?.unit})</th>
                    <th style={{ padding: '12px 16px' }}>Difference (Forecast vs Sensor)</th>
                    <th style={{ padding: '12px 16px' }}>% Deviation</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sameTimeComparisonData
                    .filter((row) => {
                      if (scheduleFilter === 'verified') return !row.is_pending && row.forecast_val !== null;
                      if (scheduleFilter === 'pending') return row.is_pending;
                      return true;
                    })
                    .map((row, idx, filteredArr) => {
                      const isDiffPos = row.delta > 0;
                      const isDiffZero = row.delta === 0;
                      const isWeather = compareParam === 'temperature' || compareParam === 'humidity';
                      const isBetter = isWeather ? false : !isDiffPos;
                      const isNow = row.step_label === 'Now';

                      return (
                        <tr
                          key={row.slot_key || idx}
                          style={{
                            borderBottom: idx < filteredArr.length - 1 ? '1px solid #f1f5f9' : 'none',
                            backgroundColor: isNow ? '#eff6ff' : (row.is_pending ? '#fffdfa' : (idx % 2 === 0 ? '#ffffff' : '#fcfdfe')),
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          {/* Target Time Point */}
                          <td style={{ padding: '11px 16px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: isNow ? 800 : 700, color: isNow ? '#1d4ed8' : '#0f172a' }}>
                                {row.display_time}
                              </span>
                              {isNow ? (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: '#dbeafe',
                                  color: '#1e40af',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  📍 RIGHT NOW
                                </span>
                              ) : row.is_pending ? (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309'
                                }}>
                                  Future
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: '#f0fdf4',
                                  color: '#16a34a'
                                }}>
                                  Recorded
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Horizon */}
                          <td style={{ padding: '11px 16px', fontWeight: 700, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                            {row.step_label}
                          </td>

                          {/* AI Forecast */}
                          <td style={{ padding: '11px 16px' }}>
                            {row.forecast_val !== null ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#00bfa5' }}>
                                  {row.forecast_val}
                                </span>
                                {compareParam === 'aqi' && row.fc_cat && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    backgroundColor: `${row.fc_color}20`,
                                    color: row.fc_color
                                  }}>
                                    {row.fc_cat}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>

                          {/* Historical Actual (Blank space with placeholder if not yet available) */}
                          <td style={{ padding: '11px 16px' }}>
                            {row.is_pending ? (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                color: '#94a3b8',
                                fontStyle: 'italic',
                                fontSize: 11
                              }}>
                                <Clock style={{ width: 13, height: 13, color: '#f59e0b' }} />
                                <span>— Waiting for {row.hour_time} reading (Blank)</span>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0284c7' }}>
                                  {row.historical_val}
                                </span>
                                {compareParam === 'aqi' && row.hist_cat && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    backgroundColor: `${row.hist_color}20`,
                                    color: row.hist_color
                                  }}>
                                    {row.hist_cat}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Variance (Δ) - Blank if pending */}
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {row.is_pending || row.delta === null ? (
                              <span style={{ color: '#cbd5e1', fontWeight: 400 }}>— (Waiting for reading)</span>
                            ) : (
                              <span style={{ color: isDiffZero ? '#94a3b8' : (isBetter ? '#16a34a' : '#ea580c') }}>
                                {row.delta > 0 ? `+${row.delta}` : row.delta} {PARAM_CONFIG[compareParam]?.unit}
                              </span>
                            )}
                          </td>

                          {/* % Deviation - Blank if pending */}
                          <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {row.is_pending || row.deltaPct === null ? (
                              <span style={{ color: '#cbd5e1', fontWeight: 400 }}>—</span>
                            ) : (
                              <span style={{ color: isDiffZero ? '#94a3b8' : (isBetter ? '#16a34a' : '#ea580c') }}>
                                {row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`}
                              </span>
                            )}
                          </td>

                          {/* Status & Assessment */}
                          <td style={{ padding: '11px 16px' }}>
                            {isNow ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 9px',
                                borderRadius: 6,
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe'
                              }}>
                                📍 Current Active Hour
                              </span>
                            ) : row.is_pending ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 9px',
                                borderRadius: 6,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a'
                              }}>
                                <Clock style={{ width: 12, height: 12 }} />
                                Blank (Auto-fills at {row.hour_time})
                              </span>
                            ) : row.status === 'historical_only' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 6,
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #e2e8f0'
                              }}>
                                Historical Sensor Log
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                backgroundColor: isDiffZero ? '#f1f5f9' : (isBetter ? '#f0fdf4' : '#fff7ed'),
                                color: isDiffZero ? '#64748b' : (isBetter ? '#16a34a' : '#ea580c'),
                                border: `1px solid ${isDiffZero ? '#e2e8f0' : (isBetter ? '#bbf7d0' : '#fed7aa')}`
                              }}>
                                {isDiffZero ? (
                                  <>
                                    <CheckCircle2 style={{ width: 12, height: 12, color: '#16a34a' }} />
                                    Exact Match
                                  </>
                                ) : isBetter ? (
                                  <>
                                    <TrendingDown style={{ width: 12, height: 12 }} />
                                    {isWeather ? 'Lower' : 'Relief Expected'}
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp style={{ width: 12, height: 12 }} />
                                    {isWeather ? 'Higher' : 'Surge Expected'}
                                  </>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                24-Hour Parameter &amp; AQI Forecast Schedule
              </h3>
              <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Hour-by-hour predicted telemetry outputs with CPCB formula-derived sub-indices and overall AQI
              </p>
            </div>

            {/* 24-Hour Discrete Parameter Data Table */}
            <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px' }}>Horizon</th>
                    <th style={{ padding: '12px 16px' }}>Predicted AQI</th>
                    <th style={{ padding: '12px 16px' }}>PM2.5 (µg/m³)</th>
                    <th style={{ padding: '12px 16px' }}>PM10 (µg/m³)</th>
                    <th style={{ padding: '12px 16px' }}>CO (mg/m³)</th>
                    <th style={{ padding: '12px 16px' }}>NO₂ (µg/m³)</th>
                    <th style={{ padding: '12px 16px' }}>O₃ (µg/m³)</th>
                    <th style={{ padding: '12px 16px' }}>Temperature (°C)</th>
                    <th style={{ padding: '12px 16px' }}>Humidity (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastList.map((item, idx) => (
                    <tr
                      key={item.hour_index}
                      style={{
                        borderBottom: idx < forecastList.length - 1 ? '1px solid #f1f5f9' : 'none',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fcfdfe',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {item.display_time}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                        +{item.hour_index}h
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 10px',
                          borderRadius: 8,
                          backgroundColor: item.aqi_bg || '#f8fafc',
                          border: `1px solid ${item.aqi_border || '#e2e8f0'}`
                        }}>
                          <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 13, color: item.aqi_color || '#0f172a' }}>
                            {item.aqi}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: item.aqi_color || '#0f172a' }}>
                            {item.aqi_category}
                          </span>
                          <span style={{ fontSize: 10, color: '#64748b', backgroundColor: '#ffffff90', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                            {item.dominant_pollutant}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0ea5e9' }}>
                        {item.pm25}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#6366f1' }}>
                        {item.pm10}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#475569' }}>
                        {item.co}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f59e0b' }}>
                        {item.no2}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#10b981' }}>
                        {item.o3}
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#f43f5e' }}>
                        {item.temperature}°C
                      </td>
                      <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#06b6d4' }}>
                        {item.humidity}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
