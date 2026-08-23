import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Table, RefreshCw, X, CheckCircle2, AlertTriangle, Users, ShieldAlert, Info, HeartPulse, Factory, Cpu, ExternalLink, TrendingUp, Activity, Layers } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { getCloudLatest, getCloudLiveHistory, getCachedData, isSensorOnline, getTimeAgo } from '../api';
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
  pm25: { bg: '#ffffff', border: '#e2e8f0', badgeBg: '#e0f2fe', badgeText: '#0284c7', accent: '#0284c7', whoLimit: 15 },
  pm10: { bg: '#ffffff', border: '#e2e8f0', badgeBg: '#e0e7ff', badgeText: '#4f46e5', accent: '#4f46e5', whoLimit: 45 },
  co:   { bg: '#ffffff', border: '#e2e8f0', badgeBg: '#dcfce7', badgeText: '#16a34a', accent: '#16a34a', whoLimit: 4 },
  no2:  { bg: '#ffffff', border: '#e2e8f0', badgeBg: '#f3e8ff', badgeText: '#9333ea', accent: '#9333ea', whoLimit: 25 },
  o3:   { bg: '#ffffff', border: '#e2e8f0', badgeBg: '#fef3c7', badgeText: '#d97706', accent: '#d97706', whoLimit: 100 },
};

const POLLUTANT_SCALE_CONFIG = {
  pm25: {
    title: 'Particulate Matter 2.5 (PM2.5)',
    max: 250,
    unit: 'µg/m³',
    ticks: ['0', '30', '60', '90', '120', '250', '250+'],
    bands: [
      { label: 'Good', limit: 30, color: '#22c55e' },
      { label: 'Moderate', limit: 60, color: '#eab308' },
      { label: 'Poor', limit: 90, color: '#f97316' },
      { label: 'Unhealthy', limit: 120, color: '#ef4444' },
      { label: 'Severe', limit: 250, color: '#a855f7' },
      { label: 'Hazardous', limit: 300, color: '#f43f5e' },
    ]
  },
  pm10: {
    title: 'Particulate Matter 10 (PM10)',
    max: 430,
    unit: 'µg/m³',
    ticks: ['0', '50', '100', '250', '350', '430', '430+'],
    bands: [
      { label: 'Good', limit: 50, color: '#22c55e' },
      { label: 'Moderate', limit: 100, color: '#eab308' },
      { label: 'Poor', limit: 250, color: '#f97316' },
      { label: 'Unhealthy', limit: 350, color: '#ef4444' },
      { label: 'Severe', limit: 430, color: '#a855f7' },
      { label: 'Hazardous', limit: 500, color: '#f43f5e' },
    ]
  },
  co: {
    title: 'Carbon Monoxide (CO)',
    max: 34,
    unit: 'mg/m³',
    ticks: ['0', '1.0', '2.0', '10', '17', '34', '34+'],
    bands: [
      { label: 'Good', limit: 1.0, color: '#22c55e' },
      { label: 'Moderate', limit: 2.0, color: '#eab308' },
      { label: 'Poor', limit: 10.0, color: '#f97316' },
      { label: 'Unhealthy', limit: 17.0, color: '#ef4444' },
      { label: 'Severe', limit: 34.0, color: '#a855f7' },
      { label: 'Hazardous', limit: 40.0, color: '#f43f5e' },
    ]
  },
  no2: {
    title: 'Nitrogen Dioxide (NO₂)',
    max: 400,
    unit: 'µg/m³',
    ticks: ['0', '40', '80', '180', '280', '400', '400+'],
    bands: [
      { label: 'Good', limit: 40, color: '#22c55e' },
      { label: 'Moderate', limit: 80, color: '#eab308' },
      { label: 'Poor', limit: 180, color: '#f97316' },
      { label: 'Unhealthy', limit: 280, color: '#ef4444' },
      { label: 'Severe', limit: 400, color: '#a855f7' },
      { label: 'Hazardous', limit: 500, color: '#f43f5e' },
    ]
  },
  o3: {
    title: 'Ground-level Ozone (O₃)',
    max: 748,
    unit: 'µg/m³',
    ticks: ['0', '50', '100', '168', '208', '748', '748+'],
    bands: [
      { label: 'Good', limit: 50, color: '#22c55e' },
      { label: 'Moderate', limit: 100, color: '#eab308' },
      { label: 'Poor', limit: 168, color: '#f97316' },
      { label: 'Unhealthy', limit: 208, color: '#ef4444' },
      { label: 'Severe', limit: 748, color: '#a855f7' },
      { label: 'Hazardous', limit: 800, color: '#f43f5e' },
    ]
  }
};

const getParamScalePosition = (val, key) => {
  const cfg = POLLUTANT_SCALE_CONFIG[key];
  if (!cfg || val == null || isNaN(val)) return 0;
  const num = Number(val);
  const bands = cfg.bands;

  if (num <= 0) return 0;

  let prevLimit = 0;
  for (let i = 0; i < bands.length; i++) {
    const bandLimit = bands[i].limit;
    if (num <= bandLimit) {
      const segStart = (i / bands.length) * 100;
      const segEnd = ((i + 1) / bands.length) * 100;
      const range = bandLimit - prevLimit;
      const fraction = range > 0 ? (num - prevLimit) / range : 0;
      return Math.min(Math.max(segStart + fraction * (segEnd - segStart), 0), 100);
    }
    prevLimit = bandLimit;
  }
  return 100;
};

const ParameterScaleBar = ({ paramKey, value, compact = false }) => {
  const cfg = POLLUTANT_SCALE_CONFIG[paramKey];
  if (!cfg) return null;

  const valNum = value != null && value !== 'N/A' && !isNaN(Number(value)) ? Number(value) : 0;
  const pos = getParamScalePosition(valNum, paramKey);

  let activeBand = cfg.bands[0];
  for (let i = 0; i < cfg.bands.length; i++) {
    if (valNum <= cfg.bands[i].limit) {
      activeBand = cfg.bands[i];
      break;
    }
    if (i === cfg.bands.length - 1) activeBand = cfg.bands[i];
  }

  return (
    <div style={{ width: '100%', marginTop: compact ? 8 : 12, marginBottom: compact ? 4 : 12 }}>
      {/* Category Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px', marginBottom: compact ? 3 : 6 }}>
        {cfg.bands.map((b, idx) => (
          <span
            key={idx}
            style={{
              fontSize: compact ? 8.5 : 10.5,
              fontWeight: 700,
              color: b.color,
              lineHeight: 1.1,
            }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Segmented Bar with Circle Indicator */}
      <div style={{ position: 'relative', height: compact ? 8 : 12, borderRadius: 999, backgroundColor: '#e2e8f0', marginBottom: compact ? 3 : 6 }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: 999,
          background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 16.66%, #eab308 16.66%, #eab308 33.33%, #f97316 33.33%, #f97316 50%, #ef4444 50%, #ef4444 66.66%, #a855f7 66.66%, #a855f7 83.33%, #f43f5e 83.33%, #f43f5e 100%)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
        }} />

        <div style={{
          position: 'absolute',
          top: '50%',
          left: `${pos}%`,
          transform: 'translate(-50%, -50%)',
          width: compact ? 14 : 20,
          height: compact ? 14 : 20,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          border: `${compact ? 2.5 : 3}px solid ${activeBand.color}`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          zIndex: 3,
          transition: 'left 0.35s ease, border-color 0.3s ease',
        }} />
      </div>

      {/* Numeric Ticks */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
        {cfg.ticks.map((t, idx) => (
          <span key={idx} style={{ fontSize: compact ? 8 : 9.5, fontWeight: 600, color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
};

const computeInitialDashboardData = (cloud) => {
  if (!cloud) return null;
  const fmt = (val, decimals = 2) => val != null ? Number(val).toFixed(decimals) : 'N/A';
  const fmtSmart = (val, d = 1) => val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : 'N/A';
  return {
    location: { name: 'SMVITM Station Node', country: 'IN' },
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
};

export default function Dashboard({ cloudData, cloudLoading, cloudError, onDataLoad, refreshKey, selectedStation = 'station-1' }) {
  const [data, setData] = useState(() => selectedStation === 'station-1' ? computeInitialDashboardData(cloudData) : null);
  const [loading, setLoading] = useState(() => selectedStation === 'station-1' && !cloudData);
  const [error, setError] = useState(null);
  const [activePollutantModal, setActivePollutantModal] = useState(null);
  const [heroScaleTab, setHeroScaleTab] = useState('aqi');

  const [liveHistory, setLiveHistory] = useState(() => {
    if (selectedStation !== 'station-1') return [];
    return getCachedData('CACHE_AQI_LIVE_HISTORY') || [];
  });
  const [liveHistoryLoading, setLiveHistoryLoading] = useState(() => {
    if (selectedStation !== 'station-1') return false;
    return (getCachedData('CACHE_AQI_LIVE_HISTORY') || []).length === 0;
  });
  const [visiblePollutants, setVisiblePollutants] = useState({
    pm25: true,
    pm10: true,
    co: true,
    no2: true,
    o3: true,
  });

  const togglePollutant = (key) => {
    setVisiblePollutants(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const latestRow = liveHistory?.[0];
  const latestTimestamp = latestRow?.timestamp || data?.timestamp;
  const isOnline = selectedStation === 'station-1' && isSensorOnline(latestTimestamp, 5);
  const timeAgoStr = getTimeAgo(latestTimestamp);

  const latestTableTime = useMemo(() => {
    if (!latestTimestamp) return 'N/A';
    const dt = new Date(latestTimestamp);
    if (isNaN(dt.getTime())) return String(latestTimestamp);

    const now = new Date();
    const isToday = dt.getDate() === now.getDate() &&
                    dt.getMonth() === now.getMonth() &&
                    dt.getFullYear() === now.getFullYear();

    const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).toLowerCase();
    
    if (isToday) {
      return timeStr;
    }
    const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return `${dateStr}, ${timeStr}`;
  }, [latestTimestamp]);

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
        fullTime: dt && !isNaN(dt) ? dt.toLocaleString('en-IN') : 'N/A',
        cpcb_aqi: row.cpcb_aqi != null && !isNaN(Number(row.cpcb_aqi)) ? Number(row.cpcb_aqi) : 0,
        pm25: row.pm25 != null && !isNaN(Number(row.pm25)) ? Number(row.pm25) : 0,
        pm10: row.pm10 != null && !isNaN(Number(row.pm10)) ? Number(row.pm10) : 0,
        co: row.co != null && !isNaN(Number(row.co)) ? Number(row.co) : 0,
        no2: row.no2 != null && !isNaN(Number(row.no2)) ? Number(row.no2) : 0,
        o3: row.o3 != null && !isNaN(Number(row.o3)) ? Number(row.o3) : 0,
      };
    });
  }, [liveHistory]);

  const chart15MinTicks = useMemo(() => {
    if (!liveHistoryChartData || liveHistoryChartData.length === 0) return undefined;
    const ticks = [];
    let lastTimeMs = -Infinity;
    const gapMs = 15 * 60 * 1000; // 15 mins gap

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

  const fmt = (val, decimals = 2) => val != null ? Number(val).toFixed(decimals) : 'N/A';
  const fmtSmart = (val, d = 1) => val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : 'N/A';

  useEffect(() => {
    let isMounted = true;

    if (selectedStation !== 'station-1') {
      setLiveHistory([]);
      setLiveHistoryLoading(false);
      const nullData = {
        location: { name: `Station Node (${selectedStation.toUpperCase()})`, country: 'IN' },
        aqi: {
          value: 'N/A',
          label: 'Standby / No Data',
          color: '#94a3b8',
        },
        pollutants: {
          pm25: { value: 'N/A' },
          pm10: { value: 'N/A' },
          co:   { value: 'N/A' },
          no2:  { value: 'N/A' },
          o3:   { value: 'N/A' },
        },
        weather: {
          temperature:     'N/A',
          humidity:        'N/A',
          wind_speed:      'N/A',
          wind_direction:  'N/A',
          rain_gauge:      'N/A',
        },
        dominant_pollutant: 'N/A',
        timestamp: null,
      };
      setData(nullData);
      if (onDataLoad) onDataLoad(nullData.location);
      setLoading(false);
      setError(null);
      return;
    }

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
        location: { name: 'SMVITM Station Node', country: 'IN' },
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
          location: { name: 'SMVITM Station Node', country: 'IN' },
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
  }, [cloudData, cloudError, refreshKey, selectedStation]);

  if (selectedStation !== 'station-1') {
    return (
      <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 24,
            padding: '48px 56px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            maxWidth: 380,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 4 }}>⚠️</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', margin: 0, fontFamily: 'var(--font-sans)' }}>
            Sensor Offline
          </h3>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0, fontFamily: 'var(--font-sans)' }}>
            No sensor data available.
          </p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#00bfa5',
          animation: 'spin 0.9s linear infinite',
        }} />
        <p style={{ fontSize: 14, color: '#64748b', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Loading air quality telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '40px 20px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 40, textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)' }}>
          <AlertCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>Data Unavailable</h3>
          <p style={{ color: '#64748b', fontSize: 14 }}>{error || 'Could not load AQI data.'}</p>
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
              <strong style={{ color: '#0f172a' }}>Station Standby Mode:</strong> This monitoring station node is un-developed / pending deployment. All telemetry values are displayed as <span style={{ color: '#00bfa5', fontWeight: 700 }}>null / N/A</span> on the standard station interface.
            </span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999, backgroundColor: '#f1f5f9', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            UN-DEVELOPED NODE
          </span>
        </motion.div>
      )}

      {/* ── Offline Hardware Notice Banner ── */}
      {selectedStation === 'station-1' && !isOnline && latestTimestamp && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: '#fff7ed',
            border: '1px solid #ffedd5',
            borderLeft: '4px solid #ea580c',
            borderRadius: 16,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 2px 10px rgba(234, 88, 12, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#ea580c', flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: '#475569', fontWeight: 600 }}>
              <strong style={{ color: '#9a3412' }}>AQI Sensor Node Offline:</strong> No new live telemetry received in cloud for &gt;5 mins (Last update: <span style={{ color: '#ea580c', fontWeight: 700 }}>{latestTableTime} • {timeAgoStr}</span>). Showing last recorded cloud values below.
            </span>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 999, backgroundColor: '#ffedd5', color: '#c2410c', fontFamily: 'var(--font-mono)' }}>
            OFFLINE ({timeAgoStr.toUpperCase()})
          </span>
        </motion.div>
      )}

      {/* ── Page Header Titles ── */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-sans)', letterSpacing: '-0.02em', margin: 0 }}>
          Real-time Air Quality Index
        </h1>
        <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 6, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>Last Updated: <span style={{ color: selectedStation === 'station-1' && !isOnline ? '#ea580c' : '#00bfa5', fontWeight: 600 }}>{selectedStation === 'station-1' ? latestTableTime : 'N/A (Station Standby)'}</span></span>
          {selectedStation === 'station-1' && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              backgroundColor: isOnline ? '#ecfdf5' : '#fff7ed',
              color: isOnline ? '#059669' : '#ea580c',
              border: `1px solid ${isOnline ? '#a7f3d0' : '#fed7aa'}`
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isOnline ? '#10b981' : '#f97316' }} />
              {isOnline ? 'LIVE' : `OFFLINE (${timeAgoStr})`}
            </span>
          )}
        </div>
      </motion.div>

      {/* ── HERO AQI CARD ── */}
      <motion.div
        custom={0} variants={cardVariants} initial="hidden" animate="visible"
        style={{
          backgroundColor: aqiColor === '#22c55e' ? '#f0fdf4' :
                           aqiColor === '#eab308' ? '#fefce8' :
                           aqiColor === '#f97316' ? '#fff7ed' :
                           aqiColor === '#ef4444' ? '#fef2f2' :
                           aqiColor === '#a855f7' ? '#faf5ff' : '#fff1f2',
          borderRadius: 24,
          padding: '28px 32px',
          color: '#0f172a',
          border: `1.5px solid ${aqiColor}40`,
          boxShadow: `0 8px 30px ${aqiColor}15, 0 1px 3px rgba(15,23,42,0.04)`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
          transition: 'background-color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 6, backgroundColor: aqiColor }} />

        {/* Left Side */}
        <div style={{ flex: 1, minWidth: 280, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isOnline ? '#22c55e' : '#f97316', display: 'inline-block' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isOnline ? 'Status Panel • Live' : `Status Panel • Offline (${timeAgoStr})`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 72, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: '#0f172a' }}>
                {aqiValue}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                {isOnline ? 'LIVE AQI' : 'LAST RECORDED AQI'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Air Quality is</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '6px 18px', borderRadius: 999,
                backgroundColor: '#ffffff',
                border: `1.5px solid ${aqiColor}50`,
                color: '#0f172a', fontSize: 16, fontWeight: 800,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: aqiColor }} />
                <span>{aqiLabel}</span>
              </div>
            </div>
          </div>

          {/* Overall AQI Scale Bar */}
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
                <span key={item.label} style={{ fontSize: 10.5, fontWeight: 700, color: item.color }}>{item.label}</span>
              ))}
            </div>

            <div style={{ position: 'relative', height: 12, borderRadius: 999, backgroundColor: '#e2e8f0', marginBottom: 6 }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: 999,
                background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 16.66%, #eab308 16.66%, #eab308 33.33%, #f97316 33.33%, #f97316 50%, #ef4444 50%, #ef4444 66.66%, #a855f7 66.66%, #a855f7 83.33%, #f43f5e 83.33%, #f43f5e 100%)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${scalePosition}%`,
                transform: 'translate(-50%, -50%)',
                width: 20, height: 20, borderRadius: '50%',
                backgroundColor: '#ffffff', border: `3px solid ${aqiColor}`,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                zIndex: 3,
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
              {['0', '50', '100', '150', '200', '300', '301+'].map((num) => (
                <span key={num} style={{ fontSize: 9.5, fontWeight: 600, color: '#64748b', fontFamily: 'var(--font-mono)' }}>{num}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Weather Widget */}
        {weather && (
          <div
            style={{
              flex: '0 0 auto',
              width: 230,
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 20,
              padding: '20px 22px',
              position: 'relative',
              zIndex: 1,
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 32 }}>🌤️</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: weather?.temperature === 'N/A' ? 26 : 34, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                  {weather?.temperature ?? 'N/A'}
                </span>
                {weather?.temperature !== 'N/A' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#64748b' }}>°C</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                <span>💧</span>
                <span>Humidity <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{weather?.humidity !== 'N/A' ? `${weather?.humidity}%` : 'N/A'}</strong></span>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── MAJOR AIR POLLUTANTS (Cool Light Theme Cards - No Overflow Bug) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, fontFamily: 'var(--font-sans)' }}>
              Major Air Pollutants
            </h2>
            <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              Click any pollutant card for WHO safety limits, health impacts, and sensor specs
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 14 }}>
          {[
            { key: 'pm25', name: 'PM2.5', sub: 'Particulate Matter 2.5', unit: 'µg/m³', icon: '🌫️' },
            { key: 'pm10', name: 'PM10', sub: 'Particulate Matter 10', unit: 'µg/m³', icon: '☁️' },
            { key: 'co', name: 'CO', sub: 'Carbon Monoxide', unit: 'mg/m³', icon: '💨' },
            { key: 'no2', name: 'NO2', sub: 'Nitrogen Dioxide', unit: 'µg/m³', icon: '🏭' },
            { key: 'o3', name: 'Ozone', sub: 'Ground-level Ozone', unit: 'µg/m³', icon: '☀️' },
          ].map(({ key, name, sub, unit, icon }, i) => {
            const p = pollutants?.[key];
            if (!p) return null;
            const st = POLLUTANT_CARD_STYLE[key] || POLLUTANT_CARD_STYLE.pm25;
            const valNum = p.value !== 'N/A' ? Number(p.value) : null;
            const isSafe = valNum != null ? valNum <= st.whoLimit : true;

            return (
              <motion.div
                key={key}
                custom={i + 1} variants={cardVariants} initial="hidden" animate="visible"
                onClick={() => {
                  setHeroScaleTab(key);
                  setActivePollutantModal(key);
                }}
                style={{
                  backgroundColor: '#ffffff',
                  border: `1px solid ${heroScaleTab === key ? '#00bfa5' : '#e2e8f0'}`,
                  borderRadius: 20,
                  padding: '18px 18px',
                  color: '#0f172a',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  cursor: 'pointer',
                  boxShadow: heroScaleTab === key ? '0 4px 20px rgba(0, 191, 165, 0.15)' : '0 4px 16px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                whileHover={{ scale: 1.02, y: -3, borderColor: '#00bfa5' }}
              >
                {/* Top Row: Icon + Name on left, Info Icon Button on top right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      backgroundColor: st.badgeBg,
                      color: st.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', color: '#0f172a', lineHeight: 1.1 }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, whiteSpace: 'nowrap' }}>
                        WHO: ≤{st.whoLimit}
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

                {/* Middle Row: Monospace Value + Status Tag */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', marginTop: 2 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 800, color: st.accent, lineHeight: 1 }}>
                      {p.value}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      {unit}
                    </div>
                  </div>

                  <div style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    backgroundColor: isSafe ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${isSafe ? '#bbf7d0' : '#fecaca'}`,
                    color: isSafe ? '#15803d' : '#b91c1c',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isSafe ? '#16a34a' : '#dc2626' }} />
                    <span>{isSafe ? 'Normal' : 'High'}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── VISUALIZATIONS SECTION (AQI Lineplot & AQI Parameters Comparison Lineplot) ── */}
      <motion.div
        custom={6.5} variants={cardVariants} initial="hidden" animate="visible"
        style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
            <TrendingUp style={{ width: 20, height: 20, color: '#00bfa5' }} />
            Air Quality Visualizations
          </h2>
        </div>

        {/* Responsive Grid for both Line plots */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 20 }}>

          {/* 1. AQI Lineplot Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity style={{ width: 16, height: 16, color: '#00bfa5' }} />
                  AQI Line Plot
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  Real-time Air Quality Index progression
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
                Current: {aqiValue}
              </div>
            </div>

            <div style={{ width: '100%', height: 280, minWidth: 0 }}>
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
                      <linearGradient id="aqiGrad" x1="0" y1="0" x2="0" y2="1">
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
                        const col = getAqiColor(val);
                        return (
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}>
                            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>{d.fullTime}</div>
                            <div style={{ fontWeight: 800, fontSize: 18, color: col }}>
                              AQI: {val}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Area type="monotone" dataKey="cpcb_aqi" name="AQI" stroke="#00bfa5" strokeWidth={2.5} fillOpacity={1} fill="url(#aqiGrad)" dot={{ r: 2, fill: '#00bfa5' }} activeDot={{ r: 5, fill: '#00bfa5', stroke: '#ffffff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 2. AQI Pollutants Comparison Lineplot Card */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers style={{ width: 16, height: 16, color: '#0284c7' }} />
                  AQI Parameters Comparison
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                  All AQI pollutants on a single graph (excl. temp, humidity, wind & rain)
                </div>
              </div>
            </div>

            {/* Pollutant Filter Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { key: 'pm25', label: 'PM2.5', color: '#0284c7' },
                { key: 'pm10', label: 'PM10', color: '#6366f1' },
                { key: 'co',   label: 'CO',   color: '#64748b' },
                { key: 'no2',  label: 'NO₂',  color: '#9333ea' },
                { key: 'o3',   label: 'O₃',   color: '#d97706' },
              ].map((p) => {
                const active = visiblePollutants[p.key];
                return (
                  <button
                    key={p.key}
                    onClick={() => togglePollutant(p.key)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${active ? p.color : '#e2e8f0'}`,
                      backgroundColor: active ? `${p.color}15` : '#f8fafc',
                      color: active ? p.color : '#94a3b8',
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: active ? p.color : '#cbd5e1' }} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div style={{ width: '100%', height: 280, minWidth: 0 }}>
              {liveHistoryLoading ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                  <RefreshCw style={{ width: 16, height: 16, animation: 'spin 1s linear infinite', marginRight: 8, color: '#00bfa5' }} />
                  Loading comparison graph...
                </div>
              ) : liveHistoryChartData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>
                  No telemetry stream available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={liveHistoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
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
                    <YAxis stroke="#94a3b8" fontSize={10} tick={{ fill: '#64748b' }} />
                    <Tooltip content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 10px 25px rgba(15,23,42,0.12)' }}>
                            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>{d.fullTime}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                              {visiblePollutants.pm25 && <div style={{ color: '#0284c7', fontWeight: 600 }}>PM2.5: {d.pm25} <span style={{ fontSize: 10, color: '#64748b' }}>µg/m³</span></div>}
                              {visiblePollutants.pm10 && <div style={{ color: '#6366f1', fontWeight: 600 }}>PM10: {d.pm10} <span style={{ fontSize: 10, color: '#64748b' }}>µg/m³</span></div>}
                              {visiblePollutants.co   && <div style={{ color: '#64748b', fontWeight: 600 }}>CO: {d.co} <span style={{ fontSize: 10, color: '#64748b' }}>mg/m³</span></div>}
                              {visiblePollutants.no2  && <div style={{ color: '#9333ea', fontWeight: 600 }}>NO₂: {d.no2} <span style={{ fontSize: 10, color: '#64748b' }}>µg/m³</span></div>}
                              {visiblePollutants.o3   && <div style={{ color: '#d97706', fontWeight: 600 }}>O₃: {d.o3} <span style={{ fontSize: 10, color: '#64748b' }}>µg/m³</span></div>}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    {visiblePollutants.pm25 && <Line type="monotone" dataKey="pm25" name="PM2.5" stroke="#0284c7" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                    {visiblePollutants.pm10 && <Line type="monotone" dataKey="pm10" name="PM10" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                    {visiblePollutants.co   && <Line type="monotone" dataKey="co"   name="CO"   stroke="#64748b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                    {visiblePollutants.no2  && <Line type="monotone" dataKey="no2"  name="NO₂"  stroke="#9333ea" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                    {visiblePollutants.o3   && <Line type="monotone" dataKey="o3"   name="O₃"   stroke="#d97706" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

        </div>
      </motion.div>

      {/* ── NETWORK READINGS TABLE (Light Slate Container) ── */}
      <motion.div
        custom={7} variants={cardVariants} initial="hidden" animate="visible"
        style={{ marginTop: 8 }}
      >
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)' }}>
            <Table style={{ width: 18, height: 18, color: '#00bfa5' }} />
            Network Readings &amp; Status
          </h2>
        </div>

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
        }}>
          <div style={{ overflowX: 'auto', maxHeight: 420 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              <thead style={{
                position: 'sticky', top: 0, zIndex: 1,
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}>
                <tr>
                  {['Records', 'Last Update', 'AQI', 'Temp (°C)', 'Humidity (%)', 'PM2.5', 'PM10', 'CO', 'NO₂', 'O₃'].map((h) => (
                    <th key={h} style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveHistoryLoading ? (
                  <tr>
                    <td colSpan="10" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw style={{ width: 18, height: 18, animation: 'spin 1s linear infinite', display: 'inline-block', marginRight: 8, color: '#00bfa5' }} />
                      Loading stream...
                    </td>
                  </tr>
                ) : liveHistory.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
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
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                        }}
                      >
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#00bfa5' }}>
                          #{index + 1}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                          {formattedTime}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                          {row.cpcb_aqi || 'N/A'}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.temperature != null ? row.temperature : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.humidity != null ? row.humidity : 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm25 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.pm10 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.co || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.no2 || 'N/A'}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'var(--font-mono)', color: '#334155' }}>{row.o3 || 'N/A'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* ── Pollutant Detail Modal (Cool Light Theme) ── */}
      <AnimatePresence>
        {activePollutantModal && activeDetail && (
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
            onClick={() => setActivePollutantModal(null)}
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
                onClick={() => setActivePollutantModal(null)}
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
                    WHO Safe Limit: <strong style={{ color: '#00bfa5', fontFamily: 'var(--font-mono)' }}>{activeDetail.whoLimit} {activeDetail.unit}</strong>
                  </p>
                </div>
              </div>

              <div style={{
                backgroundColor: '#f8fafc', borderRadius: 14,
                padding: '14px 18px', border: '1px solid #e2e8f0',
                marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Current Reading</span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginTop: 4 }}>
                    {activePollutantVal != null ? `${activePollutantVal} ${activeDetail.unit}` : 'N/A'}
                  </div>
                </div>

                {activePollutantVal != null && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10,
                    backgroundColor: activePollutantVal <= activeDetail.whoLimit ? '#dcfce7' : '#fee2e2',
                    color: activePollutantVal <= activeDetail.whoLimit ? '#15803d' : '#b91c1c',
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

              {/* Parameter Concentration Scale Bar */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: 16,
                padding: '16px 20px',
                border: '1px solid #e2e8f0',
                marginBottom: 22,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
                    {activeDetail.sub} Concentration Scale
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#00bfa5' }}>
                    Real-time Level
                  </span>
                </div>
                <ParameterScaleBar paramKey={activePollutantModal} value={activePollutantVal} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <Info style={{ width: 14, height: 14, color: '#00bfa5' }} />
                    What is {activeDetail.sub}?
                  </h4>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.description}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <HeartPulse style={{ width: 14, height: 14, color: '#ef4444' }} />
                    Health Impact & Symptoms
                  </h4>
                  <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                    {activeDetail.healthImpact}
                  </p>
                </div>

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
                          <a href={activeDetail.sensorUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: '#00bfa5', textDecoration: 'none', fontWeight: 600 }}>
                            Product Link <ExternalLink style={{ width: 10, height: 10, display: 'inline' }} />
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
    </div>
  );
}
