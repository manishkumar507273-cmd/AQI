import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
  Sun,
  Moon,
  CloudLightning,
  CloudSun,
  CloudMoon,
  CloudRain,
  Cloud,
  Wind,
  Droplets
} from 'lucide-react';
import { getAqiForecast, getWeatherForecast24h, getCloudHistory, getTimeAgo, getCachedData } from '../api';
import WeatherForecast24hView from '../components/WeatherForecast24hView';

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
  const [forecastData, setForecastData] = useState(() => getCachedData('CACHE_AQI_NODE1_FORECAST_24H'));
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [loading, setLoading] = useState(() => !getCachedData('CACHE_AQI_NODE1_FORECAST_24H'));
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const isFetchingRef = useRef(false);

  const fetchForecastAndHistory = async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (force || !forecastData) {
      setLoading(true);
    }
    setError(null);
    try {
      const [aqiFcRes, weatherFcRes, histRes] = await Promise.allSettled([
        getAqiForecast(force),
        getWeatherForecast24h(force),
        getCloudHistory(100)
      ]);

      const aqiForecast = (aqiFcRes.status === 'fulfilled' && aqiFcRes.value?.data?.status === 'success' && Array.isArray(aqiFcRes.value.data.forecast)) ? aqiFcRes.value.data.forecast : [];
      const weatherForecast = (weatherFcRes.status === 'fulfilled' && Array.isArray(weatherFcRes.value?.data?.forecast)) ? weatherFcRes.value.data.forecast : [];

      if (aqiForecast.length > 0 || weatherForecast.length > 0) {
        const baseForecast = aqiForecast.length > 0 ? aqiForecast : weatherForecast;
        const otherForecast = aqiForecast.length > 0 ? weatherForecast : [];

        const merged = baseForecast.map(bItem => {
          const bTime = new Date(bItem.forecast_for_time).getTime();
          const match = otherForecast.find(oItem => Math.abs(new Date(oItem.forecast_for_time).getTime() - bTime) < 1000 * 60 * 30);
          
          if (aqiForecast.length > 0) {
            return {
               ...bItem,
               temperature_c: match?.temperature_c != null ? match.temperature_c : (match?.temperature != null ? match.temperature : bItem.temperature_c),
               humidity_pct: match?.humidity_pct != null ? match.humidity_pct : (match?.humidity != null ? match.humidity : bItem.humidity_pct),
               rain_gauge: match?.rain_gauge != null ? match.rain_gauge : (match?.rain != null ? match.rain : bItem.rain_gauge),
               wind_speed: match?.wind_speed != null ? match.wind_speed : (match?.windSpeed != null ? match.windSpeed : bItem.wind_speed),
               weather_type: match?.weather_type
            };
          } else {
            return {
               ...bItem,
               ...match
            };
          }
        });

        const incoming = {
          generated_at: aqiFcRes.value?.data?.generated_at || weatherFcRes.value?.data?.generated_at || new Date().toISOString(),
          forecast: merged
        };

        setForecastData(incoming);
        setLastUpdated(new Date());
      } else if (!forecastData) {
        setError('Failed to retrieve Node 1 24h forecast.');
      }

      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value?.data?.history)) {
        setHistoricalRecords(histRes.value.data.history);
      }
    } catch (err) {
      if (!forecastData) {
        setError(err?.message || 'Network error fetching forecast or historical telemetry.');
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  // Refresh current time and forecast only on mount or manual refresh
  useEffect(() => {
    setCurrentTime(new Date());
    fetchForecastAndHistory(false);
    
    // Refresh every hour (3600000 ms)
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      fetchForecastAndHistory(true);
    }, 3600000);

    return () => clearInterval(interval);
  }, [refreshKey]);

  // Process forecast items with dynamic CPCB calculation and match with historical readings
  const processedItems = useMemo(() => {
    const forecastItems = (forecastData?.forecast || []).map((item) => {
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
      const compositeAqi = item.cpcb_aqi ?? item.aqi ?? maxSub.val;
      const cat = getAqiCategory(compositeAqi);

      const dt = new Date(item.forecast_for_time);
      const hourStr = isNaN(dt.getTime())
        ? `+${item.step}h`
        : dt.toLocaleTimeString([], { hour: 'numeric', hour12: true });
      const dayStr = isNaN(dt.getTime())
        ? ''
        : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      // Match actual historical record at identical LOCAL (IST) hour.
      // AQI_NODE1 stores timestamp_hour as IST naive strings (e.g. "2026-09-15T10:00:00"),
      // which JS parses as local IST. Forecast UTC times (e.g. "...T04:30:00+00:00") are
      // also converted to local IST by JS. So .getHours() gives the same IST hour for both.
      const matchingActual = historicalRecords.find((h) => {
        if (!h?.timestamp) return false;
        const hDt = new Date(h.timestamp);
        if (isNaN(hDt.getTime())) return false;
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

      const rain = Number(item.rain_gauge) || 0;
      const hum = Number(item.humidity ?? item.humidity_pct) || 0;
      const temp = Number(item.temperature ?? item.temperature_c) || 0;
      const windSpeed = Number(item.wind_speed) || 0;
      
      const hourNum = !isNaN(dt.getTime()) ? dt.getHours() : 12;
      const isDaytime = hourNum >= 6 && hourNum < 19;
      
      let weatherType = 'clear';
      if (rain > 0.5) weatherType = 'rain';
      else if (temp < 24) weatherType = 'cloudy';
      else if (hum > 55) weatherType = 'partly-cloudy';
      else weatherType = 'clear';

      return {
        ...item,
        isDaytime,
        weatherType,
        temp: Number(temp).toFixed(1),
        humidity: Math.round(hum),
        rain,
        windSpeed,
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
        aqi_delta: aqiDelta,
        isPast: false
      };
    });

    const pastItems = [];
    const currentHourStart = new Date(currentTime);
    currentHourStart.setMinutes(0, 0, 0);

    for (let i = 0; i >= 0; i--) {
      const pastTime = new Date(currentHourStart);
      pastTime.setHours(pastTime.getHours() - i);
      
      const alreadyInForecast = forecastItems.some(fi => {
        if (!fi.iso_time) return false;
        const fiTime = new Date(fi.iso_time);
        return !isNaN(fiTime.getTime()) && fiTime.getTime() === pastTime.getTime();
      });

      if (!alreadyInForecast) {
        const matchingActual = historicalRecords.find((h) => {
          if (!h?.timestamp) return false;
          const hDt = new Date(h.timestamp);
          if (isNaN(hDt.getTime())) return false;
          return (
            hDt.getFullYear() === pastTime.getFullYear() &&
            hDt.getMonth() === pastTime.getMonth() &&
            hDt.getDate() === pastTime.getDate() &&
            hDt.getHours() === pastTime.getHours()
          );
        });

        if (matchingActual) {
          const actualAqi = matchingActual.cpcb_aqi != null ? Number(matchingActual.cpcb_aqi) : null;
          const cat = getAqiCategory(actualAqi);
          const hourStr = pastTime.toLocaleTimeString([], { hour: 'numeric', hour12: true });
          const dayStr = pastTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
          const hourNum = pastTime.getHours();
          const isDaytime = hourNum >= 6 && hourNum < 19;
          const actualTemp = matchingActual.temperature != null ? Number(matchingActual.temperature) : null;
          const actualHum = matchingActual.humidity != null ? Number(matchingActual.humidity) : null;
          const actualRain = Number(matchingActual.rain_gauge) || 0;
          const actualWind = Number(matchingActual.wind_speed) || (forecastItems[0]?.windSpeed || 0);

          let weatherType = 'clear';
          if (actualRain > 0.5) weatherType = 'rain';
          else if (actualTemp != null && actualTemp < 24) weatherType = 'cloudy';
          else if (actualHum != null && actualHum > 55) weatherType = 'partly-cloudy';
          else weatherType = 'clear';

          pastItems.push({
            isPast: true,
            step: -i,
            isDaytime,
            weatherType,
            temp: actualTemp != null ? actualTemp.toFixed(1) : (forecastItems[0]?.temp || null),
            humidity: actualHum != null ? Math.round(actualHum) : (forecastItems[0]?.humidity || null),
            rain: actualRain,
            windSpeed: actualWind,
            display_hour: hourStr,
            display_date: dayStr,
            iso_time: pastTime.toISOString(),
            aqi: actualAqi,
            pm2_5_ug_m3: matchingActual.pm25 != null ? matchingActual.pm25 : matchingActual['pm2.5'],
            pm10_ug_m3: matchingActual.pm10,
            no2_ug_m3: matchingActual.no2,
            co_mg_m3: matchingActual.co,
            ozone_ug_m3: matchingActual.o3,
            temperature_c: matchingActual.temperature,
            humidity_pct: matchingActual.humidity,
            dominant_pollutant: '—',
            dominant_sub: null,
            pollutant_breakdown: [],
            aqi_category: cat.label,
            aqi_color: cat.color,
            aqi_bg: cat.bg,
            aqi_border: cat.border,
            aqi_advice: cat.advice,
            sub_indices: {},
            hasActual: true,
            actualRecord: matchingActual,
            actual_aqi: actualAqi,
            actual_pm25: matchingActual.pm25 != null ? matchingActual.pm25 : matchingActual['pm2.5'],
            actual_pm10: matchingActual.pm10,
            actual_no2: matchingActual.no2,
            actual_co: matchingActual.co,
            actual_o3: matchingActual.o3,
            actual_temp: matchingActual.temperature,
            actual_hum: matchingActual.humidity,
            aqi_delta: null
          });
        }
      }
    }

    return [...pastItems, ...forecastItems].map((item, index) => ({ ...item, index }));
  }, [forecastData, historicalRecords, currentTime]);



  const visibleTimelineItems = useMemo(() => {
    return processedItems.filter((item) => {
      if (!item.iso_time) return true;
      const itemTime = new Date(item.iso_time).getTime();
      if (isNaN(itemTime)) return true;
      
      // Keep items where the time is >= 5 hours before the current hour
      const currentHourStart = new Date(currentTime);
      currentHourStart.setMinutes(0, 0, 0);
      
      const pastCutoff = new Date(currentHourStart);
      pastCutoff.setHours(pastCutoff.getHours());
      
      const futureCutoff = new Date(currentHourStart);
      futureCutoff.setHours(futureCutoff.getHours() + 24);
      
      return itemTime >= pastCutoff.getTime() && itemTime <= futureCutoff.getTime();
    });
  }, [processedItems, currentTime]);



  return (
    <div className="page-container" style={{ minHeight: '85vh' }}>
      

          {/* ── Page Header ── */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 20
          }}>
        <div>
          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            >
              <Sparkles style={{ width: 26, height: 26, color: '#00bfa5' }} />
            </motion.div>
            AQI Forecast
          </h1>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastUpdated && (
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              Updated {getTimeAgo(lastUpdated)}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(0, 191, 165, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchForecastAndHistory(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#00bfa5',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 191, 165, 0.25)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </motion.button>
        </div>
      </motion.div>

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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mobile-card-compact" style={{
          background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)',
          borderRadius: 24,
          padding: '24px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
          marginBottom: 32,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Decorative Background Blob */}
          <div style={{
            position: 'absolute', top: -100, right: -100, width: 250, height: 250,
            background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, rgba(255,255,255,0) 70%)',
            borderRadius: '50%', pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10, position: 'relative', zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
                <Clock size={20} color="#0ea5e9" /> 24-Hour Timeline Overview
              </h3>
            </div>
          </div>

          {/* Horizontal Scroller Cards */}
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
            }}
            style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 16,
            paddingTop: 8,
            scrollbarWidth: 'thin',
            position: 'relative',
            zIndex: 1
          }}>
            {visibleTimelineItems.map((item) => {
              const isFirst = item.index === 0;

              // Determine Weather Icon
              let WeatherIcon = Sun;
              let iconColor = '#facc15';
              let iconFill = '#fef08a';
              
              if (item.weatherType === 'storm') {
                WeatherIcon = CloudLightning;
                iconColor = isFirst ? '#94a3b8' : '#64748b';
                iconFill = isFirst ? '#475569' : '#e2e8f0';
              } else if (item.weatherType === 'rain') {
                WeatherIcon = CloudRain;
                iconColor = isFirst ? '#7dd3fc' : '#38bdf8';
                iconFill = isFirst ? '#0284c7' : '#e0f2fe';
              } else if (item.weatherType === 'cloudy') {
                WeatherIcon = Cloud;
                iconColor = isFirst ? '#cbd5e1' : '#94a3b8';
                iconFill = isFirst ? '#64748b' : '#f1f5f9';
              } else if (item.weatherType === 'partly-cloudy') {
                WeatherIcon = item.isDaytime ? CloudSun : CloudMoon;
                iconColor = isFirst ? '#facc15' : '#f59e0b';
                iconFill = isFirst ? '#475569' : '#fef3c7';
              } else {
                WeatherIcon = item.isDaytime ? Sun : Moon;
                iconColor = isFirst ? '#facc15' : '#f59e0b';
                iconFill = isFirst ? 'rgba(250, 204, 21, 0.2)' : 'rgba(245, 158, 11, 0.2)';
              }

              return (
                <motion.div
                  key={item.index}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8, y: 15 },
                    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 20 } }
                  }}
                  whileHover={{ scale: 1.04, y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                  whileTap={{ scale: 0.96 }}
                  className="forecast-timeline-card"
                  style={{
                    flex: '0 0 115px',
                    padding: '16px 12px',
                    borderRadius: 16,
                    border: `1.5px solid ${item.aqi_border || '#e2e8f0'}`,
                    background: item.aqi_bg || '#ffffff',
                    textAlign: 'center',
                    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 180
                  }}
                >
                  <div className="forecast-timeline-hour" style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12 }}>
                    {item.display_hour}
                  </div>
                  
                  {/* Weather Icon & Temp */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
                    <WeatherIcon size={32} color={iconColor} fill={iconFill} strokeWidth={1.5} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))', marginBottom: 6 }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                      {item.temp != null ? `${item.temp}°` : (item.temperature_c != null ? `${Number(item.temperature_c).toFixed(1)}°` : '—')}
                    </span>
                  </div>

                  {/* AQI */}
                  <div className="forecast-timeline-aqi" style={{ fontSize: 24, fontWeight: 800, color: item.aqi_color, lineHeight: 1, textShadow: '0 2px 4px rgba(255,255,255,0.5)' }}>
                    {item.aqi != null ? item.aqi : '—'}
                  </div>
                  <div className="forecast-timeline-category" style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: item.aqi_color,
                    marginTop: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    background: 'rgba(255,255,255,0.6)',
                    padding: '2px 6px',
                    borderRadius: 8,
                    display: 'inline-block',
                    maxWidth: '90%'
                  }}>
                    AQI {item.aqi_category}
                  </div>
                  
                  {/* Rainfall/Wind micro indicators only when significant */}
                  {(Number(item.rain) >= 0.5 || Number(item.windSpeed) >= 20) && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid rgba(226, 232, 240, 0.6)', paddingTop: 8, width: '100%', justifyContent: 'center' }}>
                      {Number(item.rain) >= 0.5 && (
                        <span style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Droplets size={10} color="#38bdf8" /> {Number(item.rain).toFixed(1)}mm
                        </span>
                      )}
                      {Number(item.windSpeed) >= 20 && (
                        <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Wind size={10} /> {Math.round(item.windSpeed)}km/h
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* ── 24-Hour Predictive Weather Forecast ── */}
      <div style={{ marginTop: 28 }}>
        <WeatherForecast24hView refreshKey={refreshKey} />
      </div>

    </div>
  );
}
