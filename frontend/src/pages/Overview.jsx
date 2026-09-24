import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Compass,
  RefreshCw,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Activity,
  Layers
} from 'lucide-react';
import { getCloudLatest, getWeatherLatest, getTimeAgo, isSensorOnline } from '../api';

// Helper to compute Indian Standard Time display
const formatLocalTime = (ts) => {
  if (!ts) return 'N/A';
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return String(ts);
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
};

const formatLocalDate = (ts) => {
  if (!ts) return '';
  const dt = new Date(ts);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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

// Compass heading to degrees
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
  if (kmh == null) return { level: 0, label: 'Calm', desc: 'Smoke rises vertically' };
  const k = Number(kmh);
  if (k < 2) return { level: 0, label: 'Calm', desc: 'Still air, smoke rises straight up' };
  if (k < 6) return { level: 1, label: 'Light Air', desc: 'Direction shown by smoke drift' };
  if (k < 12) return { level: 2, label: 'Light Breeze', desc: 'Wind felt on exposed face, leaves rustle' };
  if (k < 20) return { level: 3, label: 'Gentle Breeze', desc: 'Leaves and small twigs in constant motion' };
  if (k < 29) return { level: 4, label: 'Moderate Breeze', desc: 'Raises dust and small loose branches move' };
  if (k < 39) return { level: 5, label: 'Fresh Breeze', desc: 'Small trees in leaf begin to sway' };
  return { level: 6, label: 'Strong Breeze', desc: 'Large branches in motion; umbrellas used with difficulty' };
};

export default function Overview({ refreshKey = 0, selectedStation = 'station-1' }) {
  const [aqiData, setAqiData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [tempUnit, setTempUnit] = useState('C'); // 'C' | 'F'
  const [windUnit, setWindUnit] = useState('kmh'); // 'kmh' | 'ms'
  const canvasRef = useRef(null);

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
      setLastFetched(new Date());
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

  // Derived values
  const aqiVal = aqiData?.cpcb_aqi ?? 0;
  const aqiInfo = aqiData?.aqi_info || {
    value: aqiVal,
    label: aqiVal <= 50 ? 'Good' : (aqiVal <= 100 ? 'Satisfactory' : (aqiVal <= 200 ? 'Moderate' : 'Poor')),
    color: aqiVal <= 50 ? '#16a34a' : (aqiVal <= 100 ? '#65a30d' : (aqiVal <= 200 ? '#d97706' : '#ea580c'))
  };

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

  const aqiTimestamp = aqiData?.timestamp;
  const weatherTimestamp = weatherData?.timestamp;
  const weatherOnline = isSensorOnline(weatherTimestamp, 5);
  const aqiOnline = isSensorOnline(aqiTimestamp, 5);

  // Dynamic Atmospheric Background Animation
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

    // Particle system responding to wind and rain
    const particleCount = isRaining ? 85 : 45;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: isRaining ? 12 + Math.random() * 16 : 2 + Math.random() * 4,
      speedX: (Number(rawWind ?? 3.5) / 3.6) * (Math.random() * 0.8 + 0.4),
      speedY: isRaining ? 9 + Math.random() * 8 : (Math.random() - 0.5) * 0.4,
      opacity: 0.15 + Math.random() * 0.35,
      size: Math.random() * 2.5 + 1
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Render flowing atmosphere elements
      for (const p of particles) {
        ctx.beginPath();
        if (isRaining) {
          // Rain streak
          ctx.strokeStyle = `rgba(56, 189, 248, ${p.opacity * 0.8})`;
          ctx.lineWidth = 1.5;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 0.6, p.y + p.length);
          ctx.stroke();
        } else {
          // Ambient breezy particle
          ctx.fillStyle = `rgba(0, 191, 165, ${p.opacity * 0.6})`;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Update position
        p.x += Math.max(0.6, p.speedX * 0.6);
        p.y += p.speedY;

        // Wrap around boundaries
        if (p.x > canvas.width) p.x = 0;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;
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
      minHeight: '88vh',
      borderRadius: 24,
      overflow: 'hidden',
      padding: 'clamp(16px, 3.5vw, 32px)',
      background: 'linear-gradient(135deg, #090e17 0%, #0f172a 45%, #131d35 100%)',
      color: '#ffffff',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* ── Dynamic Ambient Canvas & Shifting Backdrop Glows ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          opacity: 0.85,
        }}
      />

      {/* Floating Atmosphere Aura Spheres */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        right: '-10%',
        width: '55vw',
        height: '55vw',
        maxWidth: 600,
        maxHeight: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${aqiInfo.color}33 0%, rgba(15, 23, 42, 0) 70%)`,
        filter: 'blur(70px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'pulseGlow 8s ease-in-out infinite alternate',
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-15%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        maxWidth: 550,
        maxHeight: 550,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(15, 23, 42, 0) 70%)',
        filter: 'blur(70px)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Content Container ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Top Header / Station Beacon ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 20,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: 'rgba(0, 191, 165, 0.15)',
                color: '#2dd4bf',
                border: '1px solid rgba(45, 212, 191, 0.3)',
                fontFamily: 'var(--font-mono)',
              }}>
                <Radio style={{ width: 12, height: 12 }} />
                <span>Node 1 Live Stream</span>
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: weatherOnline ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: weatherOnline ? '#4ade80' : '#facc15',
                border: `1px solid ${weatherOnline ? 'rgba(74, 222, 128, 0.3)' : 'rgba(250, 204, 21, 0.3)'}`,
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: weatherOnline ? '#22c55e' : '#eab308',
                  boxShadow: weatherOnline ? '0 0 8px #22c55e' : '0 0 8px #eab308'
                }} />
                <span>{weatherOnline ? 'Weather Sensors Online' : 'Standby / Polling'}</span>
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(22px, 3.2vw, 32px)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: 0,
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Atmospheric &amp; Air Quality Snapshot
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ width: 14, height: 14, color: '#64748b' }} />
              <span>Latest telemetry received at <strong>{formatLocalTime(weatherTimestamp || aqiTimestamp)}</strong> IST</span>
              <span>•</span>
              <span>{formatLocalDate(weatherTimestamp || aqiTimestamp)}</span>
            </p>
          </div>

          {/* Controls: Unit Toggles & Quick Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Temp Unit Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: 999,
              padding: 3,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <button
                onClick={() => setTempUnit('C')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: tempUnit === 'C' ? '#00bfa5' : 'transparent',
                  color: tempUnit === 'C' ? '#0f172a' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                °C
              </button>
              <button
                onClick={() => setTempUnit('F')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: tempUnit === 'F' ? '#00bfa5' : 'transparent',
                  color: tempUnit === 'F' ? '#0f172a' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                °F
              </button>
            </div>

            {/* Wind Unit Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              borderRadius: 999,
              padding: 3,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <button
                onClick={() => setWindUnit('kmh')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: windUnit === 'kmh' ? '#0284c7' : 'transparent',
                  color: windUnit === 'kmh' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                km/h
              </button>
              <button
                onClick={() => setWindUnit('ms')}
                style={{
                  padding: '5px 11px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: windUnit === 'ms' ? '#0284c7' : 'transparent',
                  color: windUnit === 'ms' ? '#ffffff' : '#94a3b8',
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
                padding: '7px 14px',
                borderRadius: 999,
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.07)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}
            >
              <RefreshCw style={{ width: 14, height: 14, animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
              <span>{isRefreshing ? 'Syncing...' : 'Live Refresh'}</span>
            </button>
          </div>
        </div>

        {/* ── 5 Core Telemetry Cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>

          {/* ════════ CARD 1: CPCB AIR QUALITY INDEX (HERO) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              gridColumn: 'span 1',
              minHeight: 280,
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1.5px solid ${aqiInfo.color}44`,
              borderRadius: 22,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: `0 14px 34px rgba(0, 0, 0, 0.35), 0 0 24px ${aqiInfo.color}18`,
            }}
          >
            {/* Soft background aura */}
            <div style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 140,
              height: 140,
              borderRadius: '50%',
              backgroundColor: `${aqiInfo.color}22`,
              filter: 'blur(35px)',
              pointerEvents: 'none',
            }} />

            {/* Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: `${aqiInfo.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: aqiInfo.color,
                  border: `1px solid ${aqiInfo.color}55`,
                }}>
                  <Gauge style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Air Quality Index
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
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
                backgroundColor: `${aqiInfo.color}22`,
                color: aqiInfo.color,
                border: `1px solid ${aqiInfo.color}66`,
              }}>
                {aqiInfo.label}
              </span>
            </div>

            {/* Central Score + Radial Ring */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '18px 0',
              zIndex: 1,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{
                    fontSize: 'clamp(44px, 5.5vw, 56px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    color: aqiInfo.color,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {loading ? '--' : aqiVal}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>
                    / 500
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
                  Dominant: <strong style={{ color: '#ffffff' }}>{aqiData?.dominant_pollutant || 'O₃ / PM2.5'}</strong>
                </div>
              </div>

              {/* Radial Progress Graphic */}
              <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
                <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="9"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={aqiInfo.color}
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
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'var(--font-mono)',
                  color: aqiInfo.color,
                }}>
                  {Math.round(aqiPercent)}%
                </div>
              </div>
            </div>

            {/* Health snippet */}
            <div style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: 12,
              color: '#94a3b8',
              lineHeight: 1.4,
              zIndex: 1,
            }}>
              {aqiVal <= 50 && '✅ Minimal impact. Air quality is considered satisfactory, and air pollution poses little or no risk.'}
              {aqiVal > 50 && aqiVal <= 100 && '🌿 Minor breathing discomfort to sensitive people with lung or heart issues.'}
              {aqiVal > 100 && aqiVal <= 200 && '⚠️ Breathing discomfort to the people with lungs, asthma and heart diseases.'}
              {aqiVal > 200 && '🚨 Air quality is poor. Sensitive individuals should avoid prolonged outdoor exposure.'}
            </div>
          </motion.div>

          {/* ════════ CARD 2: AMBIENT TEMPERATURE (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(249, 115, 22, 0.28)',
              borderRadius: 22,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.35), 0 0 24px rgba(249, 115, 22, 0.1)',
            }}
          >
            {/* Top orange glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: 'rgba(249, 115, 22, 0.18)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(249, 115, 22, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fb923c',
                  border: '1px solid rgba(249, 115, 22, 0.45)',
                }}>
                  <Thermometer style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Temperature
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                    WEATHER STATION NODE 1
                  </span>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                color: '#fb923c',
                border: '1px solid rgba(249, 115, 22, 0.35)',
              }}>
                {Number(displayTemp) > 30 ? 'Warm' : (Number(displayTemp) < 22 ? 'Cool' : 'Pleasant')}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '20px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 'clamp(44px, 5.5vw, 56px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#fdba74',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayTemp}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#fb923c' }}>
                  °{tempUnit}
                </span>
              </div>

              {displayFeelsLike && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                  Feels like: <strong style={{ color: '#ffffff' }}>{displayFeelsLike}°{tempUnit}</strong>
                </div>
              )}
            </div>

            {/* Bottom Bar: Thermometer progress track */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                <span>Cool 15°C</span>
                <span>Moderate 28°C</span>
                <span>Hot 40°C</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, ((Number(rawTemp ?? 28) - 10) / 35) * 100))}%`,
                  background: 'linear-gradient(90deg, #38bdf8 0%, #facc15 50%, #f97316 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 3: RELATIVE HUMIDITY (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(14, 165, 233, 0.28)',
              borderRadius: 22,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.35), 0 0 24px rgba(14, 165, 233, 0.1)',
            }}
          >
            {/* Top cyan glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: 'rgba(14, 165, 233, 0.18)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(14, 165, 233, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                  border: '1px solid rgba(14, 165, 233, 0.45)',
                }}>
                  <Droplets style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Humidity
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                    WEATHER STATION NODE 1
                  </span>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(14, 165, 233, 0.35)',
              }}>
                {Number(displayHumidity) > 75 ? 'Moist / Humid' : (Number(displayHumidity) < 40 ? 'Dry' : 'Comfortable')}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '20px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{
                  fontSize: 'clamp(44px, 5.5vw, 56px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: '#7dd3fc',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayHumidity}
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8' }}>
                  %
                </span>
              </div>

              {dewPoint != null && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                  Dew Point: <strong style={{ color: '#ffffff' }}>{dewPoint}°C</strong>
                </div>
              )}
            </div>

            {/* Humidity Fill Bar */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                <span>Dry 20%</span>
                <span>Ideal 50%</span>
                <span>Humid 90%</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(5, Number(displayHumidity)))}%`,
                  background: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 60%, #a5f3fc 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

          {/* ════════ CARD 4: WIND SPEED & DIRECTION (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(16, 185, 129, 0.28)',
              borderRadius: 22,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 14px 34px rgba(0, 0, 0, 0.35), 0 0 24px rgba(16, 185, 129, 0.1)',
            }}
          >
            {/* Top green glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.18)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                }}>
                  <Wind style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Wind Speed
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                    WEATHER STATION NODE 1
                  </span>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.35)',
              }}>
                {beaufort.label}
              </span>
            </div>

            {/* Primary Value + Compass Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '20px 0',
              zIndex: 1,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{
                    fontSize: 'clamp(44px, 5.5vw, 56px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    color: '#6ee7b7',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    {loading ? '--' : displayWind}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>
                    {displayWindUnit}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
                  Direction: <strong style={{ color: '#ffffff' }}>{parsedDir.text}</strong> ({parsedDir.deg}°)
                  {windGust != null && <span> • Gust: <strong>{Number(windGust).toFixed(1)} {displayWindUnit}</strong></span>}
                </div>
              </div>

              {/* Animated Compass Needle */}
              <div style={{
                position: 'relative',
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ position: 'absolute', top: 3, fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>N</span>
                <span style={{ position: 'absolute', bottom: 3, fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>S</span>
                <span style={{ position: 'absolute', right: 4, fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>E</span>
                <span style={{ position: 'absolute', left: 4, fontSize: 9, fontWeight: 800, color: '#94a3b8' }}>W</span>
                
                <div style={{
                  transform: `rotate(${parsedDir.deg}deg)`,
                  transition: 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Compass style={{ width: 28, height: 28, color: '#34d399' }} />
                </div>
              </div>
            </div>

            {/* Description */}
            <div style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.04)',
              fontSize: 11.5,
              color: '#94a3b8',
              zIndex: 1,
            }}>
              Beaufort Force {beaufort.level}: {beaufort.desc}
            </div>
          </motion.div>

          {/* ════════ CARD 5: RAINFALL (FROM WEATHER NODE1) ════════ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            style={{
              background: 'rgba(15, 23, 42, 0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: isRaining ? '1.5px solid #38bdf8' : '1.5px solid rgba(99, 102, 241, 0.28)',
              borderRadius: 22,
              padding: '24px 22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isRaining
                ? '0 14px 34px rgba(0, 0, 0, 0.4), 0 0 28px rgba(56, 189, 248, 0.25)'
                : '0 14px 34px rgba(0, 0, 0, 0.35), 0 0 24px rgba(99, 102, 241, 0.1)',
            }}
          >
            {/* Top blue/indigo glow */}
            <div style={{
              position: 'absolute',
              top: -30,
              right: -30,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: isRaining ? 'rgba(56, 189, 248, 0.25)' : 'rgba(99, 102, 241, 0.18)',
              filter: 'blur(30px)',
              pointerEvents: 'none',
            }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: isRaining ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isRaining ? '#38bdf8' : '#818cf8',
                  border: isRaining ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(99, 102, 241, 0.45)',
                }}>
                  <CloudRain style={{ width: 20, height: 20 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
                    Rainfall
                  </h3>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.04em' }}>
                    WEATHER STATION NODE 1
                  </span>
                </div>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 11.5,
                fontWeight: 700,
                backgroundColor: isRaining ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                color: isRaining ? '#38bdf8' : '#a5b4fc',
                border: isRaining ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(99, 102, 241, 0.35)',
              }}>
                {isRaining ? '🌧️ Active Rain' : 'Dry / Clear'}
              </span>
            </div>

            {/* Primary Value */}
            <div style={{ margin: '20px 0', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: 'clamp(44px, 5.5vw, 56px)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: isRaining ? '#38bdf8' : '#c7d2fe',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {loading ? '--' : displayRain}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color: isRaining ? '#38bdf8' : '#818cf8' }}>
                  mm
                </span>
              </div>

              <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
                Precipitation Gauge: <strong style={{ color: '#ffffff' }}>{isRaining ? 'Rainfall detected' : '0.0 mm accumulated'}</strong>
              </div>
            </div>

            {/* Liquid Tank Indicator */}
            <div style={{ zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 5 }}>
                <span>Dry</span>
                <span>Moderate (15mm)</span>
                <span>Heavy (50mm)</span>
              </div>
              <div style={{
                height: 8,
                borderRadius: 999,
                background: 'rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(isRaining ? 15 : 2, (Number(displayRain) / 50) * 100))}%`,
                  background: isRaining
                    ? 'linear-gradient(90deg, #38bdf8 0%, #0284c7 100%)'
                    : 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)',
                  borderRadius: 999,
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </motion.div>

        </div>

        {/* ── Summary Sensor Spec Strip ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 20px',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          fontSize: 12,
          color: '#94a3b8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: '#00bfa5' }} />
            <span><strong>Multi-Sensor Telemetry Fusion</strong>: Optical laser scattering, calibrated electrochemical sensors, ultrasonic anemometer &amp; tipping-bucket rain gauge.</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            <span>AQI: <strong style={{ color: aqiInfo.color }}>{aqiVal}</strong></span>
            <span>Temp: <strong style={{ color: '#fdba74' }}>{displayTemp}°{tempUnit}</strong></span>
            <span>Hum: <strong style={{ color: '#7dd3fc' }}>{displayHumidity}%</strong></span>
            <span>Wind: <strong style={{ color: '#6ee7b7' }}>{displayWind} {displayWindUnit}</strong></span>
            <span>Rain: <strong style={{ color: isRaining ? '#38bdf8' : '#c7d2fe' }}>{displayRain} mm</strong></span>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          from { opacity: 0.5; transform: scale(0.95); }
          to { opacity: 0.85; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
