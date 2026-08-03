import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCloudLatest } from '../api';
import { Cpu, ExternalLink, X, Droplets, Wind, CloudRain, Compass, ChevronRight, Info, HeartPulse, ShieldAlert, Users, CheckCircle2, AlertTriangle, Thermometer } from 'lucide-react';
import sht45SensorImg from '../assets/sht45_sensor.png';
import windSpeedSensorImg from '../assets/wind_speed_sensor.png';
import windDirSensorImg from '../assets/wind_dir_sensor.png';
import rainGaugeSensorImg from '../assets/rain_gauge_sensor.png';

const fmt = (val, d = 1) =>
  val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : null;

const getCompassDir = (deg) => {
  if (deg == null) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
};

const getHumidityLabel = (h) => {
  if (h == null) return '—';
  if (h < 30)  return 'Very Dry';
  if (h < 50)  return 'Comfortable';
  if (h < 70)  return 'Moderate';
  if (h < 85)  return 'Humid';
  return 'Very Humid';
};

const getTempLabel = (t) => {
  if (t == null) return '—';
  if (t < 10)  return 'Cold';
  if (t < 20)  return 'Cool';
  if (t < 28)  return 'Pleasant';
  if (t < 35)  return 'Warm';
  return 'Hot';
};

const getTempIcon = (t) => {
  if (t == null) return '🌡️';
  if (t < 10)  return '❄️';
  if (t < 20)  return '🌥️';
  if (t < 28)  return '⛅';
  if (t < 35)  return '🌤️';
  return '☀️';
};

const getRainLabel = (r) => {
  if (r == null || r === 0) return 'No Rainfall';
  if (r < 5)  return 'Light Rain';
  if (r < 20) return 'Moderate Rain';
  return 'Heavy Rain';
};

const getWindLabel = (w) => {
  if (w == null) return '—';
  if (w < 5)  return 'Calm';
  if (w < 15) return 'Light Breeze';
  if (w < 30) return 'Moderate';
  if (w < 50) return 'Strong';
  return 'Very Strong';
};

// Parameter-specific animations
const ICON_ANIMATIONS = {
  temperature: { animate: { scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }, transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } },
  humidity: { animate: { y: [0, -6, 0] }, transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
  wind_speed: { animate: { x: [-3, 5, -3], rotate: [0, 10, -5, 0] }, transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" } },
  rain_gauge: { animate: { y: [-4, 4, -4], scaleY: [1, 1.1, 1] }, transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } },
  wind_dir: { animate: { rotate: [0, 360] }, transition: { duration: 12, repeat: Infinity, ease: "linear" } },
};

const WEATHER_DETAILS = {
  temperature: {
    name: 'Ambient Temperature',
    sub: 'Thermal Degree',
    unit: '°C',
    icon: '🌡️',
    normalRange: '18°C – 28°C',
    description: 'Degree or intensity of heat present in ambient air as measured by digital semiconductor thermal sensors.',
    healthImpact: 'Extreme heat (>35°C) causes heat exhaustion, dehydration, and heatstroke, while exacerbating cardiovascular and lung conditions. Cold extremes (<10°C) trigger respiratory distress.',
    vulnerable: 'Infants, elderly adults, outdoor workers, pregnant women, and individuals with cardiovascular diseases.',
    precaution: 'Stay hydrated, limit peak outdoor exposure between 12 PM – 4 PM on high temperature days, and maintain ventilated indoor spaces.',
    sensorName: '7Semi SHT45 High Precision Temperature & Humidity Sensor',
    sensorType: 'I2C Precision Digital Thermal Sensor',
    sensorImage: sht45SensorImg,
    sensorUrl: 'https://robocraze.com/products/7semi-sht45-humidity-temperature-sensor-breakout-board-with-4-pin-connector?variant=48177129554144',
    sensorWorking: `Employs Sensirion's CMOSens® bandgap temperature sensing element delivering high precision (±0.1°C) with low power consumption across -40°C to 125°C range.`,
    sensorSpecs: 'Accuracy: ±0.1°C | Range: -40°C to +125°C | Output: I2C Digital | Supply: 1.62V – 3.6V'
  },
  humidity: {
    name: 'Relative Humidity',
    sub: 'RH %',
    unit: '%',
    icon: '💧',
    normalRange: '30% – 60%',
    description: 'Amount of water vapor present in air expressed as a percentage of the amount needed for saturation at the same temperature.',
    healthImpact: 'High humidity (>70%) promotes dust mite and mold growth, worsening asthma and respiratory allergies. Low humidity (<30%) dries nasal membranes and causes skin irritation.',
    vulnerable: 'Asthma sufferers, infants, elderly, and individuals with eczema or sinus issues.',
    precaution: 'Maintain indoor humidity between 30% and 50% using dehumidifiers or humidifiers. Ventilate bathrooms and kitchens to prevent moisture accumulation.',
    sensorName: '7Semi SHT45 Humidity & Temperature Sensor Breakout Board',
    sensorType: '4-Pin JST I2C Digital Sensor',
    sensorImage: sht45SensorImg,
    sensorUrl: 'https://robocraze.com/products/7semi-sht45-humidity-temperature-sensor-breakout-board-with-4-pin-connector?variant=48177129554144',
    sensorWorking: `Uses Sensirion's 4th generation SHT45 CMOSens® technology with high-accuracy capacitive relative humidity measurement and integrated internal heater for condensation recovery.`,
    sensorSpecs: 'Temp Accuracy ±0.1°C | RH Accuracy ±1.0% RH | Supply: 1.62V – 3.6V | I2C Output'
  },
  wind_speed: {
    name: 'Wind Speed',
    sub: 'Velocity',
    unit: 'km/h',
    icon: '💨',
    normalRange: '0 – 20 km/h',
    description: 'Velocity of air movement caused by atmospheric pressure differences from high to low pressure regions.',
    healthImpact: 'High winds transport particulate matter, dust storms, and airborne allergens across vast distances, accelerating respiratory exposure.',
    vulnerable: 'Outdoor workers, cyclists, asthmatic individuals, and allergy sufferers.',
    precaution: 'Secure outdoor loose objects during high wind advisories. Wear protective eyewear and N95 masks during windy dust conditions.',
    sensorName: 'Wind Speed Sensor SN-3000-FSJT-NPN (Three-Cup Anemometer)',
    sensorType: 'NPN Pulse Output Anemometer',
    sensorImage: windSpeedSensorImg,
    sensorUrl: 'https://robu.in/product/wind-speed-sensor-sn-3000-fsjt-npn/',
    sensorWorking: 'Three rotating hemispherical cups generate magnetic Hall effect pulses proportional to ambient wind velocity.',
    sensorSpecs: 'Range: 0 – 30 m/s (0 – 108 km/h) | Accuracy: ±1 m/s | Output: NPN Pulse | 12–24V DC'
  },
  rain_gauge: {
    name: 'Precipitation Rainfall',
    sub: 'Rain Gauge',
    unit: 'mm',
    icon: '🌧️',
    normalRange: '0 – 10 mm/hr',
    description: 'Volume of liquid precipitation falling over a specified surface area measured in millimeters depth.',
    healthImpact: 'Heavy rainfall leads to increased indoor dampness, mold spore surges, localized flooding, and runoff carrying ground pollutants.',
    vulnerable: 'Residents in low-lying flood zones, individuals with mold allergies, and drivers.',
    precaution: 'Inspect building roofs and drainage systems. Use indoor air purifiers following heavy rainfall to reduce airborne mold spore counts.',
    sensorName: 'DFRobot Gravity: Tipping Bucket Rainfall Sensor',
    sensorType: 'I2C / UART Tipping Bucket',
    sensorImage: rainGaugeSensorImg,
    sensorUrl: 'https://robocraze.com/products/dfrobot-gravity-tipping-bucket-rainfall-sensor-i2c-uart',
    sensorWorking: 'Funneled rainwater fills an internal mechanical tipping bucket. Each tip event measures 0.2794 mm of precipitation via reed switch pulse counting.',
    sensorSpecs: 'Resolution: 0.2794 mm/tip | Output: I2C & UART | Voltage: 3.3V – 5.0V DC'
  },
  wind_dir: {
    name: 'Wind Azimuth Direction',
    sub: 'Compass Heading',
    unit: '°',
    icon: '🧭',
    normalRange: '0° – 360°',
    description: 'Compass heading indicating the direction from which atmospheric wind is originating.',
    healthImpact: 'Wind direction determines the transport corridor of industrial plumes, agricultural smoke, and urban pollution.',
    vulnerable: 'Communities downwind of industrial plants, highways, or agricultural burning regions.',
    precaution: 'Check wind direction forecasts to anticipate downwind smoke or pollution drift toward your residential area.',
    sensorName: 'Wind Direction Sensor SN-3000-FSJT-I20 (Wind Vane)',
    sensorType: '4-20mA Current Output Wind Vane',
    sensorImage: windDirSensorImg,
    sensorUrl: 'https://robu.in/product/wind-speed-sensor-sn-3000-fsjt-i20/',
    sensorWorking: 'Low-inertia wind vane drives a magnetic angle sensor mapped to 4-20mA current outputs for precise 0°–360° direction telemetry.',
    sensorSpecs: 'Range: 0°–360° (16 Directions) | Accuracy: ±3° | Output: 4-20mA | 12–24V DC'
  }
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  }),
};

export default function Weather({ cloudData, cloudLoading, cloudError, refreshKey }) {
  const [cloud, setCloud]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeWeatherModal, setActiveWeatherModal] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (cloudData) {
      setCloud(cloudData);
      setLastUpdated(new Date());
      setLoading(false);
      setError(cloudError ?? null);
      return;
    }
    setError(null);
    getCloudLatest()
      .then((res) => {
        if (!isMounted) return;
        setCloud(res.data?.data ?? null);
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Unable to reach cloud sensor.');
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [cloudData, cloudError, refreshKey]);

  if (loading) return (
    <div style={{ minHeight: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#00bfa5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Reading weather telemetry...</p>
    </div>
  );

  if (error || !cloud) return (
    <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#131e2b', borderRadius: 20, padding: '40px 48px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-sans)' }}>Sensor Offline</p>
        <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8 }}>{error || 'No sensor data available.'}</p>
      </div>
    </div>
  );

  const temperature = cloud?.temperature    ?? null;
  const humidity    = cloud?.humidity       ?? null;
  const windSpeed   = cloud?.wind_speed     ?? null;
  const windDir     = cloud?.wind_direction ?? null;
  const rainGauge   = cloud?.rain_gauge     ?? null;
  const aqi         = cloud?.cpcb_aqi       ?? null;
  const aqiLabel    = cloud?.aqi_info?.label  ?? null;
  const aqiColor    = cloud?.aqi_info?.color  ?? '#94a3b8';

  const compassDir = getCompassDir(windDir);
  const tempIcon   = getTempIcon(temperature);
  const tempLabel  = getTempLabel(temperature);
  const dateStr = (lastUpdated || new Date()).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const activeDetail = activeWeatherModal ? WEATHER_DETAILS[activeWeatherModal] : null;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Titles ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
            Weather Conditions
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
            Real-time atmospheric telemetry stream
          </p>
        </motion.div>

        {/* ── Clean Hero Container ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{
            backgroundColor: '#131e2b',
            borderRadius: 24,
            padding: '32px 36px',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          <div style={{ zIndex: 1 }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>{dateStr}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
              <span style={{ fontSize: 64, lineHeight: 1 }}>{tempIcon}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: '#ffffff' }}>
                  {fmt(temperature, 1) ?? '--'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#94a3b8' }}>°C</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ padding: '6px 16px', borderRadius: 999, backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: 14, fontWeight: 700 }}>
                {tempLabel}
              </span>
              {aqi != null && (
                <span style={{ padding: '6px 16px', borderRadius: 999, backgroundColor: `${aqiColor}20`, color: '#ffffff', fontSize: 14, fontWeight: 700, border: `1px solid ${aqiColor}30` }}>
                  AQI {aqi} · {aqiLabel}
                </span>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 20,
            padding: '20px 24px',
            width: 220,
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Sensors Online</div>
            <div style={{ fontSize: 13, color: '#ffffff', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>💧 Humidity: <strong style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{humidity}%</strong></div>
              <div>💨 Wind: <strong style={{ fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{windSpeed} km/h</strong></div>
              <div>🌧️ Rain: <strong style={{ fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>{rainGauge} mm</strong></div>
            </div>
          </div>
        </motion.div>

        {/* ── Weather Cards Grid with Parameter-Specific Icon Animations ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { key: 'temperature', name: 'Temperature', val: temperature != null ? `${fmt(temperature, 1)}°C` : 'N/A', icon: '🌡️', badgeBg: 'rgba(249, 115, 22, 0.12)', badgeText: '#f97316', accent: '#f97316' },
            { key: 'humidity', name: 'Humidity', val: humidity != null ? `${fmt(humidity, 1)}%` : 'N/A', icon: '💧', badgeBg: 'rgba(56, 189, 248, 0.12)', badgeText: '#38bdf8', accent: '#38bdf8' },
            { key: 'wind_speed', name: 'Wind Speed', val: windSpeed != null ? `${fmt(windSpeed)} km/h` : 'N/A', icon: '💨', badgeBg: 'rgba(129, 140, 248, 0.12)', badgeText: '#818cf8', accent: '#818cf8' },
            { key: 'rain_gauge', name: 'Rainfall', val: rainGauge != null ? `${fmt(rainGauge)} mm` : 'N/A', icon: '🌧️', badgeBg: 'rgba(34, 211, 238, 0.12)', badgeText: '#22d3ee', accent: '#22d3ee' },
            { key: 'wind_dir', name: 'Wind Direction', val: compassDir ? `${compassDir} (${fmt(windDir, 0)}°)` : 'N/A', icon: '🧭', badgeBg: 'rgba(148, 163, 184, 0.12)', badgeText: '#94a3b8', accent: '#94a3b8' },
          ].map(({ key, name, val, icon, badgeBg, badgeText, accent }, i) => {
            const anim = ICON_ANIMATIONS[key];

            return (
              <motion.div
                key={key}
                custom={i + 1} variants={cardVariants} initial="hidden" animate="visible"
                onClick={() => setActiveWeatherModal(key)}
                style={{
                  backgroundColor: '#131e2b',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 18,
                  padding: '18px 20px',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s ease',
                }}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <motion.div
                    animate={anim?.animate}
                    transition={anim?.transition}
                    style={{
                      width: 40, height: 40, borderRadius: 10,
                      backgroundColor: badgeBg, color: accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}
                  >
                    {icon}
                  </motion.div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', color: '#ffffff' }}>
                      {name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, marginTop: 3, color: '#ffffff' }}>
                      {val}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  backgroundColor: badgeBg,
                  color: badgeText,
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}>
                  <span>Impact Details</span>
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Weather Detail Modal with Product Links ── */}
      <AnimatePresence>
        {activeWeatherModal && activeDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(11, 19, 30, 0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={() => setActiveWeatherModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              style={{
                background: '#131e2b', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24, width: '100%', maxWidth: 620, maxHeight: '90vh',
                overflowY: 'auto', padding: '28px 32px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)', position: 'relative',
                color: '#ffffff',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActiveWeatherModal(null)}
                style={{
                  position: 'absolute', top: 22, right: 22,
                  width: 34, height: 34, borderRadius: '50%',
                  backgroundColor: '#182638', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#94a3b8',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  backgroundColor: 'rgba(0, 191, 165, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                }}>
                  {activeDetail.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#ffffff', margin: 0, fontFamily: 'var(--font-sans)' }}>
                    {activeDetail.name} ({activeDetail.sub})
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4, margin: 0 }}>
                    Normal Operating Range: <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{activeDetail.normalRange}</strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Info style={{ width: 14, height: 14, color: '#00bfa5' }} />
                    Overview
                  </h4>
                  <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.description}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <HeartPulse style={{ width: 14, height: 14, color: '#ef4444' }} />
                    Health &amp; Environmental Impact
                  </h4>
                  <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.healthImpact}
                  </p>
                </div>

                {/* Sensor Hardware Box with Product Link */}
                <div style={{
                  backgroundColor: 'rgba(0, 191, 165, 0.06)', borderRadius: 14,
                  padding: '16px 18px', border: '1px solid rgba(0, 191, 165, 0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>Sensor Hardware Module</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10, backgroundColor: '#182638', color: '#00bfa5', border: '1px solid rgba(0,191,165,0.3)', fontFamily: 'var(--font-mono)' }}>
                      {activeDetail.sensorType}
                    </span>
                  </div>
                  {activeDetail.sensorImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <img src={activeDetail.sensorImage} alt={activeDetail.sensorName} style={{ width: 70, height: 55, objectFit: 'contain', borderRadius: 8, backgroundColor: '#182638', padding: 4, border: '1px solid rgba(255,255,255,0.08)' }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>{activeDetail.sensorName}</div>
                        {activeDetail.sensorUrl && (
                          <a href={activeDetail.sensorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#00bfa5', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span>View Product Page</span>
                            <ExternalLink style={{ width: 11, height: 11 }} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>{activeDetail.sensorWorking}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
