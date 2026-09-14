import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
  TrendingUp,
  Table as TableIcon,
  LineChart as LineChartIcon,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Info,
  ArrowLeftRight,
  Database,
  HeartPulse,
  Sun,
  Wind,
  Compass,
  Zap,
  Filter,
  Eye,
  Activity,
  Layers,
  Search
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
import { getAqiForecast, getCloudHistory, getTimeAgo } from '../api';

const PARAM_CONFIG = {
  aqi: { name: 'Composite AQI', fullName: 'CPCB Composite AQI', key: 'aqi', histKey: 'cpcb_aqi', unit: 'Index', color: '#10b981', desc: 'CPCB India composite standard index derived from dominant pollutant sub-index.' },
  pm2_5_ug_m3: { name: 'PM2.5', fullName: 'Fine Respirable Particulates (PM2.5)', key: 'pm2_5_ug_m3', histKey: 'pm25', unit: 'µg/m³', color: '#0ea5e9', desc: 'Fine respirable particulate matter (≤ 2.5 µm), penetrating deep into lungs.' },
  pm10_ug_m3: { name: 'PM10', fullName: 'Inhalable Particulates (PM10)', key: 'pm10_ug_m3', histKey: 'pm10', unit: 'µg/m³', color: '#6366f1', desc: 'Coarse inhalable dust particles (≤ 10 µm) irritating airways.' },
  no2_ug_m3: { name: 'NO₂', fullName: 'Nitrogen Dioxide (NO₂)', key: 'no2_ug_m3', histKey: 'no2', unit: 'µg/m³', color: '#f59e0b', desc: 'Combustion emission from vehicle exhausts and thermal plants.' },
  co_mg_m3: { name: 'CO', fullName: 'Carbon Monoxide (CO)', key: 'co_mg_m3', histKey: 'co', unit: 'mg/m³', color: '#64748b', desc: 'Toxic odorless combustion byproduct gas.' },
  ozone_ug_m3: { name: 'Ozone (O₃)', fullName: 'Ground-Level Ozone (O₃)', key: 'ozone_ug_m3', histKey: 'o3', unit: 'µg/m³', color: '#14b8a6', desc: 'Photochemical smog oxidant formed under solar radiation.' },
  temperature_c: { name: 'Temperature', fullName: 'Ambient Temperature', key: 'temperature_c', histKey: 'temperature', unit: '°C', color: '#f43f5e', desc: 'Thermal air temperature recorded in Celsius.' },
  humidity_pct: { name: 'Humidity', fullName: 'Relative Humidity', key: 'humidity_pct', histKey: 'humidity', unit: '%', color: '#06b6d4', desc: 'Atmospheric moisture saturation percentage.' }
};

// CPCB India Breakpoints Table: [C_lo, C_hi, I_lo, I_hi]
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

// CPCB Linear formula: Ip = ((I_HI - I_LO) / (C_HI - C_LO)) * (Cp - C_LO) + I_LO
const calculateSubIndex = (key, val) => {
  const tiers = CPCB_BREAKPOINTS[key];
  if (!tiers) return 0;
  const cp = Math.max(0, Number(val) || 0);
  for (let i = 0; i < tiers.length; i++) {
    const [cLo, cHi, iLo, iHi] = tiers[i];
    if (cp <= cHi) {
      const ip = ((iHi - iLo) / (cHi - cLo)) * (cp - cLo) + iLo;
      return Math.round(Math.max(0, ip));
    }
  }
  const [cLo, cHi, iLo, iHi] = tiers[tiers.length - 1];
  const ip = ((iHi - iLo) / (cHi - cLo)) * (cp - cLo) + iLo;
  return Math.min(500, Math.round(Math.max(0, ip)));
};

const getAqiCategory = (val) => {
  if (val == null || isNaN(Number(val))) {
    return { label: 'Pending', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', advice: 'Telemetry has not yet been logged for this upcoming time.' };
  }
  const v = Math.round(Number(val) || 0);
  if (v <= 50) return { label: 'Good', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', advice: 'Air quality is considered satisfactory, and air pollution poses little or no risk.' };
  if (v <= 100) return { label: 'Satisfactory', color: '#84cc16', bg: '#f7fee7', border: '#d9f99d', text: '#3f6212', advice: 'Minor breathing discomfort to sensitive people; acceptable for outdoor activities.' };
  if (v <= 200) return { label: 'Moderate', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e', advice: 'Breathing discomfort to the people with lungs, asthma and heart diseases.' };
  if (v <= 300) return { label: 'Poor', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', advice: 'Breathing discomfort to most people on prolonged exposure. Limit strenuous cardio.' };
  if (v <= 400) return { label: 'Very Poor', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#991b1b', advice: 'Respiratory illness on prolonged exposure. Sensitive groups should stay indoors.' };
  return { label: 'Severe', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', advice: 'Affects healthy people and seriously impacts those with existing diseases. Wear N95 masks.' };
};

export default function Forecast({ refreshKey }) {
  const [forecastData, setForecastData] = useState(null);
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeParam, setActiveParam] = useState('aqi');
  const [activeView, setActiveView] = useState('timeline'); // 'timeline' | 'chart' | 'table'
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [showComparison, setShowComparison] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all' | 'next6' | 'next12' | 'recorded'

  const fetchForecastAndHistory = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [fcRes, histRes] = await Promise.allSettled([
        getAqiForecast(force),
        getCloudHistory(100)
      ]);

      if (fcRes.status === 'fulfilled' && fcRes.value?.data?.status === 'success' && Array.isArray(fcRes.value.data.forecast)) {
        setForecastData(fcRes.value.data);
        setLastUpdated(new Date());
      } else {
        setError(fcRes.value?.data?.message || 'Failed to retrieve Node 1 24h forecast.');
      }

      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value?.data?.history)) {
        setHistoricalRecords(histRes.value.data.history);
      }
    } catch (err) {
      setError(err?.message || 'Network error fetching forecast or historical telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecastAndHistory(false);
    const timer = setInterval(() => fetchForecastAndHistory(false), 30000);
    return () => clearInterval(timer);
  }, [refreshKey]);

  // Process forecast items with dynamic CPCB calculation and match with historical readings
  const processedItems = useMemo(() => {
    if (!forecastData?.forecast) return [];
    return forecastData.forecast.map((item, index) => {
      const subPm25 = calculateSubIndex('pm25', item.pm2_5_ug_m3);
      const subPm10 = calculateSubIndex('pm10', item.pm10_ug_m3);
      const subNo2 = calculateSubIndex('no2', item.no2_ug_m3);
      const subCo = calculateSubIndex('co', item.co_mg_m3);
      const subO3 = calculateSubIndex('o3', item.ozone_ug_m3);

      const subList = [
        { name: 'PM2.5', key: 'pm25', val: subPm25, raw: item.pm2_5_ug_m3, unit: 'µg/m³' },
        { name: 'PM10', key: 'pm10', val: subPm10, raw: item.pm10_ug_m3, unit: 'µg/m³' },
        { name: 'NO₂', key: 'no2', val: subNo2, raw: item.no2_ug_m3, unit: 'µg/m³' },
        { name: 'CO', key: 'co', val: subCo, raw: item.co_mg_m3, unit: 'mg/m³' },
        { name: 'O₃', key: 'o3', val: subO3, raw: item.ozone_ug_m3, unit: 'µg/m³' }
      ];

      const maxSub = subList.reduce((prev, curr) => (curr.val > prev.val ? curr : prev), subList[0]);
      const compositeAqi = maxSub.val;
      const cat = getAqiCategory(compositeAqi);

      const dt = new Date(item.forecast_for_time);
      const hourStr = isNaN(dt.getTime())
        ? `+${item.step}h`
        : dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const dayStr = isNaN(dt.getTime())
        ? ''
        : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      // Match actual historical record at identical year, month, date, hour
      const matchingActual = historicalRecords.find((h) => {
        if (!h?.timestamp) return false;
        const hDt = new Date(h.timestamp);
        return (
          hDt.getFullYear() === dt.getFullYear() &&
          hDt.getMonth() === dt.getMonth() &&
          hDt.getDate() === dt.getDate() &&
          hDt.getHours() === dt.getHours()
        );
      });

      const hasActual = !!matchingActual;
      const actualAqi = hasActual && matchingActual.cpcb_aqi != null ? Number(matchingActual.cpcb_aqi) : null;
      const aqiDelta = (hasActual && actualAqi != null) ? (actualAqi - compositeAqi) : null;

      // Extract parameter values for both Actual and Forecast
      const actualPm25 = hasActual && (matchingActual.pm25 != null ? matchingActual.pm25 : matchingActual['pm2.5']);
      const actualPm10 = hasActual ? matchingActual.pm10 : null;
      const actualNo2 = hasActual ? matchingActual.no2 : null;
      const actualCo = hasActual ? matchingActual.co : null;
      const actualO3 = hasActual ? matchingActual.o3 : null;
      const actualTemp = hasActual ? matchingActual.temperature : null;
      const actualHum = hasActual ? matchingActual.humidity : null;

      return {
        ...item,
        index,
        display_hour: hourStr,
        display_date: dayStr,
        iso_time: item.forecast_for_time,
        aqi: compositeAqi,
        dominant_pollutant: maxSub.name,
        dominant_sub: maxSub.val,
        pollutant_breakdown: subList,
        aqi_category: cat.label,
        aqi_color: cat.color,
        aqi_bg: cat.bg,
        aqi_border: cat.border,
        aqi_advice: cat.advice,
        sub_indices: {
          pm25: subPm25,
          pm10: subPm10,
          no2: subNo2,
          co: subCo,
          o3: subO3
        },
        // Actual Telemetry Pairing
        hasActual,
        actualRecord: matchingActual || null,
        actual_aqi: actualAqi,
        actual_pm25: actualPm25,
        actual_pm10: actualPm10,
        actual_no2: actualNo2,
        actual_co: actualCo,
        actual_o3: actualO3,
        actual_temp: actualTemp,
        actual_hum: actualHum,
        aqi_delta: aqiDelta
      };
    });
  }, [forecastData, historicalRecords]);

  // Filtered subset for users who want quick views (e.g. Next 6h, Next 12h, or Matched records)
  const filteredItems = useMemo(() => {
    if (filterPeriod === 'next6') return processedItems.slice(0, 6);
    if (filterPeriod === 'next12') return processedItems.slice(0, 12);
    if (filterPeriod === 'recorded') {
      const rec = processedItems.filter(p => p.hasActual);
      return rec.length > 0 ? rec : processedItems;
    }
    return processedItems;
  }, [processedItems, filterPeriod]);

  // Overall Statistics across 24h
  const stats = useMemo(() => {
    if (processedItems.length === 0) return null;
    const aqiVals = processedItems.map(p => p.aqi);
    const minAqi = Math.min(...aqiVals);
    const maxAqi = Math.max(...aqiVals);
    const avgAqi = Math.round(aqiVals.reduce((a, b) => a + b, 0) / aqiVals.length);
    const maxItem = processedItems.find(p => p.aqi === maxAqi);
    const minItem = processedItems.find(p => p.aqi === minAqi);

    const matchedItems = processedItems.filter(p => p.hasActual && p.actual_aqi != null);
    const actualCount = matchedItems.length;

    // Mean absolute error if we have comparisons
    let maeAqi = null;
    if (actualCount > 0) {
      const sumErr = matchedItems.reduce((acc, curr) => acc + Math.abs(curr.aqi_delta || 0), 0);
      maeAqi = (sumErr / actualCount).toFixed(1);
    }

    return {
      minAqi,
      maxAqi,
      avgAqi,
      peakTime: maxItem?.display_hour,
      peakDate: maxItem?.display_date,
      bestTime: minItem?.display_hour,
      bestDate: minItem?.display_date,
      dominantOverall: maxItem?.dominant_pollutant || 'PM2.5',
      avgCat: getAqiCategory(avgAqi),
      peakCat: getAqiCategory(maxAqi),
      bestCat: getAqiCategory(minAqi),
      actualCount,
      pendingCount: processedItems.length - actualCount,
      maeAqi
    };
  }, [processedItems]);

  const activeSlot = processedItems[selectedSlotIndex] || processedItems[0];

  const renderDualCell = (actVal, fcVal, unit = '', decimals = 2) => {
    const hasAct = actVal != null && !isNaN(Number(actVal));
    const hasFc = fcVal != null && !isNaN(Number(fcVal));

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono, monospace)' }}>
        <span style={{ fontWeight: 700, color: hasAct ? '#0f172a' : '#94a3b8' }}>
          {hasAct ? `${Number(actVal).toFixed(decimals)}${unit}` : '—'}
        </span>
        <span style={{ color: '#cbd5e1' }}>/</span>
        <span style={{ color: hasFc ? '#0284c7' : '#94a3b8', fontWeight: 600 }}>
          {hasFc ? `${Number(fcVal).toFixed(decimals)}${unit}` : '—'}
        </span>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px', minHeight: '85vh' }}>
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 20
      }}>
        <div>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            <Sparkles style={{ width: 22, height: 22, color: '#00bfa5' }} />
            Predictive Forecast (24h)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
            Node 1 24-hour horizon (t+1 → t+24) with CPCB Indian standard calculation and real-time telemetry comparison.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastUpdated && (
            <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
              Updated {getTimeAgo(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => fetchForecastAndHistory(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              backgroundColor: '#00bfa5',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 191, 165, 0.25)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 14,
          padding: '16px 20px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20
        }}>
          <AlertCircle size={20} />
          <div style={{ fontSize: 13.5 }}>
            <strong>Inference Pipeline Notice:</strong> {error}
          </div>
        </div>
      )}



      {/* 24-Hour Quick Timeline Scrubber */}
      {processedItems.length > 0 && (
        <div style={{
          background: '#ffffff',
          borderRadius: 18,
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#0ea5e9" /> 24-Hour Timeline Overview
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748b' }}>
                Click any hourly slot to view its detailed pollutant profile and telemetry comparison below.
              </p>
            </div>

            {/* Quick Time Horizon Filter */}
            <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', padding: 3, borderRadius: 10 }}>
              {[
                { id: 'all', label: 'All 24h' },
                { id: 'next6', label: 'Next 6h' },
                { id: 'next12', label: 'Next 12h' },
                { id: 'recorded', label: 'Matched Only' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterPeriod(tab.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: filterPeriod === tab.id ? '#ffffff' : 'transparent',
                    color: filterPeriod === tab.id ? '#0f172a' : '#64748b',
                    boxShadow: filterPeriod === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Scroller Cards */}
          <div style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'thin'
          }}>
            {filteredItems.map((item) => {
              const isSelected = selectedSlotIndex === item.index;
              return (
                <div
                  key={item.index}
                  onClick={() => setSelectedSlotIndex(item.index)}
                  style={{
                    flex: '0 0 110px',
                    padding: '12px 10px',
                    borderRadius: 14,
                    border: isSelected ? `2.5px solid ${item.aqi_color}` : '1.5px solid #e2e8f0',
                    background: isSelected ? item.aqi_bg : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    boxShadow: isSelected ? `0 8px 16px -4px ${item.aqi_color}40` : 'none'
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                    {item.display_hour}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: item.aqi_color, lineHeight: 1.1 }}>
                    {item.aqi}
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: item.aqi_color,
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {item.aqi_category}
                  </div>
                  <div style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px dashed #e2e8f0',
                    fontSize: 10,
                    color: item.hasActual ? '#0284c7' : '#94a3b8',
                    fontWeight: 600
                  }}>
                    {item.hasActual ? (
                      <span>Act: <strong>{item.actual_aqi ?? '—'}</strong></span>
                    ) : (
                      <span>Pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}



      {/* Main Analytics Hub: Chart & Full 24h Table with Metric Switcher */}
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        padding: '26px 28px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.04)',
        marginBottom: 28
      }}>
        {/* Navigation Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 22,
          paddingBottom: 20,
          borderBottom: '1px solid #f1f5f9'
        }}>
          {/* Parameter Selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sliders size={14} /> Metric:
            </span>
            {Object.keys(PARAM_CONFIG).map((pKey) => {
              const cfg = PARAM_CONFIG[pKey];
              const isSelected = activeParam === pKey;
              return (
                <button
                  key={pKey}
                  onClick={() => setActiveParam(pKey)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    border: isSelected ? `2px solid ${cfg.color}` : '1px solid #e2e8f0',
                    background: isSelected ? `${cfg.color}15` : '#f8fafc',
                    color: isSelected ? cfg.color : '#64748b'
                  }}
                >
                  {cfg.name}
                </button>
              );
            })}
          </div>

          {/* View Toggles & Comparison Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowComparison(!showComparison)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                border: showComparison ? '1.5px solid #00bfa5' : '1px solid #cbd5e1',
                backgroundColor: showComparison ? '#f0fdf4' : '#ffffff',
                color: showComparison ? '#0f766e' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              <ArrowLeftRight size={14} color={showComparison ? '#00bfa5' : '#64748b'} />
              <span>{showComparison ? 'Comparison: Active' : 'Enable Comparison'}</span>
            </button>

            <div style={{ display: 'flex', background: '#f1f5f9', padding: 4, borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setActiveView('chart')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeView === 'chart' ? '#ffffff' : 'transparent',
                  color: activeView === 'chart' ? '#0f172a' : '#64748b',
                  boxShadow: activeView === 'chart' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <LineChartIcon size={14} /> Trend Curve
              </button>
              <button
                onClick={() => setActiveView('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: activeView === 'table' ? '#ffffff' : 'transparent',
                  color: activeView === 'table' ? '#0f172a' : '#64748b',
                  boxShadow: activeView === 'table' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <TableIcon size={14} /> Full 24h Table
              </button>
            </div>
          </div>
        </div>

        {/* Selected Parameter Context Explainer */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          fontSize: 13,
          color: '#64748b'
        }}>
          <div>
            <strong style={{ color: '#0f172a' }}>{PARAM_CONFIG[activeParam].fullName}</strong> ({PARAM_CONFIG[activeParam].unit}): {PARAM_CONFIG[activeParam].desc}
          </div>
          {showComparison && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 3, background: PARAM_CONFIG[activeParam].color, display: 'inline-block', borderRadius: 2 }} />
                <strong style={{ color: PARAM_CONFIG[activeParam].color }}>Solid: Forecast Prediction</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 3, borderTop: '2px dashed #f59e0b', display: 'inline-block' }} />
                <strong style={{ color: '#f59e0b' }}>Dashed: Actual Telemetry (AQI_NODE1)</strong>
              </span>
            </div>
          )}
        </div>

        {/* Chart View */}
        {activeView === 'chart' ? (
          <div style={{ width: '100%', height: 400 }}>
            {processedItems.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={processedItems} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="forecastParamGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PARAM_CONFIG[activeParam].color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={PARAM_CONFIG[activeParam].color} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="display_hour"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickMargin={10}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickMargin={8}
                    domain={activeParam === 'aqi' ? [0, 'auto'] : ['auto', 'auto']}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const histKey = PARAM_CONFIG[activeParam].histKey;
                        const actVal = data.hasActual && data.actualRecord ? data.actualRecord[histKey] : null;

                        return (
                          <div style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '14px 18px',
                            borderRadius: 14,
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                            fontSize: 12.5,
                            minWidth: 230,
                            border: '1px solid rgba(255,255,255,0.1)'
                          }}>
                            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: '#f8fafc' }}>
                              {data.display_hour} • {data.display_date}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                              <span style={{ color: '#94a3b8' }}>Forecast {PARAM_CONFIG[activeParam].name}:</span>
                              <strong style={{ color: PARAM_CONFIG[activeParam].color }}>
                                {data[activeParam]} {PARAM_CONFIG[activeParam].unit}
                              </strong>
                            </div>

                            {showComparison && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                                <span style={{ color: '#94a3b8' }}>Actual Telemetry:</span>
                                <strong style={{ color: actVal != null ? '#f59e0b' : '#64748b' }}>
                                  {actVal != null ? `${Number(actVal).toFixed(2)} ${PARAM_CONFIG[activeParam].unit}` : 'Pending (—)'}
                                </strong>
                              </div>
                            )}

                            {showComparison && activeParam === 'aqi' && data.aqi_delta != null && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
                                <span style={{ color: '#94a3b8' }}>Difference (Δ):</span>
                                <strong style={{ color: data.aqi_delta > 0 ? '#ef4444' : '#10b981' }}>
                                  {data.aqi_delta > 0 ? `+${data.aqi_delta}` : `${data.aqi_delta}`} AQI
                                </strong>
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                              <span style={{ color: '#94a3b8' }}>Dominant Sub-Index:</span>
                              <span style={{ color: '#38bdf8', fontWeight: 700 }}>{data.dominant_pollutant}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {activeParam === 'aqi' && (
                    <>
                      <ReferenceLine y={50} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Good (50)', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                      <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'Satisfactory (100)', fill: '#84cc16', fontSize: 10, position: 'insideTopRight' }} />
                      <ReferenceLine y={200} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Moderate (200)', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                    </>
                  )}

                  {/* Primary Forecast Area */}
                  <Area
                    type="monotone"
                    dataKey={activeParam}
                    name="Forecast"
                    stroke={PARAM_CONFIG[activeParam].color}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#forecastParamGradient)"
                  />

                  {/* Overlaid Historical Telemetry Curve */}
                  {showComparison && (
                    <Line
                      type="monotone"
                      dataKey={(item) => {
                        const histKey = PARAM_CONFIG[activeParam].histKey;
                        return item.hasActual && item.actualRecord ? item.actualRecord[histKey] : null;
                      }}
                      name="Actual Telemetry"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      strokeDasharray="5 5"
                      dot={{ r: 4, fill: '#f59e0b' }}
                      connectNulls={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                {loading ? 'Processing neural forecasts...' : 'No forecast data available.'}
              </div>
            )}
          </div>
        ) : (
          /* Comprehensive 24h Comparison Table */
          <div style={{ overflowX: 'auto', maxHeight: 540 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', zIndex: 2 }}>
                <tr style={{ color: '#475569', fontSize: 12 }}>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Step</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Time Window</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Actual AQI</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Forecast AQI</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Difference (Δ)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Dominant Pollutant</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>PM2.5 (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>PM10 (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>NO₂ (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>CO (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>O₃ (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Temp (Act / Fcst)</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Humidity (Act / Fcst)</th>
                </tr>
              </thead>
              <tbody>
                {processedItems.map((row, idx) => (
                  <tr
                    key={idx}
                    onClick={() => setSelectedSlotIndex(row.index)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: selectedSlotIndex === row.index ? `${row.aqi_color}10` : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (selectedSlotIndex !== row.index) e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => { if (selectedSlotIndex !== row.index) e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8fafc'; }}
                  >
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>
                      +{row.step}h
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {row.display_hour} <span style={{ fontSize: 11, color: '#94a3b8' }}>({row.display_date})</span>
                    </td>

                    {/* Actual AQI */}
                    <td style={{ padding: '10px 14px' }}>
                      {row.hasActual && row.actual_aqi != null ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 12,
                          background: getAqiCategory(row.actual_aqi).bg,
                          color: getAqiCategory(row.actual_aqi).text,
                          border: `1px solid ${getAqiCategory(row.actual_aqi).border}`
                        }}>
                          {row.actual_aqi} • {getAqiCategory(row.actual_aqi).label}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>
                          Pending (—)
                        </span>
                      )}
                    </td>

                    {/* Forecast AQI */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontWeight: 700,
                        fontSize: 12,
                        background: row.aqi_bg,
                        color: row.aqi_color,
                        border: `1px solid ${row.aqi_border}`
                      }}>
                        {row.aqi} • {row.aqi_category}
                      </span>
                    </td>

                    {/* Difference (Delta) */}
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)' }}>
                      {row.aqi_delta != null ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          backgroundColor: row.aqi_delta === 0 ? '#f1f5f9' : (row.aqi_delta > 0 ? '#fef2f2' : '#f0fdf4'),
                          color: row.aqi_delta === 0 ? '#64748b' : (row.aqi_delta > 0 ? '#dc2626' : '#16a34a')
                        }}>
                          {row.aqi_delta > 0 ? `+${row.aqi_delta}` : `${row.aqi_delta}`}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0284c7' }}>
                      {row.dominant_pollutant}
                    </td>

                    {/* Actual vs Forecast pairs */}
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_pm25, row.pm2_5_ug_m3, '', 2)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_pm10, row.pm10_ug_m3, '', 2)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_no2, row.no2_ug_m3, '', 2)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_co, row.co_mg_m3, '', 3)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_o3, row.ozone_ug_m3, '', 2)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_temp, row.temperature_c, '°', 1)}</td>
                    <td style={{ padding: '10px 14px' }}>{renderDualCell(row.actual_hum, row.humidity_pct, '%', 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
}
