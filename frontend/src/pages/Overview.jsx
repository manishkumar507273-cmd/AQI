import { useState, useEffect, useMemo, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import {
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  RefreshCw,
  ShieldAlert,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import {
  getCloudLatest,
  getWeatherLatest,
  getTimeAgo,
  getCloudHistory,
  getCachedData,
  getCloudLiveHistory
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

  const [liveHistory, setLiveHistory] = useState(() => {
    if (selectedStation !== 'station-1') return [];
    return getCachedData('CACHE_AQI_LIVE_HISTORY') || [];
  });
  const [liveHistoryLoading, setLiveHistoryLoading] = useState(() => {
    if (selectedStation !== 'station-1') return false;
    return (getCachedData('CACHE_AQI_LIVE_HISTORY') || []).length === 0;
  });

  // Fetch live telemetry from both tables
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const [aqiRes, weatherRes, historyRes] = await Promise.allSettled([
        getCloudLatest(),
        getWeatherLatest(),
        selectedStation === 'station-1' ? getCloudLiveHistory(50) : Promise.resolve({ data: { history: [] } })
      ]);
      if (aqiRes.status === 'fulfilled' && aqiRes.value?.data?.data) {
        setAqiData(aqiRes.value.data.data);
      }
      if (weatherRes.status === 'fulfilled' && weatherRes.value?.data?.data) {
        setWeatherData(weatherRes.value.data.data);
      }
      if (historyRes.status === 'fulfilled' && historyRes.value?.data?.history) {
        setLiveHistory(historyRes.value.data.history);
        setLiveHistoryLoading(false);
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

  const liveHistoryChartData = useMemo(() => {
    if (!liveHistory || liveHistory.length === 0) return [];
    return [...liveHistory].reverse().map((row, idx) => {
      const dt = row.timestamp ? new Date(row.timestamp) : null;
      const timeLabel = dt && !isNaN(dt)
        ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toLowerCase()
        : 'N/A';
      return {
        uniqueKey: dt && !isNaN(dt) ? `${dt.getTime()}_${idx}` : `live_${idx}`,
        time: timeLabel,
        rawDate: dt,
        fullTime: dt && !isNaN(dt)
          ? dt.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
          : 'N/A',
        cpcb_aqi: row.cpcb_aqi != null && !isNaN(Number(row.cpcb_aqi)) ? Number(row.cpcb_aqi) : 0,
      };
    });
  }, [liveHistory]);

  const aqiSummaryStats = useMemo(() => {
    if (!liveHistoryChartData || liveHistoryChartData.length === 0) return null;
    let minItem = liveHistoryChartData[0];
    let maxItem = liveHistoryChartData[0];
    for (const item of liveHistoryChartData) {
      if (item.cpcb_aqi < minItem.cpcb_aqi) minItem = item;
      if (item.cpcb_aqi > maxItem.cpcb_aqi) maxItem = item;
    }
    return { minItem, maxItem };
  }, [liveHistoryChartData]);

  const chart15MinTicks = useMemo(() => {
    if (!liveHistoryChartData || liveHistoryChartData.length === 0) return undefined;
    const ticks = [];
    let lastTimeMs = -Infinity;
    const gapMs = 15 * 60 * 1000;
    liveHistoryChartData.forEach((item) => {
      if (!item.rawDate || isNaN(item.rawDate.getTime())) return;
      const currentMs = item.rawDate.getTime();
      if (currentMs - lastTimeMs >= gapMs) {
        ticks.push(item.uniqueKey);
        lastTimeMs = currentMs;
      }
    });
    return ticks.length > 0 ? ticks : undefined;
  }, [liveHistoryChartData]);

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
    ? (windUnit === 'ms' ? (Number(rawWind) / 3.6).toFixed(1) : (fmt(rawWind, 1) ?? Number(rawWind).toFixed(1)))
    : '--';
  const displayWindUnit = windUnit === 'ms' ? 'm/s' : 'km/h';
  const windKmh = rawWind != null ? Number(rawWind) : null;
  const windStatus = windKmh != null ? (windKmh > 15 ? 'Breezy' : (windKmh > 2 ? 'Gentle' : 'Light')) : 'Calm';

  const displayRain = rawRain != null ? (fmt(rawRain, 1) ?? Number(rawRain).toFixed(1)) : '--';
  const isRaining = rawRain != null && Number(rawRain) > 0;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Dynamic Environmental Animation System (Light Atmospheric Theme)
  // Renders breeze air streams, floating mist motes, sunbeams, and rain ripples
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
      {/* â”€â”€ Dynamic Ambient Canvas â”€â”€ */}
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

      {/* â”€â”€ Content Container â”€â”€ */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* â”€â”€ Compact Toolbar (Settings & Refresh) â”€â”€ */}
        <div className="overview-toolbar" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          flexWrap: 'wrap',
          marginBottom: 4,
        }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Settings Pill (Unit Toggles) */}
          <div style={{
            display: 'flex',
            backgroundColor: '#ffffff',
            borderRadius: 999,
            padding: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            gap: 2
          }}>
            <button
              onClick={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              °{tempUnit}
            </button>
            <button
              onClick={() => setWindUnit(windUnit === 'kmh' ? 'ms' : 'kmh')}
              style={{
                padding: '4px 8px',
                borderRadius: 999,
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                transition: 'all 0.15s ease',
              }}
            >
              {windUnit === 'kmh' ? 'km/h' : 'm/s'}
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="overview-refresh-btn"
            title="Refresh Live Data"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: '50%',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw style={{ width: 14, height: 14, color: '#00bfa5', animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>
          </div>
        </div>

        {/* â”€â”€ 5 Core Telemetry Cards in Harmonious, Compact Light Palette â”€â”€ */}
        <div className="overview-grid">

          {/* â•â•â•â•â•â•â•â• CARD 1: AIR QUALITY INDEX â•â•â•â•â•â•â•â• */}
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
                  Dominant: <strong style={{ color: '#0f172a' }}>{aqiData?.dominant_pollutant || 'Oâ‚ƒ'}</strong>
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
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>100</span>
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>500</span>
              </div>
            </div>
          </motion.div>

          {/* â•â•â•â•â•â•â•â• CARD 2: AMBIENT TEMPERATURE â•â•â•â•â•â•â•â• */}
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
                {displayTemp !== '--' ? (Number(displayTemp) > 30 ? 'Warm' : (Number(displayTemp) < 22 ? 'Cool' : 'Pleasant')) : 'â€”'}
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

          {/* â•â•â•â•â•â•â•â• CARD 3: RELATIVE HUMIDITY â•â•â•â•â•â•â•â• */}
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
                {displayHumidity !== '--' ? (Number(displayHumidity) > 75 ? 'Humid' : (Number(displayHumidity) < 40 ? 'Dry' : 'Comfort')) : 'â€”'}
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
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>55%</span>
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>90% Humid</span>
              </div>
            </div>
          </motion.div>

          {/* â•â•â•â•â•â•â•â• CARD 4: WIND SPEED â•â•â•â•â•â•â•â• */}
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
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>{windUnit === 'ms' ? '4.2' : '15'}</span>
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>{windUnit === 'ms' ? '8.3 m/s' : '30 km/h'}</span>
              </div>
            </div>
          </motion.div>

          {/* â•â•â•â•â•â•â•â• CARD 5: RAINFALL â•â•â•â•â•â•â•â• */}
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
                {rawRain == null ? 'â€”' : (isRaining ? 'ðŸŒ§ï¸ Rain' : 'Dry')}
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
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>15mm</span>
                <span style={{ color: '#cbd5e1' }}>â€¢</span>
                <span>50mm</span>
              </div>
            </div>
          </motion.div>

        </div>

      {/* ── AQI LINE PLOT ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
        className="mobile-card-compact"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          padding: 24,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity style={{ width: 16, height: 16, color: '#00bfa5' }} />
              AQI Line Plot
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              <span>Real-time Air Quality Index progression</span>
            </div>
          </div>
          <div style={{
            backgroundColor: 'rgba(0, 191, 165, 0.1)',
            border: '1px solid rgba(0, 191, 165, 0.25)',
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            color: '#00bfa5',
            fontFamily: 'var(--font-mono)'
          }}>
            Current: {aqiVal}
          </div>
        </div>

        <div className="chart-responsive" style={{ width: '100%', minWidth: 0, height: 250 }}>
          {liveHistoryLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
              <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite', marginRight: 8, color: '#00bfa5' }} />
              Loading graph...
            </div>
          ) : liveHistoryChartData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
              No telemetry stream available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={liveHistoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="aqiGradOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00bfa5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00bfa5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="uniqueKey"
                  ticks={chart15MinTicks}
                  tickFormatter={(val) => {
                    const item = liveHistoryChartData.find(d => d.uniqueKey === val);
                    return item ? item.time : val;
                  }}
                  stroke="#94a3b8"
                  fontSize={10}
                  tick={{ fill: '#64748b' }}
                  interval={0}
                />
                <YAxis stroke="#94a3b8" fontSize={10} tick={{ fill: '#64748b' }} domain={[0, 'auto']} />
                <Tooltip content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    const val = d.cpcb_aqi;
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}>
                        <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{d.fullTime}</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: '#00bfa5' }}>
                          AQI: {val}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }} />
                <Area type="monotone" dataKey="cpcb_aqi" name="AQI" stroke="#00bfa5" strokeWidth={2.5} fillOpacity={1} fill="url(#aqiGradOverview)" dot={false} activeDot={{ r: 5, fill: '#00bfa5', stroke: '#ffffff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {aqiSummaryStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0',
              fontSize: 11.5, fontWeight: 700, color: '#047857', fontFamily: 'var(--font-mono)'
            }}>
              <ArrowDownRight style={{ width: 14, height: 14 }} />
              <span>Lowest: {aqiSummaryStats.minItem.cpcb_aqi} @ {aqiSummaryStats.minItem.time}</span>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
              fontSize: 11.5, fontWeight: 700, color: '#c2410c', fontFamily: 'var(--font-mono)'
            }}>
              <ArrowUpRight style={{ width: 14, height: 14 }} />
              <span>Highest: {aqiSummaryStats.maxItem.cpcb_aqi} @ {aqiSummaryStats.maxItem.time}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── AIR QUALITY INDEX (AQI) SCALE GUIDE ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.2 }}
        className="mobile-card-compact"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          padding: 24,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          marginTop: 16
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
            <ShieldAlert style={{ width: 20, height: 20, color: '#00bfa5' }} />
            Air Quality Index (AQI) Scale
          </h2>
          <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, margin: '4px 0 0' }}>
            Know what each category of the Air Quality Index implies for health and ambient safety.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { range: '0 to 50', label: 'Good', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', desc: 'Air quality is considered satisfactory, and air pollution poses little or no risk.' },
            { range: '51 to 100', label: 'Moderate', color: '#eab308', bg: '#fefce8', border: '#fef08a', desc: 'Acceptable air quality; minor breathing discomfort may occur for sensitive individuals.' },
            { range: '101 to 200', label: 'Poor', color: '#f97316', bg: '#fff7ed', border: '#fed7aa', desc: 'Breathing discomfort to people with lungs, asthma, and heart diseases.' },
            { range: '201 to 300', label: 'Unhealthy', color: '#ef4444', bg: '#fef2f2', border: '#fecaca', desc: 'Breathing discomfort to most people on prolonged exposure. Limit strenuous outdoor exertion.' },
            { range: '301 to 400', label: 'Severe', color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff', desc: 'Respiratory illness on prolonged exposure; significantly impacts people with existing ailments.' },
            { range: '401+', label: 'Hazardous', color: '#f43f5e', bg: '#fff1f2', border: '#fecdd3', desc: 'May cause serious health impacts on entire population. Wear N95 masks and stay indoors.' },
          ].map((cat) => (
            <div
              key={cat.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 14,
                backgroundColor: cat.bg,
                border: `1px solid ${cat.border}`,
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: cat.color, flexShrink: 0 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{cat.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cat.color, fontFamily: 'var(--font-mono)' }}>({cat.range})</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>{cat.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

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

        /* â”€â”€ 24-Hour Horizon Track Smooth Performance Styles â”€â”€ */
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

        /* â”€â”€ Compact & Balanced 5-Card Telemetry Grid â”€â”€ */
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

        /* â”€â”€ Comprehensive Mobile Optimization â”€â”€ */
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

        /* â”€â”€ Standard Phones (< 480px) â”€â”€ */
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

        /* â”€â”€ Ultra-compact Phones (< 360px) â”€â”€ */
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