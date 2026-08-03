import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronRight, Table, RefreshCw, X, CheckCircle2, AlertTriangle, Users, ShieldAlert, Info, HeartPulse, Factory, Cpu, ExternalLink } from 'lucide-react';
import { getCloudLatest, getCloudLiveHistory } from '../api';
import sensirionSensorImg from '../assets/sensirion_sensor.png';
import mq131SensorImg from '../assets/mq131_sensor.png';
import no2SensorImg from '../assets/no2_sensor.png';
import coSensorImg from '../assets/co_sensor.png';

const POLLUTANT_DETAILS = {
  pm25: {
    name: 'Particulate Matter 2.5',
    sub: 'PM2.5',
    unit: 'µg/m³',
    icon: '🌫️',
    whoLimit: 15,
    color: '#38bdf8',
    description: 'Fine inhalable particles with diameters 2.5 micrometers or smaller (about 30 times smaller than a human hair). Due to their minute size, they penetrate deep into lung alveoli and enter the circulatory system.',
    sources: ['Vehicle exhaust & diesel engine emissions', 'Coal-fired power plants & industrial facilities', 'Agricultural biomass burning', 'Indoor cooking & combustion'],
    healthImpact: 'Causes respiratory inflammation, triggers asthma attacks, increases risk of heart disease, stroke, and lung cancer. Short-term exposure causes eye, nose, and throat irritation.',
    vulnerable: 'Children, elderly individuals, pregnant women, and people with pre-existing heart or lung conditions.',
    precaution: 'Use N95/FFP2 masks outdoors on high pollution days. Run indoor air purifiers equipped with true HEPA filters. Keep windows closed during peak pollution hours.',
    sensorName: 'Sensirion Particulate Matter Sensor (0 to 1000 µg/m³)',
    sensorType: 'Laser Scattering (I2C / UART Calibrated)',
    sensorImage: sensirionSensorImg,
    sensorUrl: 'https://robu.in/product/sensirion-particulate-matter-sensor-0-to-1000-%c2%b5g-m3-laser-i2c-uart-calibrated-4-5-to-5-5-v-supply/',
    sensorWorking: `Uses Sensirion's innovative optical laser scattering technology combined with advanced contamination-resistance algorithms. An internal fan draws ambient air through the optical chamber to accurately count and measure fine PM2.5 particles from 0 to 1000 µg/m³ with a >10 year lifespan.`,
    sensorSpecs: 'Range: 0 – 1000 µg/m³ | Voltage: 4.5V – 5.5V | Interface: I2C & UART | Lifetime: >10 Years'
  },
  pm10: {
    name: 'Particulate Matter 10',
    sub: 'PM10',
    unit: 'µg/m³',
    icon: '☁️',
    whoLimit: 45,
    color: '#818cf8',
    description: 'Inhalable dust particles with diameters 10 micrometers or smaller. Comprises dust, pollen, mold spores, and pulverized road dirt.',
    sources: ['Road dust from vehicular traffic', 'Construction sites & unpaved roads', 'Crushing & grinding operations', 'Windblown soil & dust storms'],
    healthImpact: 'Irritates upper airways, eyes, and throat. Causes coughing, wheezing, and aggravates chronic respiratory conditions like bronchitis and asthma.',
    vulnerable: 'People with asthma, COPD, allergies, and those engaging in outdoor activities.',
    precaution: 'Avoid outdoor exercise near busy roads or construction sites. Wet-mop indoor surfaces to trap settled dust. Wear a protective mask during dusty conditions.',
    sensorName: 'Sensirion Particulate Matter Sensor (0 to 1000 µg/m³)',
    sensorType: 'Laser Scattering (I2C / UART Calibrated)',
    sensorImage: sensirionSensorImg,
    sensorUrl: 'https://robu.in/product/sensirion-particulate-matter-sensor-0-to-1000-%c2%b5g-m3-laser-i2c-uart-calibrated-4-5-to-5-5-v-supply/',
    sensorWorking: 'Sensirion SPS30 measures mass concentrations of coarse PM10 dust particles alongside PM2.5 using precise laser scattering pulse height analysis. Features automated fan cleaning for long-term calibration stability.',
    sensorSpecs: 'Range: 0 – 1000 µg/m³ | Voltage: 4.5V – 5.5V | Interface: I2C & UART | Lifetime: >10 Years'
  },
  co: {
    name: 'Carbon Monoxide',
    sub: 'CO',
    unit: 'mg/m³',
    icon: '💨',
    whoLimit: 4,
    color: '#94a3b8',
    description: 'A colorless, odorless, toxic gas formed during the incomplete combustion of carbon-containing fuels (gasoline, wood, coal, natural gas).',
    sources: ['Automobile exhaust (especially idling vehicles)', 'Gas heaters & unvented stoves', 'Industrial furnaces & boilers', 'Garbage burning & wildfires'],
    healthImpact: 'Binds with hemoglobin to reduce oxygen delivery to brain and heart tissue. Causes headaches, dizziness, fatigue, nausea, and disorientation at high levels.',
    vulnerable: 'Infants, pregnant women, senior citizens, and individuals with cardiovascular diseases.',
    precaution: 'Ensure proper ventilation for gas stoves and space heaters. Avoid idling vehicles inside enclosed garages. Install indoor carbon monoxide detectors.',
    sensorName: 'Winsen ZE07-CO Electrochemical Carbon Monoxide Sensor Module',
    sensorType: 'Electrochemical Gas Sensing Module (UART / Analog)',
    sensorImage: coSensorImg,
    sensorUrl: 'https://robu.in/product/winsen-electrochemical-co-sensor-module-ze07-co/',
    sensorWorking: 'Employs electrochemical sensing principle to measure Carbon Monoxide (CO) gas in ambient air. The oxidation reaction on the working electrode produces an electrical current directly proportional to CO concentration, outputting both DAC analog and UART digital serial telemetry.',
    sensorSpecs: 'Range: 0 – 500 ppm CO | Operating Voltage: 5.0V to 12.0V DC | Interface: UART & DAC Analog | Response Time: ≤30s'
  },
  no2: {
    name: 'Nitrogen Dioxide',
    sub: 'NO₂',
    unit: 'µg/m³',
    icon: '🏭',
    whoLimit: 25,
    color: '#c084fc',
    description: 'A highly reactive, reddish-brown toxic gas with a sharp odor. Primarily formed when fossil fuels burn at high temperatures.',
    sources: ['Motor vehicle exhaust (especially diesel engines)', 'Thermal power stations & petroleum refineries', 'Industrial boilers & gas stoves'],
    healthImpact: 'Inflames lung airways, increases susceptibility to respiratory infections, worsens asthma symptoms, and reduces overall lung development in children.',
    vulnerable: 'Asthmatic individuals, young children, and residents living near major highway corridors.',
    precaution: 'Use kitchen exhaust hoods while cooking with gas. Avoid walking or jogging along heavy traffic routes during rush hour peak times.',
    sensorName: 'Fermion: MEMS Nitrogen Dioxide (NO2) Gas Detection Sensor',
    sensorType: 'MEMS Micro-Machined Gas Sensor',
    sensorImage: no2SensorImg,
    sensorUrl: 'https://robocraze.com/products/fermion-mems-nitrogen-dioxide-no2-gas-detection-sensor?variant=46009764610272',
    sensorWorking: 'Uses advanced MEMS technology with a metal-oxide semiconductor micro-hotplate. When NO2 gas contacts the heated sensing layer, its electrical resistance changes proportionally to gas concentration, providing high sensitivity, low power consumption, and fast response times.',
    sensorSpecs: 'Range: 0.1 – 10 ppm | Supply Voltage: 3.3V – 5.0V | Output: Analog Signal'
  },
  o3: {
    name: 'Ground-level Ozone',
    sub: 'O₃',
    unit: 'µg/m³',
    icon: '☀️',
    whoLimit: 100,
    color: '#fbbf24',
    description: 'A secondary pollutant formed when Nitrogen Oxides (NOx) and Volatile Organic Compounds (VOCs) react chemically in sunlight and heat.',
    sources: ['Secondary pollutant formed from vehicle exhaust + industrial emissions + sunlight', 'Evaporative emissions from gasoline, solvents, & paints'],
    healthImpact: 'Triggers chest pain, coughing, throat soreness, and airway constriction. Reduces lung function and damages lung tissue with repeated exposure.',
    vulnerable: 'Outdoor workers, athletes exercising outside in summer afternoons, children, and people with lung ailments.',
    precaution: 'Plan outdoor activities for early morning hours before sunlight drives ozone production. Stay indoors in air-conditioned spaces during sunny afternoons.',
    sensorName: 'MQ-131 Ozone Gas Detection Module',
    sensorType: 'Semiconductor Metal Oxide Sensor (MOS)',
    sensorImage: mq131SensorImg,
    sensorUrl: 'https://robocraze.com/products/mq131-ozone-gas-detection-module',
    sensorWorking: 'Uses a micro-heater and WO3 / SnO2 semiconductor surface. When Ozone (O3) gas contacts the heated sensor element, its electrical conductivity changes proportionally to gas concentration. The onboard comparator circuit outputs analog and TTL digital signals.',
    sensorSpecs: 'Range: 10ppb – 1000ppb | Operating Voltage: 5V DC | Output: Analog & TTL Digital'
  }
};

const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }
  }),
};

const getAqiColor = (val) => {
  if (val <= 50)  return '#22c55e'; // Good
  if (val <= 100) return '#eab308'; // Moderate
  if (val <= 150) return '#f97316'; // Poor
  if (val <= 200) return '#ef4444'; // Unhealthy
  if (val <= 300) return '#a855f7'; // Severe
  return '#f43f5e';                 // Hazardous
};

const POLLUTANT_CARD_STYLE = {
  pm25: { bg: '#131e2b', border: 'rgba(56, 189, 248, 0.2)', badgeBg: 'rgba(56, 189, 248, 0.12)', badgeText: '#38bdf8', accent: '#38bdf8' },
  pm10: { bg: '#131e2b', border: 'rgba(129, 140, 248, 0.2)', badgeBg: 'rgba(129, 140, 248, 0.12)', badgeText: '#818cf8', accent: '#818cf8' },
  co:   { bg: '#131e2b', border: 'rgba(148, 163, 184, 0.2)', badgeBg: 'rgba(148, 163, 184, 0.12)', badgeText: '#94a3b8', accent: '#94a3b8' },
  no2:  { bg: '#131e2b', border: 'rgba(192, 132, 252, 0.2)', badgeBg: 'rgba(192, 132, 252, 0.12)', badgeText: '#c084fc', accent: '#c084fc' },
  o3:   { bg: '#131e2b', border: 'rgba(251, 191, 36, 0.2)', badgeBg: 'rgba(251, 191, 36, 0.12)', badgeText: '#fbbf24', accent: '#fbbf24' },
};

export default function Dashboard({ cloudData, cloudLoading, cloudError, onDataLoad, refreshKey, onNavigateToWeather }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePollutantModal, setActivePollutantModal] = useState(null);
  const [liveHistory, setLiveHistory] = useState([]);
  const [liveHistoryLoading, setLiveHistoryLoading] = useState(true);

  const fmt = (val, decimals = 2) => val != null ? Number(val).toFixed(decimals) : 'N/A';
  const fmtSmart = (val, d = 1) => val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : 'N/A';

  useEffect(() => {
    let isMounted = true;

    const fetchLiveHistory = () => {
      getCloudLiveHistory(50)
        .then((res) => {
          if (!isMounted) return;
          setLiveHistory(res.data?.history || []);
          setLiveHistoryLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error('Failed to fetch live history:', err);
          setLiveHistoryLoading(false);
        });
    };

    fetchLiveHistory();
    const historyInterval = setInterval(fetchLiveHistory, 5000);

    if (cloudData) {
      const cloud = cloudData;
      const combined = {
        location: { name: 'Sensor Station', country: 'IN' },
        aqi: {
          value: cloud?.cpcb_aqi ?? 'N/A',
          label: cloud?.aqi_info?.label ?? 'N/A',
          color: cloud?.aqi_info?.color ?? '#94a3b8',
        },
        pollutants: {
          pm25: { value: fmt(cloud?.pm25) },
          pm10: { value: fmt(cloud?.pm10) },
          co:   { value: fmt(cloud?.co) },
          no2:  { value: fmt(cloud?.no2) },
          o3:   { value: fmt(cloud?.o3) },
        },
        weather: {
          temperature:     fmtSmart(cloud?.temperature, 1),
          humidity:        fmtSmart(cloud?.humidity, 1),
          wind_speed:      cloud?.wind_speed     != null ? fmtSmart(cloud.wind_speed, 1)     : 'N/A',
          wind_direction:  cloud?.wind_direction != null ? fmtSmart(cloud.wind_direction, 1) : 'N/A',
          rain_gauge:      cloud?.rain_gauge     != null ? fmtSmart(cloud.rain_gauge, 1)     : 'N/A',
        },
        dominant_pollutant: cloud?.dominant_pollutant ?? 'N/A',
        timestamp: cloud?.timestamp ?? 'N/A',
      };
      setData(combined);
      if (onDataLoad) onDataLoad(combined.location);
      setLoading(false);
      setError(cloudError ?? null);
      return;
    }

    if (!data) setLoading(true);
    setError(null);

    getCloudLatest()
      .then((cloudRes) => {
        if (!isMounted) return;
        const cloud = cloudRes.data?.data;
        const combined = {
          location: { name: 'Sensor Station', country: 'IN' },
          aqi: {
            value: cloud?.cpcb_aqi ?? 'N/A',
            label: cloud?.aqi_info?.label ?? 'N/A',
            color: cloud?.aqi_info?.color ?? '#94a3b8',
          },
          pollutants: {
            pm25: { value: fmt(cloud?.pm25) },
            pm10: { value: fmt(cloud?.pm10) },
            co:   { value: fmt(cloud?.co) },
            no2:  { value: fmt(cloud?.no2) },
            o3:   { value: fmt(cloud?.o3) },
          },
          weather: {
            temperature:     fmtSmart(cloud?.temperature, 1),
            humidity:        fmtSmart(cloud?.humidity, 1),
            wind_speed:      cloud?.wind_speed     != null ? fmtSmart(cloud.wind_speed, 1)     : 'N/A',
            wind_direction:  cloud?.wind_direction != null ? fmtSmart(cloud.wind_direction, 1) : 'N/A',
            rain_gauge:      cloud?.rain_gauge     != null ? fmtSmart(cloud.rain_gauge, 1)     : 'N/A',
          },
          dominant_pollutant: cloud?.dominant_pollutant ?? 'N/A',
          timestamp: cloud?.timestamp ?? 'N/A',
        };
        setData(combined);
        if (onDataLoad) onDataLoad(combined.location);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch cloud data:', err);
        setError('Unable to fetch sensor data from cloud.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
      clearInterval(historyInterval);
    };
  }, [cloudData, cloudError, refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#00bfa5',
          animation: 'spin 0.9s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#94a3b8', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Loading air quality telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <div style={{ backgroundColor: '#131e2b', borderRadius: 20, padding: 40, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          <AlertCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#ffffff' }}>Data Unavailable</h3>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>{error || 'Could not load AQI data.'}</p>
        </div>
      </div>
    );
  }

  const { location, aqi, pollutants, weather } = data;
  const aqiValue = aqi.value || 0;
  const aqiLabel = aqi.label || 'Good';

  const scalePosition = Math.min((aqiValue / 500) * 100, 100);
  const aqiColor = getAqiColor(aqiValue);

  const activeDetail = activePollutantModal ? POLLUTANT_DETAILS[activePollutantModal] : null;
  const activePollutantVal = activePollutantModal && pollutants?.[activePollutantModal]?.value !== 'N/A'
    ? Number(pollutants[activePollutantModal].value)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Page Header Titles ── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', margin: 0 }}>
          Real-time Air Quality Index
        </h1>
        <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
          Last Updated: <span style={{ color: '#00bfa5', fontWeight: 600 }}>{data?.timestamp ? new Date(data.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }) : new Date().toLocaleString()}</span>
        </div>
      </motion.div>

      {/* ── HERO AQI CARD (Background color changes dynamically according to sliding scale bar) ── */}
      <motion.div
        custom={0} variants={cardVariants} initial="hidden" animate="visible"
        style={{
          backgroundColor: aqiColor === '#22c55e' ? '#0f2c22' :
                           aqiColor === '#eab308' ? '#2e2711' :
                           aqiColor === '#f97316' ? '#331d10' :
                           aqiColor === '#ef4444' ? '#361517' :
                           aqiColor === '#a855f7' ? '#271638' : '#331018',
          borderRadius: 24,
          padding: '28px 32px',
          color: '#ffffff',
          border: `1px solid ${aqiColor}40`,
          boxShadow: `0 8px 32px ${aqiColor}20`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          transition: 'background-color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, backgroundColor: aqiColor }} />

        {/* Left Side */}
        <div style={{ flex: 1, minWidth: 280, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status Panel</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 72, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: '#ffffff' }}>
                {aqiValue}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                LIVE AQI (IN)
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Air Quality is</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 18px', borderRadius: 999,
                backgroundColor: `${aqiColor}20`,
                border: `1.5px solid ${aqiColor}40`,
                color: '#ffffff', fontSize: 16, fontWeight: 800,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: aqiColor }} />
                <span>{aqiLabel}</span>
              </div>
            </div>
          </div>

          {/* Scale Bar */}
          <div style={{ maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginBottom: 6 }}>
              {[
                { label: 'Good', color: '#22c55e' },
                { label: 'Moderate', color: '#eab308' },
                { label: 'Poor', color: '#f97316' },
                { label: 'Unhealthy', color: '#ef4444' },
                { label: 'Severe', color: '#a855f7' },
                { label: 'Hazardous', color: '#f43f5e' }
              ].map((item) => (
                <span key={item.label} style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.label}</span>
              ))}
            </div>

            <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', marginBottom: 8 }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 10%, #eab308 10%, #eab308 20%, #f97316 20%, #f97316 40%, #ef4444 40%, #ef4444 60%, #a855f7 60%, #a855f7 80%, #f43f5e 80%, #f43f5e 100%)',
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${scalePosition}%`,
                transform: 'translate(-50%, -50%)',
                width: 16, height: 16, borderRadius: '50%',
                backgroundColor: '#ffffff', border: `3px solid ${aqiColor}`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                zIndex: 2,
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
              {['0', '50', '100', '150', '200', '300', '301+'].map((num) => (
                <span key={num} style={{ fontSize: 9.5, fontWeight: 600, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{num}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Weather Widget */}
        {weather && (
          <div
            onClick={onNavigateToWeather}
            style={{
              flex: '0 0 auto',
              width: 230,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              padding: '20px 22px',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 32 }}>🌤️</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>
                  {weather.temperature ?? '0'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#94a3b8' }}>°C</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
                <span>💧</span>
                <span>Humidity <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{weather.humidity}%</strong></span>
              </div>
              <ChevronRight style={{ width: 16, height: 16, color: '#94a3b8' }} />
            </div>
          </div>
        )}
      </motion.div>

      {/* ── MAJOR AIR POLLUTANTS (Slate Glass Cards) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0, fontFamily: 'var(--font-sans)' }}>
              Major Air Pollutants
            </h2>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
              Interact with cards to explore detailed sensor metrics, health impacts, and guidelines
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { key: 'pm25', name: 'PM2.5', sub: 'Particulate Matter 2.5', unit: 'µg/m³', icon: '🌫️' },
            { key: 'pm10', name: 'PM10', sub: 'Particulate Matter 10', unit: 'µg/m³', icon: '☁️' },
            { key: 'co', name: 'CO', sub: 'Carbon Monoxide', unit: 'mg/m³', icon: '💨' },
            { key: 'no2', name: 'NO2', sub: 'Nitrogen Dioxide', unit: 'µg/m³', icon: '🏭' },
            { key: 'o3', name: 'Ozone', sub: 'Ground-level Ozone', unit: 'µg/m³', icon: '☀️' },
          ].map(({ key, name, unit, icon }, i) => {
            const p = pollutants?.[key];
            if (!p) return null;
            const st = POLLUTANT_CARD_STYLE[key] || POLLUTANT_CARD_STYLE.pm25;

            return (
              <motion.div
                key={key}
                custom={i + 1} variants={cardVariants} initial="hidden" animate="visible"
                onClick={() => setActivePollutantModal(key)}
                style={{
                  backgroundColor: st.bg,
                  border: `1px solid ${st.border}`,
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
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    backgroundColor: st.badgeBg,
                    color: st.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, flexShrink: 0,
                  }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', lineHeight: 1.1, color: '#ffffff' }}>
                      {name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 800, marginTop: 4, color: '#ffffff' }}>
                      {p.value} <span style={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}>{unit}</span>
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  backgroundColor: st.badgeBg,
                  color: st.badgeText,
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

      {/* ── NETWORK READINGS TABLE (Slate Container) ── */}
      <motion.div
        custom={7} variants={cardVariants} initial="hidden" animate="visible"
        style={{ marginTop: 8 }}
      >
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
            <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
            Network Readings &amp; Status
          </h2>
        </div>

        <div style={{
          backgroundColor: '#131e2b',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        }}>
          <div style={{ overflowX: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <thead style={{
                position: 'sticky', top: 0, zIndex: 1,
                backgroundColor: '#182638',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <tr>
                  {['Records', 'Last Update', 'AQI', 'Temp (°C)', 'Humidity (%)', 'PM2.5', 'PM10', 'CO', 'NO₂', 'O₃', 'Wind Speed', 'Wind Dir', 'Rain (mm)'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', fontWeight: 700, color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveHistoryLoading ? (
                  <tr>
                    <td colSpan="13" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw style={{ width: 18, height: 18, animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 8, color: '#00bfa5' }} />
                      Loading stream...
                    </td>
                  </tr>
                ) : liveHistory.length === 0 ? (
                  <tr>
                    <td colSpan="13" style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                      No telemetry stream data.
                    </td>
                  </tr>
                ) : (
                  liveHistory.map((row, index) => {
                    const tsDate = row.timestamp ? new Date(row.timestamp) : null;
                    const formattedTime = tsDate && !isNaN(tsDate)
                      ? tsDate.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '21.06.2023 12:56:50';

                    return (
                      <tr
                        key={row.id || index}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: index % 2 === 0 ? '#131e2b' : '#182638',
                        }}
                      >
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#00bfa5' }}>
                          #{index + 1}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {formattedTime}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#ffffff', fontSize: 14 }}>
                          {row.cpcb_aqi || 'N/A'}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.temperature != null ? row.temperature : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.humidity != null ? row.humidity : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.pm25 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.pm10 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.co || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.no2 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.o3 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.wind_speed != null ? row.wind_speed : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.wind_direction != null ? row.wind_direction : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{row.rain_gauge != null ? row.rain_gauge : 'N/A'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* ── Pollutant Detail Modal (Dark Slate) ── */}
      <AnimatePresence>
        {activePollutantModal && activeDetail && (
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
            onClick={() => setActivePollutantModal(null)}
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
                onClick={() => setActivePollutantModal(null)}
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
                    WHO Safe Limit: <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{activeDetail.whoLimit} {activeDetail.unit}</strong>
                  </p>
                </div>
              </div>

              <div style={{
                backgroundColor: '#182638', borderRadius: 14,
                padding: '14px 18px', border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Current Reading</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 900, color: '#ffffff', lineHeight: 1, marginTop: 4 }}>
                    {activePollutantVal != null ? `${activePollutantVal} ${activeDetail.unit}` : 'N/A'}
                  </div>
                </div>

                {activePollutantVal != null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10,
                    backgroundColor: activePollutantVal <= activeDetail.whoLimit ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: activePollutantVal <= activeDetail.whoLimit ? '#4ade80' : '#f87171',
                    fontSize: 12.5, fontWeight: 700,
                  }}>
                    {activePollutantVal <= activeDetail.whoLimit ? (
                      <><CheckCircle2 style={{ width: 14, height: 14 }} /><span>Within Safe Limit</span></>
                    ) : (
                      <><AlertTriangle style={{ width: 14, height: 14 }} /><span>Above WHO Limit</span></>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Info style={{ width: 14, height: 14, color: '#00bfa5' }} />
                    What is {activeDetail.sub}?
                  </h4>
                  <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.description}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <HeartPulse style={{ width: 14, height: 14, color: '#ef4444' }} />
                    Health Impact & Symptoms
                  </h4>
                  <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.healthImpact}
                  </p>
                </div>

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
                          <a href={activeDetail.sensorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#00bfa5', textDecoration: 'none', fontWeight: 600 }}>
                            Product Link <ExternalLink style={{ width: 10, height: 10, display: 'inline' }} />
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
    </div>
  );
}
