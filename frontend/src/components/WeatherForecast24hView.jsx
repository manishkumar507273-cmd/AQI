import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  Clock,
  AlertCircle,
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
import { getWeatherForecast24h, getCloudWeatherHistory, getTimeAgo, getCachedData } from '../api';

export default function WeatherForecast24hView({ refreshKey }) {
  const [forecastData, setForecastData] = useState(() => {
    const c = getCachedData('CACHE_WEATHER_FORECAST_24H');
    if (c?.forecast && Array.isArray(c.forecast)) {
      const firstT = Number(c.forecast[0]?.temperature);
      const isFlat = isNaN(firstT) || firstT === 0 || c.forecast.every(it => Math.abs(Number(it.temperature) - firstT) < 0.001);
      if (isFlat) return null;
    }
    return c;
  });
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

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



  return (
    <div style={{ width: '100%' }}>
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}
      >
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 2 }}
            >
              <Sparkles style={{ width: 26, height: 26, color: '#3b82f6' }} />
            </motion.div>
            Weather Forecast
          </h1>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {lastUpdated && (
            <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
              Updated {getTimeAgo(lastUpdated)}
            </span>
          )}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchForecastAndHistory(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
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
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14, padding: '16px 20px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={20} />
          <div style={{ fontSize: 13.5 }}><strong>Notice:</strong> {error}</div>
        </div>
      )}

      {/* 24-Hour Quick Timeline Scrubber */}
      {processedItems.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="mobile-card-compact" style={{
          background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)',
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
            position: 'absolute', top: -100, left: -100, width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(250,204,21,0.06) 0%, rgba(255,255,255,0) 70%)',
            borderRadius: '50%', pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10, position: 'relative', zIndex: 1 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.02em' }}>
                <CloudSun size={20} color="#f59e0b" /> Weather Timeline
              </h3>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: 12, // Tighter gap for floating cards
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 16,
            paddingTop: 8,
            scrollbarWidth: 'thin',
            position: 'relative',
            zIndex: 1
          }}>
            {visibleTimelineItems.map((item, i) => {
              const isFirst = item.index === 0;
              const hasRain = Number(item.rain_gauge) >= 0.5;
              
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

                  {/* Temperature Readout */}
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2, marginBottom: 2 }}>
                    {temp > 0 ? `${temp.toFixed(1)}°` : (item.actual_temperature != null ? `${Number(item.actual_temperature).toFixed(1)}°` : '—')}
                  </div>

                  {/* Vertical Values (Wind & Rain / Humidity) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: '#1e293b' }} title="Wind Speed (km/h)">
                      <Wind size={13} color="#94a3b8" strokeWidth={2.5} />
                      {Math.round(Number(item.wind_speed || 0))} <span style={{fontSize: 10, color:'#94a3b8', fontWeight:600}}>km/h</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: Number(item.rain_gauge) > 0 ? '#0ea5e9' : '#64748b' }} title="Precipitation (mm)">
                      <Droplets size={13} color={Number(item.rain_gauge) > 0 ? "#38bdf8" : "#94a3b8"} strokeWidth={2.5} />
                      {Number(item.rain_gauge || 0).toFixed(1)} <span style={{fontSize: 10, color: Number(item.rain_gauge) > 0 ? '#7dd3fc' : '#94a3b8', fontWeight:600}}>mm</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

    </div>
  );
}
