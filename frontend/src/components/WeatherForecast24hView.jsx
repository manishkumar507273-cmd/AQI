import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
  Table as TableIcon,
  LineChart as LineChartIcon,
  Sliders,
  ArrowLeftRight,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Moon,
  Cloud,
  CloudSun,
  CloudMoon
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart
} from 'recharts';
import { getWeatherForecast24h, getCloudWeatherHistory, getTimeAgo, getCachedData } from '../api';

const WEATHER_PARAM_CONFIG = {
  temperature: { name: 'Temperature', histKey: 'temperature', unit: '°C', color: '#f43f5e', desc: 'Forecasted ambient temperature' },
  humidity: { name: 'Humidity', histKey: 'humidity', unit: '%', color: '#06b6d4', desc: 'Forecasted relative humidity' },
  wind_speed: { name: 'Wind Speed', histKey: 'wind_speed', unit: 'km/h', color: '#3b82f6', desc: 'Forecasted wind speed' },
  rain_gauge: { name: 'Rainfall', histKey: 'rain_gauge', unit: 'mm', color: '#0ea5e9', desc: 'Forecasted rainfall amount' }
};

export default function WeatherForecast24hView({ refreshKey }) {
  const [forecastData, setForecastData] = useState(() => getCachedData('CACHE_WEATHER_FORECAST_24H'));
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [loading, setLoading] = useState(() => !getCachedData('CACHE_WEATHER_FORECAST_24H'));
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeParam, setActiveParam] = useState('temperature');
  const [activeView, setActiveView] = useState('chart');
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [showComparison, setShowComparison] = useState(false);

  const isFetchingRef = useRef(false);

  const fetchForecastAndHistory = async (force = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (force || !forecastData) setLoading(true);
    setError(null);

    try {
      const [fcRes, histRes] = await Promise.allSettled([
        getWeatherForecast24h(force),
        getCloudWeatherHistory(24)
      ]);

      if (fcRes.status === 'fulfilled' && fcRes.value?.data?.status === 'success' && Array.isArray(fcRes.value.data.forecast)) {
        setForecastData(fcRes.value.data);
        setLastUpdated(new Date());
      } else if (!forecastData) {
        setError(fcRes.value?.data?.message || 'Failed to retrieve 24h weather forecast.');
      }

      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value?.data?.history)) {
        setHistoricalRecords(histRes.value.data.history);
      }
    } catch (err) {
      if (!forecastData) {
        setError(err?.message || 'Network error fetching weather forecast.');
      }
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

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

  const processedItems = useMemo(() => {
    const forecastItems = (forecastData?.forecast || []).map((item) => {
      const dt = new Date(item.forecast_for_time);
      const hourStr = isNaN(dt.getTime()) ? `+${item.step}h` : dt.toLocaleTimeString([], { hour: 'numeric', hour12: true });
      const dayStr = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

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
      
      return {
        ...item,
        display_hour: hourStr,
        display_date: dayStr,
        iso_time: item.forecast_for_time,
        hasActual,
        actualRecord: matchingActual || null,
        actual_temperature: hasActual ? matchingActual.temperature : null,
        actual_humidity: hasActual ? matchingActual.humidity : null,
        actual_wind_speed: hasActual ? matchingActual.wind_speed : null,
        actual_rain_gauge: hasActual ? matchingActual.rain_gauge : null,
        delta_temperature: hasActual && matchingActual.temperature != null ? matchingActual.temperature - item.temperature : null,
        delta_humidity: hasActual && matchingActual.humidity != null ? matchingActual.humidity - item.humidity : null,
        delta_wind_speed: hasActual && matchingActual.wind_speed != null ? matchingActual.wind_speed - item.wind_speed : null,
        delta_rain_gauge: hasActual && matchingActual.rain_gauge != null ? matchingActual.rain_gauge - item.rain_gauge : null,
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
          const hourStr = pastTime.toLocaleTimeString([], { hour: 'numeric', hour12: true });
          const dayStr = pastTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

          pastItems.push({
            isPast: true,
            step: -i,
            display_hour: hourStr,
            display_date: dayStr,
            iso_time: pastTime.toISOString(),
            temperature: matchingActual.temperature,
            humidity: matchingActual.humidity,
            wind_speed: matchingActual.wind_speed,
            rain_gauge: matchingActual.rain_gauge,
            hasActual: true,
            actualRecord: matchingActual,
            actual_temperature: matchingActual.temperature,
            actual_humidity: matchingActual.humidity,
            actual_wind_speed: matchingActual.wind_speed,
            actual_rain_gauge: matchingActual.rain_gauge,
            delta_temperature: null,
            delta_humidity: null,
            delta_wind_speed: null,
            delta_rain_gauge: null
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
      
      const currentHourStart = new Date(currentTime);
      currentHourStart.setMinutes(0, 0, 0);

      const pastCutoff = new Date(currentHourStart);
      pastCutoff.setHours(pastCutoff.getHours() - 5);

      const futureCutoff = new Date(currentHourStart);
      futureCutoff.setHours(futureCutoff.getHours() + 24);
      
      return itemTime >= pastCutoff.getTime() && itemTime <= futureCutoff.getTime();
    });
  }, [processedItems, currentTime]);

  const renderDualCell = (actVal, fcVal, unit = '', decimals = 1, isPast = false) => {
    const hasAct = actVal != null && !isNaN(Number(actVal));
    const hasFc = fcVal != null && !isNaN(Number(fcVal)) && !isPast;

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
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles style={{ width: 22, height: 22, color: '#3b82f6' }} />
            Weather Forecast (24h)
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13.5 }}>
            <span className="desktop-only-inline">Node 1 24-Hour horizon (t+1 → t+24) with MultiKernel CNN-LSTM and real-time telemetry sync.</span>
            <span className="mobile-only-inline">24-Hour predictive AI horizon &amp; telemetry sync</span>
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px 20px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={20} />
          <div style={{ fontSize: 13.5 }}><strong>Notice:</strong> {error}</div>
        </div>
      )}

      {/* 24-Hour Quick Timeline Scrubber */}
      {processedItems.length > 0 && (
        <div className="mobile-card-compact" style={{
          background: '#f8fafc', // Light grey-blue container
          borderRadius: 18,
          padding: '20px 24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Clock size={18} color="#0ea5e9" /> Weather Forecast
              </h3>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: 4, // Tighter gap for floating cards
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 8,
            scrollbarWidth: 'thin'
          }}>
            {visibleTimelineItems.map((item, i) => {
              const isFirst = item.index === 0;
              const hasRain = Number(item.rain_gauge) > 0;
              
              const dt = new Date(item.iso_time);
              const hour = isNaN(dt.getTime()) ? new Date().getHours() : dt.getHours();
              const isNight = hour >= 19 || hour < 6; // After 7 PM or before 6 AM is night
              
              const temp = Number(item.temperature ?? item.temperature_c) || 0;
              const hum = Number(item.humidity ?? item.humidity_pct) || 0;
              
              let weatherType = 'clear';
              if (hasRain) weatherType = 'rain';
              else if (hum > 85) weatherType = 'cloudy';
              else if (hum > 65) weatherType = 'partly-cloudy';

              const WeatherIcon = 
                weatherType === 'rain' ? CloudRain :
                weatherType === 'cloudy' ? Cloud :
                weatherType === 'partly-cloudy' ? (isNight ? CloudMoon : CloudSun) : 
                isNight ? Moon : Sun;

              const iconColor = 
                weatherType === 'rain' ? '#0ea5e9' :
                weatherType === 'cloudy' ? '#94a3b8' :
                weatherType === 'partly-cloudy' ? '#fbbf24' :
                isNight ? '#818cf8' : '#facc15';

              const iconFill = 
                weatherType === 'rain' ? '#e0f2fe' :
                weatherType === 'cloudy' ? '#f1f5f9' :
                weatherType === 'partly-cloudy' ? '#fef3c7' :
                isNight ? 'rgba(129, 140, 248, 0.25)' : 'rgba(250, 204, 21, 0.35)';

              return (
                <motion.div
                  key={item.index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                  whileHover={{ 
                    scale: 1.05, 
                    y: -4, 
                    boxShadow: isFirst 
                      ? '0 12px 24px rgba(59, 130, 246, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.9)' 
                      : '0 8px 16px rgba(15, 23, 42, 0.08), inset 0 2px 4px rgba(255, 255, 255, 0.9)'
                  }}
                  className="forecast-timeline-card"
                  style={{
                    flex: '0 0 86px', 
                    padding: '16px 10px',
                    borderRadius: 24,
                    background: isFirst 
                      ? 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)' 
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    boxShadow: isFirst 
                      ? '0 4px 14px rgba(59, 130, 246, 0.1), inset 0 2px 4px rgba(255, 255, 255, 1)' 
                      : '0 2px 8px rgba(15, 23, 42, 0.04), inset 0 1px 2px rgba(255, 255, 255, 1)',
                    border: isFirst ? '1px solid #bae6fd' : '1px solid #f1f5f9',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 14,
                    cursor: 'default',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isFirst && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #0ea5e9)' }} />
                  )}
                  <div style={{ fontSize: 13, fontWeight: isFirst ? 800 : 600, color: isFirst ? '#0284c7' : '#475569' }}>
                    {isFirst ? 'Now' : item.display_hour}
                  </div>
                  
                  {/* Visual Weather/Rain Icon with motion */}
                  <motion.div 
                    whileHover={{ rotate: weatherType === 'clear' ? (isNight ? [0, 10, -5, 0] : [0, -10, 10, -10, 0]) : 0, scale: 1.1 }}
                    style={{ display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.06))' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <WeatherIcon size={32} color={iconColor} strokeWidth={2} fill={iconFill} />
                      {hasRain && Number(item.rain_gauge) >= 2 && (
                        <div style={{ position: 'absolute', top: -4, right: -6, background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 5px', borderRadius: 12, boxShadow: '0 2px 4px rgba(239,68,68,0.3)' }}>!</div>
                      )}
                    </div>
                  </motion.div>
                  
                  {/* Vertical Values (Wind & Rain) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: '#1e293b' }} title="Wind Speed (km/h)">
                      <Wind size={13} color="#94a3b8" strokeWidth={2.5} />
                      {Math.round(Number(item.wind_speed || 0))} <span style={{fontSize: 10, color:'#94a3b8', fontWeight:600}}>km/h</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: hasRain ? '#0ea5e9' : '#cbd5e1' }} title="Rainfall (mm)">
                      <Droplets size={13} color={hasRain ? "#38bdf8" : "#e2e8f0"} strokeWidth={2.5} />
                      {hasRain ? Number(item.rain_gauge).toFixed(1) : 0} <span style={{fontSize: 10, color:hasRain ? '#7dd3fc' : '#cbd5e1', fontWeight:600}}>mm</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
