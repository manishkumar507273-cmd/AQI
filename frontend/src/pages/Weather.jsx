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

export default function Weather({ cloudData, cloudLoading, cloudError, refreshKey, selectedStation = 'station-1' }) {
  const [cloud, setCloud]   = useState(() => selectedStation === 'station-1' ? cloudData : null);
  const [loading, setLoading] = useState(() => selectedStation === 'station-1' && !cloudData);
  const [error, setError]   = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => cloudData ? new Date() : null);
  const [activeWeatherModal, setActiveWeatherModal] = useState(null);

  useEffect(() => {
    let isMounted = true;

    if (selectedStation !== 'station-1') {
      setCloud(null);
      setLastUpdated(null);
      setLoading(false);
      setError(null);
      return;
    }

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
  }, [cloudData, cloudError, refreshKey, selectedStation]);

  if (loading) return (
    <div style={{ minHeight: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#00bfa5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#64748b', fontSize: 14, fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Reading weather telemetry...</p>
    </div>
  );

  if (error || !cloud) return (
    <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#ffffff', borderRadius: 20, padding: '40px 48px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-sans)' }}>Sensor Offline</p>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 8 }}>{error || 'No sensor data available.'}</p>
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

        {/* ── Standby Station Notice Banner ── */}
        {selectedStation !== 'station-1' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #00bfa5',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Info style={{ width: 18, height: 18, color: '#00bfa5', flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: '#475569', fontWeight: 600 }}>
                <strong style={{ color: '#0f172a' }}>Station Standby Mode:</strong> Weather telemetry sensors for this node are un-developed / pending setup. All metrics are displayed as <span style={{ color: '#00bfa5', fontWeight: 700 }}>null / N/A</span>.
              </span>
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999, backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
              UN-DEVELOPED NODE
            </span>
          </motion.div>
        )}

        {/* ── Titles ── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Weather Conditions
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
            Real-time atmospheric telemetry stream
          </p>
        </motion.div>

        {/* ── Clean Hero Container ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 24,
            padding: '32px 36px',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ zIndex: 1 }}>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{dateStr}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14 }}>
              <span style={{ fontSize: 64, lineHeight: 1 }}>{tempIcon}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: '#0f172a' }}>
                  {fmt(temperature, 1) ?? '--'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: '#64748b' }}>°C</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ padding: '6px 16px', borderRadius: 999, backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: 14, fontWeight: 700 }}>
                {tempLabel}
              </span>
              {aqi != null && (
                <span style={{ padding: '6px 16px', borderRadius: 999, backgroundColor: '#f8fafc', color: '#0f172a', fontSize: 14, fontWeight: 700, border: `1.5px solid ${aqiColor}50` }}>
                  AQI {aqi} · {aqiLabel}
                </span>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            padding: '20px 24px',
            width: 220,
          }}>
            <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: 10 }}>Sensors Online</div>
            <div style={{ fontSize: 13, color: '#0f172a', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>💧 Humidity: <strong style={{ fontFamily: 'var(--font-mono)', color: '#0284c7' }}>{humidity != null ? `${humidity}%` : 'N/A'}</strong></div>
              <div>💨 Wind: <strong style={{ fontFamily: 'var(--font-mono)', color: '#6366f1' }}>{windSpeed != null ? `${windSpeed} km/h` : 'N/A'}</strong></div>
              <div>🌧️ Rain: <strong style={{ fontFamily: 'var(--font-mono)', color: '#0891b2' }}>{rainGauge != null ? `${rainGauge} mm` : 'N/A'}</strong></div>
            </div>
          </div>
        </motion.div>

        {/* ── Weather Cards Grid with Parameter-Specific Icon Animations ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 14 }}>
          {[
            { key: 'temperature', name: 'Temperature', val: temperature != null ? `${fmt(temperature, 1)}°C` : 'N/A', icon: '🌡️', badgeBg: '#ffedd5', badgeText: '#ea580c', accent: '#ea580c' },
            { key: 'humidity', name: 'Humidity', val: humidity != null ? `${fmt(humidity, 1)}%` : 'N/A', icon: '💧', badgeBg: '#e0f2fe', badgeText: '#0284c7', accent: '#0284c7' },
            { key: 'wind_speed', name: 'Wind Speed', val: windSpeed != null ? `${fmt(windSpeed)} km/h` : 'N/A', icon: '💨', badgeBg: '#e0e7ff', badgeText: '#4f46e5', accent: '#4f46e5' },
            { key: 'rain_gauge', name: 'Rainfall', val: rainGauge != null ? `${fmt(rainGauge)} mm` : 'N/A', icon: '🌧️', badgeBg: '#cff4fc', badgeText: '#0891b2', accent: '#0891b2' },
            { key: 'wind_dir', name: 'Wind Direction', val: compassDir ? `${compassDir} (${fmt(windDir, 0)}°)` : 'N/A', icon: '🧭', badgeBg: '#f1f5f9', badgeText: '#475569', accent: '#64748b' },
          ].map(({ key, name, val, icon, badgeBg, badgeText, accent }, i) => {
            const anim = ICON_ANIMATIONS[key];

            return (
              <motion.div
                key={key}
                custom={i + 1} variants={cardVariants} initial="hidden" animate="visible"
                onClick={() => setActiveWeatherModal(key)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 20,
                  padding: '20px 20px',
                  color: '#0f172a',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                whileHover={{ scale: 1.02, y: -3, borderColor: '#00bfa5' }}
              >
                {/* Top Row: Icon + Parameter Name on left, Info Icon Button on top right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <motion.div
                      animate={anim?.animate}
                      transition={anim?.transition}
                      style={{
                        width: 38, height: 38, borderRadius: 10,
                        backgroundColor: badgeBg, color: accent,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, flexShrink: 0,
                      }}
                    >
                      {icon}
                    </motion.div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', color: '#0f172a', lineHeight: 1.1 }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                        Live Telemetry
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#64748b',
                    flexShrink: 0,
                  }}>
                    <Info style={{ width: 13, height: 13 }} />
                  </div>
                </div>

                {/* Bottom Row: Large Monospace Reading + Details Indicator */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: 4 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1 }}>
                      {val}
                    </div>
                  </div>

                  <div style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    backgroundColor: badgeBg,
                    color: badgeText,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}>
                    <span>Details</span>
                    <ChevronRight style={{ width: 11, height: 11 }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Weather Detail Modal with Product Links (Cool Light Theme) ── */}
      <AnimatePresence>
        {activeWeatherModal && activeDetail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
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
                background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: 24, width: '100%', maxWidth: 620, maxHeight: '90vh',
                overflowY: 'auto', padding: '28px 32px',
                boxShadow: '0 25px 60px rgba(15, 23, 42, 0.15)', position: 'relative',
                color: '#0f172a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActiveWeatherModal(null)}
                style={{
                  position: 'absolute', top: 22, right: 22,
                  width: 34, height: 34, borderRadius: '50%',
                  backgroundColor: '#f8fafc', border: '1px solid #cbd5e1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#64748b',
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  backgroundColor: 'rgba(0, 191, 165, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, flexShrink: 0,
                }}>
                  {activeDetail.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'var(--font-sans)' }}>
                    {activeDetail.name} ({activeDetail.sub})
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, margin: 0 }}>
                    Normal Operating Range: <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{activeDetail.normalRange}</strong>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Info style={{ width: 14, height: 14, color: '#00bfa5' }} />
                    Overview
                  </h4>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.description}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <HeartPulse style={{ width: 14, height: 14, color: '#ef4444' }} />
                    Health &amp; Environmental Impact
                  </h4>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.healthImpact}
                  </p>
                </div>

                {/* Sensor Hardware Box with Product Link */}
                <div style={{
                  backgroundColor: 'rgba(0, 191, 165, 0.04)', borderRadius: 14,
                  padding: '16px 18px', border: '1px solid rgba(0, 191, 165, 0.2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Sensor Hardware Module</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 10, backgroundColor: '#f8fafc', color: '#00bfa5', border: '1px solid rgba(0,191,165,0.3)', fontFamily: 'var(--font-mono)' }}>
                      {activeDetail.sensorType}
                    </span>
                  </div>
                  {activeDetail.sensorImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <img src={activeDetail.sensorImage} alt={activeDetail.sensorName} style={{ width: 70, height: 55, objectFit: 'contain', borderRadius: 8, backgroundColor: '#f8fafc', padding: 4, border: '1px solid #e2e8f0' }} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{activeDetail.sensorName}</div>
                        {activeDetail.sensorUrl && (
                          <a href={activeDetail.sensorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#00bfa5', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <span>View Product Page</span>
                            <ExternalLink style={{ width: 11, height: 11 }} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>{activeDetail.sensorWorking}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
