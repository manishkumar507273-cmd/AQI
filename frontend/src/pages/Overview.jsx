import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  RefreshCw,
  Clock,
  Sparkles,
  History,
  ArrowUpRight,
  Sun,
  Activity
} from 'lucide-react';
import {
  getCloudLatest,
  getWeatherLatest,
  getTimeAgo,
  isSensorOnline,
  getAqiForecast,
  getCloudHistory,
  getCachedData
} from '../api';

// Format time for timestamp display
const formatLocalTime = (ts) => {
  if (!ts) return 'N/A';
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return String(ts);
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
};

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

// Compass heading parser
const parseDirection = (dir) => {
  if (dir == null) return { deg: 0, text: 'N' };
  if (typeof dir === 'number') return { deg: dir % 360, text: `${Math.round(dir)}°` };
  const d = String(dir).trim().toLowerCase();
  const map = {
    'north': 0, 'n': 0,
    'northeast': 45, 'ne': 45,
    'east': 90, 'e': 90,
    'southeast': 135, 'se': 135,
    'south': 180, 's': 180,
    'southwest': 225, 'sw': 225,
    'west': 270, 'w': 270,
    'northwest': 315, 'nw': 315,
  };
  const deg = map[d] != null ? map[d] : (!isNaN(Number(d)) ? Number(d) : 0);
  return { deg, text: String(dir).toUpperCase() };
};

// Beaufort wind scale helper
const getBeaufortRating = (kmh) => {
  if (kmh == null) return { level: 0, label: 'Calm', desc: 'Still air' };
  const k = Number(kmh);
  if (k < 2) return { level: 0, label: 'Calm', desc: 'Still air' };
  if (k < 6) return { level: 1, label: 'Light Air', desc: 'Smoke drift' };
  if (k < 12) return { level: 2, label: 'Light Breeze', desc: 'Leaves rustle' };
  if (k < 20) return { level: 3, label: 'Gentle Breeze', desc: 'Twigs in motion' };
  if (k < 29) return { level: 4, label: 'Moderate Breeze', desc: 'Dust raised' };
  if (k < 39) return { level: 5, label: 'Fresh Breeze', desc: 'Small trees sway' };
  return { level: 6, label: 'Strong Breeze', desc: 'Large branches sway' };
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

export default function Overview({ refreshKey = 0, selectedStation = 'station-1' }) {
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
  const [showPastHours, setShowPastHours] = useState(true); // Default TRUE to show ALL 24 hours
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
    const interval = setInterval(() => fetchData(false), 5000);
    return () => clearInterval(interval);
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
    const timer = setInterval(() => fetchForecast(false), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (refreshKey > 0) {
      getCloudHistory(100).then(res => {
        if (Array.isArray(res.data?.history)) {
          setHistoricalRecords(res.data.history);
        }
      }).catch(() => {});
    }
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

      return {
        ...item,
        index,
        display_hour: hourStr,
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

  // Current hour boundary timestamp (ms)
  const currentHourMs = useMemo(() => {
    const d = new Date(currentTime);
    d.setMinutes(0, 0, 0, 0);
    return d.getTime();
  }, [currentTime]);

  const { visibleForecastTimelineItems, passedForecastItems } = useMemo(() => {
    if (!processedForecastItems || processedForecastItems.length === 0) {
      return { visibleForecastTimelineItems: [], passedForecastItems: [] };
    }

    const passed = [];
    const upcoming = [];

    processedForecastItems.forEach((item) => {
      if (!item.forecast_for_time) {
        upcoming.push(item);
        return;
      }
      const itemTime = new Date(item.forecast_for_time).getTime();
      if (isNaN(itemTime)) {
        upcoming.push(item);
      } else if (itemTime < currentHourMs) {
        passed.push(item);
      } else {
        upcoming.push(item);
      }
    });

    const visible = showPastHours ? processedForecastItems : (upcoming.length > 0 ? upcoming : processedForecastItems);
    return { visibleForecastTimelineItems: visible, passedForecastItems: passed };
  }, [processedForecastItems, currentHourMs, showPastHours]);

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
  const rawRain = weatherData?.rain_gauge ?? 0.0;
  const windDirRaw = weatherData?.wind_direction;
  const windGust = weatherData?.wind_gust;

  const displayTemp = rawTemp != null
    ? (tempUnit === 'F' ? ((rawTemp * 9 / 5) + 32).toFixed(1) : Number(rawTemp).toFixed(1))
    : '28.8';
  const feelsLike = rawTemp != null ? calcFeelsLike(Number(rawTemp), Number(rawHum ?? 60)) : null;
  const displayFeelsLike = feelsLike != null
    ? (tempUnit === 'F' ? ((feelsLike * 9 / 5) + 32).toFixed(1) : feelsLike)
    : null;

  const displayHumidity = rawHum != null ? Number(rawHum).toFixed(1) : '85.2';
  const dewPoint = calcDewPoint(Number(rawTemp ?? 28), Number(rawHum ?? 85));

  const displayWind = rawWind != null
    ? (windUnit === 'ms' ? (Number(rawWind) / 3.6).toFixed(1) : Number(rawWind).toFixed(1))
    : '3.5';
  const displayWindUnit = windUnit === 'ms' ? 'm/s' : 'km/h';
  const parsedDir = parseDirection(windDirRaw);
  const beaufort = getBeaufortRating(rawWind);

  const displayRain = rawRain != null ? Number(rawRain).toFixed(1) : '0.0';
  const isRaining = Number(rawRain) > 0;

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
    <div style={{
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

        {/* ── Minimalist Top Right Toolbar (Only unit toggles & refresh) ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          flexWrap: 'wrap',
        }}>
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

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
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

        {/* ── 5 Core Telemetry Cards in Harmonious Light Palette ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>

          {/* ════════ CARD 1: CPCB AIR QUALITY INDEX (HERO) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1.5px solid ${aqiCategory.border}`,
              borderRadius: 24,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
            }}
          >
            {/* Soft Ambient Radial Corner Glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              backgroundColor: `${aqiCategory.color}18`,
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: aqiCategory.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: aqiCategory.color,
                  border: `1.5px solid ${aqiCategory.border}`,
                }}>
                  <Gauge style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Air Quality Index
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em' }}>
                    CPCB INDIA STANDARD
                  </span>
                </div>
              </div>

              {/* Category Pill */}
              <span style={{
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: aqiCategory.bg,
                color: aqiCategory.text,
                border: `1px solid ${aqiCategory.border}`,
              }}>
                {aqiCategory.label}
              </span>
            </div>

            {/* Central Score + SVG Radial Dial */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '22px 0',
              zIndex: 1,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontSize: 'clamp(46px, 5.5vw, 60px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    color: aqiCategory.color,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {loading ? '--' : aqiVal}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8' }}>
                    / 500
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>
                  Dominant: <strong style={{ color: '#0f172a' }}>{aqiData?.dominant_pollutant || 'O₃ / PM2.5'}</strong>
                </div>
              </div>

              {/* Clean Radial Progress Graphic */}
              <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
                <svg width="92" height="92" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={aqiCategory.color}
                    strokeWidth="9"
                    strokeDasharray="283"
                    strokeDashoffset={strokeDashoffset}
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
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: aqiCategory.color,
                }}>
                  {Math.round(aqiPercent)}%
                </div>
              </div>
            </div>

            {/* Health snippet */}
            <div style={{
              padding: '11px 14px',
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#475569',
              lineHeight: 1.4,
              zIndex: 1,
            }}>
              {aqiVal <= 50 && '✅ Minimal impact. Air quality is clean and healthy for all outdoor activities.'}
              {aqiVal > 50 && aqiVal <= 100 && '🌿 Minor breathing discomfort to sensitive individuals with respiratory issues.'}
              {aqiVal > 100 && aqiVal <= 200 && '⚠️ Noticeable discomfort to people with asthma, heart, or lung diseases.'}
              {aqiVal > 200 && '🚨 Air pollution is elevated. Limit prolonged strenuous outdoor exertion.'}
            </div>
          </motion.div>

          {/* ════════ CARD 2: AMBIENT TEMPERATURE (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid #fed7aa',
              borderRadius: 24,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
            }}
          >
            {/* Top orange glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              backgroundColor: 'rgba(249, 115, 22, 0.12)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: '#fff7ed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ea580c',
                  border: '1.5px solid #fed7aa',
                }}>
                  <Thermometer style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Temperature
                  </h3>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: '#fff7ed',
                color: '#c2410c',
                border: '1px solid #fed7aa',
              }}>
                {Number(displayTemp) > 30 ? 'Warm' : (Number(displayTemp) < 22 ? 'Cool' : 'Pleasant')}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '22px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 'clamp(46px, 5.5vw, 60px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#ea580c',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayTemp}
                </span>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#94a3b8' }}>
                  °{tempUnit}
                </span>
              </div>
            </div>

            {/* Thermometer scale track */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                <span>Cool 15°C</span>
                <span>Moderate 28°C</span>
                <span>Warm 40°C</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, ((Number(rawTemp ?? 28) - 10) / 35) * 100))}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #facc15 50%, #ea580c 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 3: RELATIVE HUMIDITY (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid #bae6fd',
              borderRadius: 24,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
            }}
          >
            {/* Top sky blue glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: '#f0f9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0284c7',
                  border: '1.5px solid #bae6fd',
                }}>
                  <Droplets style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Humidity
                  </h3>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
              }}>
                {Number(displayHumidity) > 75 ? 'Humid' : (Number(displayHumidity) < 40 ? 'Dry' : 'Comfortable')}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '22px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 'clamp(46px, 5.5vw, 60px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#0284c7',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayHumidity}
                </span>
                <span style={{ fontSize: 26, fontWeight: 700, color: '#94a3b8' }}>
                  %
                </span>
              </div>


            </div>

            {/* Humidity Fill Bar */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                <span>Dry 20%</span>
                <span>Ideal 50%</span>
                <span>Humid 90%</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, Number(displayHumidity)))}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 4: WIND SPEED & DIRECTION (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid #a7f3d0',
              borderRadius: 24,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
            }}
          >
            {/* Top green/emerald glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669',
                  border: '1.5px solid #a7f3d0',
                }}>
                  <Wind style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Wind Speed
                  </h3>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
              }}>
                {beaufort.label}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '22px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: 'clamp(46px, 5.5vw, 60px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#059669',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayWind}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>
                  {displayWindUnit}
                </span>
              </div>
            </div>

            {/* Description */}
            <div style={{
              padding: '9px 12px',
              borderRadius: 12,
              background: '#f8fafc',
              fontSize: 12,
              color: '#64748b',
              border: '1px solid #e2e8f0',
              zIndex: 1,
            }}>
              Beaufort Force {beaufort.level}: {beaufort.desc}
            </div>
          </motion.div>

          {/* ════════ CARD 5: RAINFALL (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: isRaining ? '1.5px solid #38bdf8' : '1.5px solid #c7d2fe',
              borderRadius: 24,
              padding: '26px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
            }}
          >
            {/* Top indigo/sky glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 130,
              height: 130,
              borderRadius: '50%',
              backgroundColor: isRaining ? 'rgba(56, 189, 248, 0.15)' : 'rgba(99, 102, 241, 0.12)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: isRaining ? '#f0f9ff' : '#eef2ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRaining ? '#0284c7' : '#4f46e5',
                  border: isRaining ? '1.5px solid #bae6fd' : '1.5px solid #c7d2fe',
                }}>
                  <CloudRain style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
                    Rainfall
                  </h3>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: isRaining ? '#e0f2fe' : '#eef2ff',
                color: isRaining ? '#0369a1' : '#4338ca',
                border: isRaining ? '1px solid #bae6fd' : '1px solid #c7d2fe',
              }}>
                {isRaining ? '🌧️ Active Rain' : 'Dry / Clear'}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '22px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: 'clamp(46px, 5.5vw, 60px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: isRaining ? '#0284c7' : '#4f46e5',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayRain}
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#94a3b8' }}>
                  mm
                </span>
              </div>


            </div>

            {/* Liquid Level Indicator */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                <span>Dry</span>
                <span>Moderate 15mm</span>
                <span>Heavy 50mm</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: '#f1f5f9',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(isRaining ? 15 : 2, (Number(displayRain) / 50) * 100))}%`,
                  background: isRaining
                    ? 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)'
                    : 'linear-gradient(90deg, #818cf8 0%, #4f46e5 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

        </div>

        {/* ── Predictive Forecast (24h) Section matching user screenshot ── */}
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div>
              <h2 style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <Sparkles style={{ width: 22, height: 22, color: '#00bfa5' }} />
                Predictive Forecast (24h)
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
                Node 1 24-hour horizon (t+1 → t+24) with expanding-lookback Seq2Seq LSTM and real-time telemetry sync.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {forecastLastUpdated && (
                <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
                  Updated {getTimeAgo(forecastLastUpdated)}
                </span>
              )}
              <button
                onClick={() => fetchForecast(true)}
                disabled={forecastLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  backgroundColor: '#00bfa5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 10,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: forecastLoading ? 'not-allowed' : 'pointer',
                  opacity: forecastLoading ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(0, 191, 165, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw style={{ width: 13, height: 13, animation: forecastLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* 24-Hour Timeline Overview Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 20,
            padding: '20px 24px',
            border: '1.5px solid #e2e8f0',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#0ea5e9" /> 24-Hour Timeline Overview
              </h3>

              {passedForecastItems.length > 0 && (
                <button
                  onClick={() => setShowPastHours(!showPastHours)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: showPastHours ? '1px solid #0ea5e9' : '1px solid #cbd5e1',
                    backgroundColor: showPastHours ? '#f0f9ff' : '#ffffff',
                    color: showPastHours ? '#0369a1' : '#64748b',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <History size={13} />
                  <span>{showPastHours ? `Showing All 24h (${processedForecastItems.length})` : `Show Past Hours (${passedForecastItems.length})`}</span>
                </button>
              )}
            </div>

            {/* Horizontal Scroller for All 24-Hour Forecast Cards */}
            <div style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 10,
              scrollbarWidth: 'thin',
            }}>
              {visibleForecastTimelineItems.length === 0 ? (
                <div style={{ padding: '24px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center', width: '100%' }}>
                  {forecastLoading ? 'Loading 24-hour predictive forecast timeline...' : 'No forecast timeline items available at this time.'}
                </div>
              ) : (
                visibleForecastTimelineItems.map((item) => (
                  <div
                    key={item.index}
                    className="forecast-timeline-card"
                    style={{
                      flex: '0 0 110px',
                      padding: '14px 12px',
                      borderRadius: 14,
                      border: `1.5px solid ${item.aqi_border || '#e2e8f0'}`,
                      background: item.aqi_bg || '#ffffff',
                      textAlign: 'center',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div className="forecast-timeline-hour" style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                      {item.display_hour}
                    </div>
                    <div className="forecast-timeline-aqi" style={{ fontSize: 24, fontWeight: 800, color: item.aqi_color, lineHeight: 1.1, fontFamily: 'var(--font-mono)' }}>
                      {item.aqi}
                    </div>
                    <div className="forecast-timeline-category" style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: item.aqi_color,
                      marginTop: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.aqi_category}
                    </div>
                    <div className="forecast-timeline-actual" style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTop: '1px dashed #e2e8f0',
                      fontSize: 10.5,
                      color: item.hasActual ? '#0284c7' : '#94a3b8',
                      fontWeight: 600,
                    }}>
                      {item.hasActual ? (
                        <span>Act: <strong>{item.actual_aqi ?? '—'}</strong></span>
                      ) : (
                        <span>Pending</span>
                      )}
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
      `}</style>
    </div>
  );
}
