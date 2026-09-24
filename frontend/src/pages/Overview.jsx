import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  RefreshCw,
  Clock,
  Sparkles,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  getCloudLatest,
  getWeatherLatest,
  getTimeAgo,
  getAqiForecast,
  getCloudHistory,
  getCachedData
} from '../api';

// Format helper ensuring exact decimal precision across telemetry pages
const fmt = (val, d = 3) =>
  val != null && !isNaN(Number(val)) ? Number(val).toFixed(d) : null;

// Calculate Dew Point from Temperature (°C) and Humidity (%)
const calcDewPoint = (temp, hum) => {
  if (temp == null || hum == null || hum <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * temp) / (b + temp)) + Math.log(hum / 100.0);
  return Number(((b * alpha) / (a - alpha)).toFixed(1));
};

// Calculate Heat Index / "Feels Like" in Celsius
const calcFeelsLike = (temp, hum) => {
  if (temp == null) return null;
  if (hum == null || temp < 20) return Number(temp.toFixed(1));
  const tf = (temp * 9 / 5) + 32;
  const c1 = -42.379, c2 = 2.04901523, c3 = 10.14333127, c4 = -0.22475541;
  const c5 = -0.00683783, c6 = -0.05481717, c7 = 0.00122874, c8 = 0.00085282, c9 = -0.00000199;
  const hiF = c1 + (c2 * tf) + (c3 * hum) + (c4 * tf * hum) + (c5 * tf * tf) +
    (c6 * hum * hum) + (c7 * tf * tf * hum) + (c8 * tf * hum * hum) + (c9 * tf * tf * hum * hum);
  const hiC = (hiF - 32) * 5 / 9;
  return Number(Math.max(temp, hiC).toFixed(1));
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

const getForecastAqiCategory = (val) => {
  if (val == null || isNaN(Number(val))) {
    return { label: 'Pending', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' };
  }
  const v = Math.round(Number(val) || 0);
  if (v <= 50) return { label: 'Good', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' };
  if (v <= 100) return { label: 'Satisfactory', color: '#84cc16', bg: '#f7fee7', border: '#d9f99d', text: '#3f6212' };
  if (v <= 200) return { label: 'Moderate', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
  if (v <= 300) return { label: 'Poor', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' };
  if (v <= 400) return { label: 'Very Poor', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
  return { label: 'Severe', color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' };
};

export default function Overview({ refreshKey = 0, selectedStation = 'station-1', onNavigate }) {
  const [aqiData, setAqiData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F'
  const [windUnit, setWindUnit] = useState('kmh'); // 'kmh' | 'ms'
  const canvasRef = useRef(null);

  // 24-Hour Predictive Forecast States
  const [forecastData, setForecastData] = useState(() => getCachedData('CACHE_AQI_NODE1_FORECAST_24H'));
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [forecastLoading, setForecastLoading] = useState(() => !getCachedData('CACHE_AQI_NODE1_FORECAST_24H'));
  const [forecastLastUpdated, setForecastLastUpdated] = useState(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Ultra-Smooth Drag & Horizontal Mouse-Wheel Scrolling
  const timelineScrollerRef = useRef(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  useEffect(() => {
    const el = timelineScrollerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      // Direct 1:1 wheel scroll without queuing sluggish animations
      if (Math.abs(e.deltaY) > 0 && !e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY * 1.1;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleMouseDownTimeline = (e) => {
    if (!timelineScrollerRef.current) return;
    setIsDraggingTimeline(true);
    dragStartX.current = e.pageX - timelineScrollerRef.current.offsetLeft;
    dragScrollLeft.current = timelineScrollerRef.current.scrollLeft;
  };

  const handleMouseLeaveOrUpTimeline = () => {
    setIsDraggingTimeline(false);
  };

  const handleMouseMoveTimeline = (e) => {
    if (!isDraggingTimeline || !timelineScrollerRef.current) return;
    e.preventDefault();
    const x = e.pageX - timelineScrollerRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.3;
    timelineScrollerRef.current.scrollLeft = dragScrollLeft.current - walk;
  };

  const scrollTimeline = (direction) => {
    if (!timelineScrollerRef.current) return;
    const offset = direction === 'left' ? -260 : 260;
    timelineScrollerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  // Fetch telemetry from both tables
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [aqiRes, weatherRes] = await Promise.allSettled([
        getCloudLatest(),
        getWeatherLatest()
      ]);

      if (aqiRes.status === 'fulfilled' && aqiRes.value?.data?.data) {
        setAqiData(aqiRes.value.data.data);
      }
      if (weatherRes.status === 'fulfilled' && weatherRes.value?.data?.data) {
        setWeatherData(weatherRes.value.data.data);
      }
    } catch (err) {
      console.error('Error fetching live overview data:', err);
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshKey, selectedStation]);

  // Fetch 24-Hour AI Predictive Forecast and Historical Actuals
  const fetchForecast = async (force = false) => {
    if (force || !forecastData) setForecastLoading(true);
    try {
      const [fcRes, histRes] = await Promise.allSettled([
        getAqiForecast(force),
        getCloudHistory(100)
      ]);

      if (fcRes.status === 'fulfilled' && fcRes.value?.data?.status === 'success' && Array.isArray(fcRes.value.data.forecast)) {
        const incoming = fcRes.value.data;
        setForecastData((prev) => {
          if (!prev || !prev.generated_at || !incoming.generated_at) return incoming;
          const prevTime = new Date(prev.generated_at).getTime();
          const incomingTime = new Date(incoming.generated_at).getTime();
          if (!isNaN(incomingTime) && !isNaN(prevTime) && incomingTime < prevTime) return prev;
          return incoming;
        });
        setForecastLastUpdated(new Date());
      }

      if (histRes.status === 'fulfilled' && Array.isArray(histRes.value?.data?.history)) {
        setHistoricalRecords(histRes.value.data.history);
      }
    } catch (err) {
      console.error('Failed to fetch forecast:', err);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast(false);
  }, [refreshKey]);

  // Process 24-Hour Forecast Items
  const processedForecastItems = useMemo(() => {
    if (!forecastData?.forecast) return [];
    return forecastData.forecast.map((item, index) => {
      const subPm25 = calculateSubIndex('pm25', item.pm2_5_ug_m3);
      const subPm10 = calculateSubIndex('pm10', item.pm10_ug_m3);
      const subNo2 = calculateSubIndex('no2', item.no2_ug_m3);
      const subCo = calculateSubIndex('co', item.co_mg_m3);
      const subO3 = calculateSubIndex('o3', item.ozone_ug_m3);

      const maxSub = Math.max(subPm25, subPm10, subNo2, subCo, subO3);
      const cat = getForecastAqiCategory(maxSub);

      const dt = new Date(item.forecast_for_time);
      const hourStr = isNaN(dt.getTime())
        ? `+${item.step}h`
        : dt.toLocaleTimeString([], { hour: 'numeric', hour12: true }).toLowerCase();

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

      const hourNum = !isNaN(dt.getTime()) ? dt.getHours() : 12;
      const isDaytime = hourNum >= 6 && hourNum < 18;

      return {
        ...item,
        index,
        display_hour: hourStr,
        isDaytime,
        aqi: maxSub,
        aqi_category: cat.label,
        aqi_color: cat.color,
        aqi_bg: cat.bg,
        aqi_border: cat.border,
        hasActual,
        actual_aqi: actualAqi,
      };
    });
  }, [forecastData, historicalRecords]);

  const visibleForecastTimelineItems = processedForecastItems;


  // Derived values
  const aqiVal = aqiData?.cpcb_aqi ?? 0;
  const aqiCategory = useMemo(() => {
    if (aqiVal <= 50) return { label: 'Good', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', text: '#15803d' };
    if (aqiVal <= 100) return { label: 'Satisfactory', color: '#65a30d', bg: '#f7fee7', border: '#bef264', text: '#3f6212' };
    if (aqiVal <= 200) return { label: 'Moderate', color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' };
    if (aqiVal <= 300) return { label: 'Poor', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' };
    if (aqiVal <= 400) return { label: 'Very Poor', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', text: '#991b1b' };
    return { label: 'Severe', color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8' };
  }, [aqiVal]);

  // Weather station readings (strictly from WEATHER_LIVE_NODE1)
  const rawTemp = weatherData?.temperature;
  const rawHum = weatherData?.humidity;
  const rawWind = weatherData?.wind_speed;
  const rawRain = weatherData?.rain_gauge;
  const windDirRaw = weatherData?.wind_direction;
  const windGust = weatherData?.wind_gust;

  const displayTemp = rawTemp != null
    ? (tempUnit === 'F' ? ((rawTemp * 9 / 5) + 32).toFixed(1) : (fmt(rawTemp, 1) ?? Number(rawTemp).toFixed(1)))
    : '--';
  const feelsLike = (rawTemp != null && rawHum != null) ? calcFeelsLike(Number(rawTemp), Number(rawHum)) : null;
  const displayFeelsLike = feelsLike != null
    ? (tempUnit === 'F' ? ((feelsLike * 9 / 5) + 32).toFixed(1) : feelsLike)
    : null;

  const displayHumidity = rawHum != null ? (fmt(rawHum, 1) ?? Number(rawHum).toFixed(1)) : '--';
  const dewPoint = (rawTemp != null && rawHum != null) ? calcDewPoint(Number(rawTemp), Number(rawHum)) : null;

  const displayWind = rawWind != null
    ? (windUnit === 'ms' ? (Number(rawWind) / 3.6).toFixed(3) : (fmt(rawWind, 3) ?? Number(rawWind).toFixed(3)))
    : '--';
  const displayWindUnit = windUnit === 'ms' ? 'm/s' : 'km/h';
  const windKmh = rawWind != null ? Number(rawWind) : null;
  const windStatus = windKmh != null ? (windKmh > 15 ? 'Breezy' : (windKmh > 2 ? 'Gentle' : 'Light')) : 'Calm';

  const displayRain = rawRain != null ? (fmt(rawRain, 3) ?? Number(rawRain).toFixed(3)) : '--';
  const isRaining = rawRain != null && Number(rawRain) > 0;

  // ══════════════════════════════════════════════════════════════════════════
  // Dynamic Environmental Animation System (Light Atmospheric Theme)
  // Renders breeze air streams, floating mist motes, sunbeams, and rain ripples
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const handleResize = () => {
      canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.offsetHeight || window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const windKmh = Number(rawWind ?? 3.5);
    const speedFactor = Math.max(0.6, (windKmh / 10.0));

    // Particle pool: breeze particles, mist motes, and raindrop ripples
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 3 + 1.5,
      speedX: (0.4 + Math.random() * 0.8) * speedFactor,
      speedY: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.25 + 0.1,
      angle: Math.random() * Math.PI * 2,
      waveFreq: Math.random() * 0.02 + 0.01,
      waveAmp: Math.random() * 1.5 + 0.5,
    }));

    // Wind Stream Ribbons flowing horizontally
    const streamRibbons = Array.from({ length: 4 }, (_, i) => ({
      y: (canvas.height / 5) * (i + 1) + (Math.random() - 0.5) * 40,
      length: canvas.width * 0.45 + Math.random() * 100,
      x: Math.random() * canvas.width,
      speed: (1.2 + i * 0.4) * speedFactor,
      thickness: 1.2 + Math.random() * 1.2,
      opacity: 0.12 + Math.random() * 0.12,
    }));

    let tick = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick += 0.02;

      // 1. Draw Organic Air Streams (Smooth Breezy Ribbons)
      for (const rib of streamRibbons) {
        ctx.beginPath();
        const grad = ctx.createLinearGradient(rib.x, rib.y, rib.x + rib.length, rib.y);
        grad.addColorStop(0, 'rgba(0, 191, 165, 0)');
        grad.addColorStop(0.5, `rgba(14, 165, 233, ${rib.opacity})`);
        grad.addColorStop(1, 'rgba(0, 191, 165, 0)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = rib.thickness;
        ctx.lineCap = 'round';

        ctx.moveTo(rib.x, rib.y);
        for (let x = 0; x < rib.length; x += 20) {
          const cy = rib.y + Math.sin((rib.x + x) * 0.01 + tick) * 8;
          ctx.lineTo(rib.x + x, cy);
        }
        ctx.stroke();

        rib.x += rib.speed;
        if (rib.x > canvas.width + 100) {
          rib.x = -rib.length - 50;
          rib.y = (canvas.height / 5) * (Math.floor(Math.random() * 4) + 1);
        }
      }

      // 2. Draw Floating Clean Air Motes / Droplets
      for (const p of particles) {
        ctx.beginPath();
        p.angle += p.waveFreq;
        const currentY = p.y + Math.sin(p.angle) * p.waveAmp;

        if (isRaining) {
          // Rain streak mode
          ctx.strokeStyle = `rgba(56, 189, 248, ${p.alpha * 1.5})`;
          ctx.lineWidth = 1.6;
          ctx.moveTo(p.x, currentY);
          ctx.lineTo(p.x + p.speedX * 0.8, currentY + 12);
          ctx.stroke();
          p.y += 9 + Math.random() * 4;
        } else {
          // Ambient glowing mist particle
          const particleGrad = ctx.createRadialGradient(p.x, currentY, 0, p.x, currentY, p.radius * 2);
          particleGrad.addColorStop(0, `rgba(0, 191, 165, ${p.alpha})`);
          particleGrad.addColorStop(0.7, `rgba(56, 189, 248, ${p.alpha * 0.6})`);
          particleGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = particleGrad;
          ctx.arc(p.x, currentY, p.radius * 2, 0, Math.PI * 2);
          ctx.fill();
          p.y += p.speedY;
        }

        p.x += p.speedX;

        // Boundary wrap
        if (p.x > canvas.width + 20) p.x = -20;
        if (p.y > canvas.height + 20) p.y = -20;
        if (p.y < -20) p.y = canvas.height + 20;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isRaining, rawWind]);

  // AQI Radial Dial Parameters
  const aqiPercent = Math.min(100, Math.max(0, (aqiVal / 300) * 100));
  const strokeDashoffset = 283 - (283 * aqiPercent) / 100;

  return (
    <div className="overview-page-root" style={{
      position: 'relative',
      minHeight: '85vh',
      borderRadius: 24,
      overflow: 'hidden',
      padding: 'clamp(16px, 3vw, 28px)',
      background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #e2e8f0 0%, #f1f5f9 60%, #e2e8f0 100%)',
      color: '#0f172a',
      fontFamily: 'var(--font-sans)',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
    }}>
      {/* ── Dynamic Ambient Canvas ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.9,
        }}
      />

      {/* Floating Environmental Pastel Auras */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-5%',
        width: '45vw',
        height: '45vw',
        maxWidth: 500,
        maxHeight: 500,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${aqiCategory.color}15 0%, rgba(241, 245, 249, 0) 70%)`,
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'breathAtmosphere 10s ease-in-out infinite alternate',
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-5%',
        width: '45vw',
        height: '45vw',
        maxWidth: 500,
        maxHeight: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(241, 245, 249, 0) 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Content Container ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Overview Unit Toggles & Live Refresh ── */}
        <div className="overview-toolbar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 4,
        }}>
          {/* Temperature & Wind Unit Toggles Container */}
          <div className="overview-toolbar-units" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Temperature Unit Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: '#ffffff',
              borderRadius: 999,
              padding: 3,
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}>
              <button
                onClick={() => setTempUnit('C')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: tempUnit === 'C' ? '#00bfa5' : 'transparent',
                  color: tempUnit === 'C' ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('F')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: tempUnit === 'F' ? '#00bfa5' : 'transparent',
                  color: tempUnit === 'F' ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                °F
              </button>
            </div>

            {/* Wind Unit Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: '#ffffff',
              borderRadius: 999,
              padding: 3,
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}>
              <button
                onClick={() => setWindUnit('kmh')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: windUnit === 'kmh' ? '#0284c7' : 'transparent',
                  color: windUnit === 'kmh' ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                km/h
              </button>
              <button
                onClick={() => setWindUnit('ms')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: windUnit === 'ms' ? '#0284c7' : 'transparent',
                  color: windUnit === 'ms' ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease',
                }}
              >
                m/s
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="overview-refresh-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw style={{ width: 13, height: 13, color: '#00bfa5', animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            <span>{isRefreshing ? 'Updating...' : 'Live Refresh'}</span>
          </button>
        </div>

        {/* ── 5 Core Telemetry Cards in Harmonious, Compact Light Palette ── */}
        <div className="overview-grid">

          {/* ════════ CARD 1: AIR QUALITY INDEX ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.04 }}
            className="overview-core-card"
            style={{
              borderColor: `${aqiCategory.color}40`,
            }}
          >
            {/* Top vibrant gradient accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${aqiCategory.color}, #06b6d4)`,
            }} />

            {/* Header: Icon + Title + Status Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="overview-card-icon" style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: aqiCategory.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: aqiCategory.color,
                  border: `1px solid ${aqiCategory.border}`,
                }}>
                  <Gauge style={{ width: 15, height: 15 }} />
                </div>
                <div>
                  <h4 className="overview-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
                    Air Quality
                  </h4>
                </div>
              </div>

              <span className="overview-card-badge" style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: aqiCategory.bg,
                color: aqiCategory.text,
                border: `1px solid ${aqiCategory.border}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: aqiCategory.color }} />
                {aqiCategory.label}
              </span>
            </div>

            {/* Main Value + Creative Mini Radial Arc Dial */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span className="overview-card-val" style={{
                    fontSize: 32,
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                    color: aqiCategory.color,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {loading ? '--' : aqiVal}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
                    / 500
                  </span>
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: '#64748b' }}>
                  Dominant: <strong style={{ color: '#0f172a' }}>{aqiData?.dominant_pollutant || 'O₃'}</strong>
                </div>
              </div>

              {/* Creative Mini Circular Dial */}
              <div className="overview-card-dial" style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                <svg width="44" height="44" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke={aqiCategory.color}
                    strokeWidth="12"
                    strokeDasharray="238.7"
                    strokeDashoffset={238.7 - (238.7 * Math.min(100, Math.max(0, (aqiVal / 500) * 100))) / 100}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: aqiCategory.color,
                }}>
                  {Math.round(Math.min(100, (aqiVal / 500) * 100))}%
                </div>
              </div>
            </div>

            {/* Micro AQI Progress Bar with Calibrated Range Scale */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{
                height: 5,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(4, (aqiVal / 500) * 100))}%`,
                  background: `linear-gradient(90deg, #10b981 0%, ${aqiCategory.color} 100%)`,
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div className="overview-bar-scale">
                <span>0</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>100</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>500</span>
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 2: AMBIENT TEMPERATURE ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="overview-core-card"
            style={{
              borderColor: '#fed7aa',
            }}
          >
            {/* Top vibrant gradient accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(90deg, #ea580c, #facc15)',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="overview-card-icon" style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: '#fff7ed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                  border: '1px solid #fed7aa',
                }}>
                  <Thermometer style={{ width: 15, height: 15 }} />
                </div>
                <div>
                  <h4 className="overview-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
                    Temperature
                  </h4>
                </div>
              </div>

              <span className="overview-card-badge" style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #fed7aa',
              }}>
                {displayTemp !== '--' ? (Number(displayTemp) > 30 ? 'Warm' : (Number(displayTemp) < 22 ? 'Cool' : 'Pleasant')) : '—'}
              </span>
            </div>

            {/* Main Value + Creative Thermo Glyphs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="overview-card-val" style={{
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: '#ea580c',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayTemp}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  °{tempUnit}
                </span>
              </div>

              {/* Secondary Telemetry: Feels Like */}
              {displayFeelsLike != null && (
                <div className="overview-sub-badge" style={{
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#ea580c',
                }}>
                  Feels {displayFeelsLike}°{tempUnit}
                </div>
              )}
            </div>

            {/* Micro Thermal Progress Bar with Range Scale */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{
                height: 5,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${rawTemp != null ? Math.min(100, Math.max(5, ((Number(rawTemp) - 10) / 35) * 100)) : 0}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #facc15 50%, #ea580c 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div className="overview-bar-scale">
                <span>{tempUnit === 'F' ? '59°' : '15°'}</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>{tempUnit === 'F' ? '82°' : '28°'}</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>{tempUnit === 'F' ? '104°' : '40°'}</span>
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 3: RELATIVE HUMIDITY ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            className="overview-core-card"
            style={{
              borderColor: '#bae6fd',
            }}
          >
            {/* Top vibrant gradient accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="overview-card-icon" style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: '#f0f9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  border: '1px solid #bae6fd',
                }}>
                  <Droplets style={{ width: 15, height: 15 }} />
                </div>
                <div>
                  <h4 className="overview-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
                    Humidity
                  </h4>
                </div>
              </div>

              <span className="overview-card-badge" style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
              }}>
                {displayHumidity !== '--' ? (Number(displayHumidity) > 75 ? 'Humid' : (Number(displayHumidity) < 40 ? 'Dry' : 'Comfort')) : '—'}
              </span>
            </div>

            {/* Main Value + Creative Wave Moisture Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="overview-card-val" style={{
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: '#0284c7',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayHumidity}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>
                  %
                </span>
              </div>

              {/* Secondary Telemetry: Dew Point */}
              {dewPoint != null && (
                <div className="overview-sub-badge" style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0284c7',
                }}>
                  Dew {tempUnit === 'F' ? ((dewPoint * 9 / 5) + 32).toFixed(1) : dewPoint}°{tempUnit}
                </div>
              )}
            </div>

            {/* Micro Humidity Liquid Bar with Range Scale */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{
                height: 5,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${displayHumidity !== '--' ? Math.min(100, Math.max(5, Number(displayHumidity))) : 0}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div className="overview-bar-scale">
                <span>20% Dry</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>55%</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>90% Humid</span>
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 4: WIND SPEED ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.16 }}
            className="overview-core-card"
            style={{
              borderColor: '#a7f3d0',
            }}
          >
            {/* Top vibrant gradient accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'linear-gradient(90deg, #059669, #10b981)',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="overview-card-icon" style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}>
                  <Wind style={{ width: 15, height: 15 }} />
                </div>
                <div>
                  <h4 className="overview-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
                    Wind Speed
                  </h4>
                </div>
              </div>

              <span className="overview-card-badge" style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
              }}>
                {windStatus}
              </span>
            </div>

            {/* Main Value + Creative Breeze Equalizer Bars */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="overview-card-val" style={{
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: '#059669',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayWind}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                  {displayWindUnit}
                </span>
              </div>

              {/* Creative 4-Bar Breeze Intensity Equalizer */}
              <div className="overview-wind-equalizer" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 16 }}>
                {[1, 2, 3, 4].map((barIdx) => {
                  const active = windKmh != null && windKmh >= barIdx * 2.5;
                  return (
                    <div
                      key={barIdx}
                      style={{
                        width: 3.5,
                        height: 5 + barIdx * 3,
                        borderRadius: 2,
                        backgroundColor: active ? '#059669' : '#e2e8f0',
                        transition: 'background-color 0.3s ease',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Micro Wind Progress Bar with Range Scale */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{
                height: 5,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${displayWind !== '--' ? Math.min(100, Math.max(4, (Number(displayWind) / (windUnit === 'ms' ? 8.3 : 30)) * 100)) : 0}%`,
                  background: 'linear-gradient(90deg, #34d399 0%, #059669 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div className="overview-bar-scale">
                <span>0</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>{windUnit === 'ms' ? '4.2' : '15'}</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>{windUnit === 'ms' ? '8.3 m/s' : '30 km/h'}</span>
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 5: RAINFALL ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.2 }}
            className="overview-core-card"
            style={{
              borderColor: isRaining ? '#7dd3fc' : '#c7d2fe',
            }}
          >
            {/* Top vibrant gradient accent line */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: isRaining
                ? 'linear-gradient(90deg, #0284c7, #38bdf8)'
                : 'linear-gradient(90deg, #6366f1, #818cf8)',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div className="overview-card-icon" style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: isRaining ? '#f0f9ff' : '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRaining ? '#0284c7' : '#4f46e5',
                  border: isRaining ? '1px solid #bae6fd' : '1px solid #c7d2fe',
                }}>
                  <CloudRain style={{ width: 15, height: 15 }} />
                </div>
                <div>
                  <h4 className="overview-card-title" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.15 }}>
                    Rainfall
                  </h4>
                </div>
              </div>

              <span className="overview-card-badge" style={{
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: isRaining ? '#e0f2fe' : '#eef2ff',
                color: isRaining ? '#0369a1' : '#4338ca',
                border: isRaining ? '1px solid #bae6fd' : '1px solid #c7d2fe',
              }}>
                {rawRain == null ? '—' : (isRaining ? '🌧️ Rain' : 'Dry')}
              </span>
            </div>

            {/* Main Value + Creative Precipitation Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span className="overview-card-val" style={{
                  fontSize: 32,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: isRaining ? '#0284c7' : '#4f46e5',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayRain}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                  mm
                </span>
              </div>

              {/* Secondary Telemetry: Precipitation State */}
              <div className="overview-sub-badge" style={{
                background: isRaining ? '#e0f2fe' : '#eef2ff',
                border: `1px solid ${isRaining ? '#bae6fd' : '#c7d2fe'}`,
                color: isRaining ? '#0369a1' : '#4338ca',
              }}>
                {isRaining ? 'Precipitating' : 'No Rain'}
              </div>
            </div>

            {/* Micro Rain Progress Bar with Range Scale */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{
                height: 5,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
                marginBottom: 4,
              }}>
                <div style={{
                  height: '100%',
                  width: `${displayRain !== '--' ? Math.min(100, Math.max(isRaining ? 15 : 2, (Number(displayRain) / 50) * 100)) : 0}%`,
                  background: isRaining
                    ? 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)'
                    : 'linear-gradient(90deg, #818cf8 0%, #4f46e5 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
              <div className="overview-bar-scale">
                <span>Dry</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>15mm</span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span>50mm</span>
              </div>
            </div>
          </motion.div>

        </div>

        {/* ── Bespoke Atmospheric 24-Hour Predictive Horizon ── */}
        <div className="overview-forecast-section" style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Distinctive Ambient Header */}
          <div className="overview-forecast-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h2 className="overview-forecast-title" style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 9,
              }}>
                <Sparkles style={{ width: 22, height: 22, color: '#00bfa5' }} />
                Predictive Forecast (24h)
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {forecastLastUpdated && (
                <span className="overview-forecast-updated" style={{ fontSize: 12, color: '#94a3b8' }}>
                  Updated {getTimeAgo(forecastLastUpdated)}
                </span>
              )}

              <button
                onClick={() => fetchForecast(true)}
                disabled={forecastLoading}
                className="overview-forecast-refresh"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: 12,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: forecastLoading ? 'not-allowed' : 'pointer',
                  opacity: forecastLoading ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw style={{ width: 13, height: 13, color: '#00bfa5', animation: forecastLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* 24-Hour Horizon Track Card */}
          <div className="overview-forecast-card" style={{
            background: '#ffffff',
            borderRadius: 22,
            padding: '22px 24px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={17} color="#0ea5e9" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  24-Hour Timeline Horizon
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Smooth Scroll Navigation Arrows */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => scrollTimeline('left')}
                    title="Scroll left"
                    aria-label="Scroll left"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollTimeline('right')}
                    title="Scroll right"
                    aria-label="Scroll right"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal Scroller for Unique Atmospheric Horizon Cards */}
            <div
              ref={timelineScrollerRef}
              onMouseDown={handleMouseDownTimeline}
              onMouseUp={handleMouseLeaveOrUpTimeline}
              onMouseLeave={handleMouseLeaveOrUpTimeline}
              onMouseMove={handleMouseMoveTimeline}
              className={`overview-timeline-scroller ${isDraggingTimeline ? 'is-dragging' : ''}`}
            >
              {visibleForecastTimelineItems.length === 0 ? (
                <div style={{ padding: '28px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center', width: '100%' }}>
                  {forecastLoading ? 'Synthesizing 24-hour predictive forecast timeline...' : 'No forecast timeline items available at this time.'}
                </div>
              ) : (
                visibleForecastTimelineItems.map((item) => (
                  <div
                    key={item.index}
                    className="overview-timeline-card"
                    style={{
                      border: `1.5px solid ${item.aqi_border || '#e2e8f0'}`,
                      background: item.aqi_bg || '#ffffff',
                    }}
                  >
                    {/* Top Daylight / Night Pill */}
                    <div className="overview-timeline-hour" style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: 10,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                    }}>
                      {item.isDaytime ? (
                        <Sun style={{ width: 11, height: 11, color: '#f59e0b' }} />
                      ) : (
                        <Moon style={{ width: 11, height: 11, color: '#6366f1' }} />
                      )}
                      <span>{item.display_hour}</span>
                    </div>

                    {/* Central Glowing AQI Badge Ring */}
                    <div className="overview-timeline-circle" style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: `2.5px solid ${item.aqi_color}`,
                      boxShadow: `0 0 10px ${item.aqi_color}30`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '2px 0 8px',
                      transform: 'translateZ(0)',
                    }}>
                      <span className="overview-timeline-aqi" style={{
                        fontSize: 22,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: item.aqi_color,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {item.aqi}
                      </span>
                    </div>

                    {/* Category Label */}
                    <span className="overview-timeline-category" style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: item.aqi_color,
                      marginBottom: 8,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.aqi_category}
                    </span>

                    {/* Micro Weather / Sensor Telemetry Pill */}
                    <div className="overview-timeline-pill" style={{
                      padding: '3px 8px',
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.85)',
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#64748b',
                      border: '1px solid rgba(226, 232, 240, 0.9)',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.hasActual ? `Act: ${item.actual_aqi ?? '—'}` : (item.temperature_c != null ? `${fmt(item.temperature_c, 1)}°C${item.humidity_pct != null ? ` • ${fmt(item.humidity_pct, 1)}%` : ''}` : 'Projected')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>


      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes breathAtmosphere {
          0% { opacity: 0.4; transform: scale(0.96) translate(0, 0); }
          50% { opacity: 0.7; transform: scale(1.04) translate(-10px, 10px); }
          100% { opacity: 0.4; transform: scale(0.96) translate(0, 0); }
        }

        /* ── 24-Hour Horizon Track Smooth Performance Styles ── */
        .overview-timeline-scroller {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 12px;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          will-change: scroll-position;
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .overview-timeline-scroller.is-dragging {
          cursor: grabbing !important;
          scroll-behavior: auto !important;
        }
        .overview-timeline-scroller.is-dragging .overview-timeline-card {
          cursor: grabbing !important;
          pointer-events: none !important;
        }
        .overview-timeline-scroller::-webkit-scrollbar {
          height: 6px;
        }
        .overview-timeline-scroller::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 999px;
        }
        .overview-timeline-scroller::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
          transition: background 0.15s ease;
        }
        .overview-timeline-scroller::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .overview-timeline-card {
          flex: 0 0 116px;
          padding: 16px 12px;
          border-radius: 18px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          transform: translateZ(0);
          will-change: transform;
          transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
          cursor: grab;
          user-select: none;
        }
        .overview-timeline-card:hover {
          transform: translateY(-4px) translateZ(0);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08) !important;
        }

        /* ── Compact & Balanced 5-Card Telemetry Grid ── */
        .overview-grid {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 12px !important;
          margin-bottom: 8px !important;
        }
        .overview-core-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 13px 13px 12px;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 136px;
          box-sizing: border-box;
          transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .overview-core-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07) !important;
        }

        .overview-bar-scale {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          font-weight: 700;
          color: #94a3b8;
          font-family: var(--font-mono);
          line-height: 1;
          margin-top: 4px;
        }

        .overview-sub-badge {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 2.5px 7px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        /* ── Comprehensive Mobile Optimization ── */
        @media (max-width: 1100px) {
          .overview-grid {
            grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)) !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 768px) {
          .overview-page-root {
            padding: 14px 12px !important;
            border-radius: 18px !important;
            min-height: auto !important;
          }
          .overview-forecast-card {
            padding: 16px 14px !important;
          }
        }

        @media (max-width: 640px) {
          .overview-page-root {
            padding: 10px 8px !important;
            border-radius: 16px !important;
          }
          .overview-toolbar {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            width: 100% !important;
            gap: 6px !important;
            margin-bottom: 2px !important;
          }
          .overview-toolbar-units {
            display: flex !important;
            gap: 5px !important;
          }
          .overview-toolbar-units button {
            padding: 4px 8px !important;
            font-size: 11.5px !important;
          }
          .overview-refresh-btn {
            padding: 5px 10px !important;
            font-size: 11.5px !important;
          }
          .overview-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 6px !important;
          }
          .overview-grid > *:first-child {
            grid-column: span 2 !important;
          }
          .overview-core-card {
            padding: 10px 10px 10px !important;
            min-height: 122px !important;
            border-radius: 14px !important;
          }
          .overview-card-icon {
            width: 24px !important;
            height: 24px !important;
            border-radius: 7px !important;
          }
          .overview-card-icon svg {
            width: 13px !important;
            height: 13px !important;
          }
          .overview-card-title {
            font-size: 12px !important;
          }
          .overview-card-badge {
            font-size: 9.5px !important;
            padding: 2px 6px !important;
            letter-spacing: -0.01em !important;
          }
          .overview-card-val {
            font-size: 26px !important;
          }
          .overview-card-dial {
            width: 38px !important;
            height: 38px !important;
          }
          .overview-card-dial svg {
            width: 38px !important;
            height: 38px !important;
          }
          .overview-card-dial div {
            font-size: 9px !important;
          }
          .overview-forecast-section {
            margin-top: 8px !important;
            gap: 10px !important;
          }
          .overview-forecast-header {
            gap: 8px !important;
          }
          .overview-forecast-title {
            font-size: 17px !important;
          }
          .overview-forecast-title svg {
            width: 18px !important;
            height: 18px !important;
          }
          .overview-forecast-updated {
            font-size: 11px !important;
          }
          .overview-forecast-refresh {
            padding: 5px 10px !important;
            font-size: 11.5px !important;
            border-radius: 10px !important;
          }
          .overview-forecast-card {
            padding: 12px 10px !important;
            border-radius: 16px !important;
          }
          .overview-timeline-scroller {
            gap: 8px !important;
            padding-bottom: 8px !important;
            -webkit-overflow-scrolling: touch !important;
            scroll-snap-type: x proximity !important;
            touch-action: pan-x pan-y !important;
          }
          .overview-timeline-card {
            flex: 0 0 94px !important;
            padding: 10px 6px !important;
            border-radius: 14px !important;
            scroll-snap-align: start !important;
          }
          .overview-timeline-hour {
            font-size: 9.5px !important;
            padding: 2px 6px !important;
            margin-bottom: 6px !important;
          }
          .overview-timeline-circle {
            width: 44px !important;
            height: 44px !important;
            margin: 2px 0 6px !important;
            border-width: 2px !important;
          }
          .overview-timeline-aqi {
            font-size: 17px !important;
          }
          .overview-timeline-category {
            font-size: 9.5px !important;
            margin-bottom: 6px !important;
          }
          .overview-timeline-pill {
            font-size: 8.5px !important;
            padding: 2px 5px !important;
          }
        }

        /* ── Standard Phones (< 480px) ── */
        @media (max-width: 480px) {
          .overview-sub-badge {
            font-size: 8.5px !important;
            padding: 1.5px 4px !important;
          }
          .overview-bar-scale {
            font-size: 8px !important;
          }
          .overview-card-val {
            font-size: 23px !important;
          }
          .overview-core-card {
            min-height: 112px !important;
            padding: 9px 8px 9px !important;
          }
          .overview-toolbar-units button {
            padding: 3px 6px !important;
            font-size: 11px !important;
          }
          .overview-refresh-btn {
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          .overview-forecast-title {
            font-size: 15.5px !important;
          }
        }

        /* ── Ultra-compact Phones (< 360px) ── */
        @media (max-width: 360px) {
          .overview-grid {
            grid-template-columns: 1fr !important;
          }
          .overview-grid > *:first-child {
            grid-column: span 1 !important;
          }
          .overview-core-card {
            min-height: 110px !important;
          }
        }
      `}</style>
    </div>
  );
}
