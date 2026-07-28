
import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Navigation, Info, X, ShieldAlert, HeartPulse, Factory, CheckCircle2, AlertTriangle, Users, ChevronRight, ArrowRight, Cpu, Radio, Zap, ExternalLink } from 'lucide-react';
import { getCloudLatest } from '../api';
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
    sensorWorking: 'Uses Sensirion’s innovative optical laser scattering technology combined with advanced contamination-resistance algorithms. An internal fan draws ambient air through the optical chamber to accurately count and measure fine PM2.5 particles from 0 to 1000 µg/m³ with a >10 year lifespan.',
    sensorSpecs: 'Range: 0 – 1000 µg/m³ | Voltage: 4.5V – 5.5V | Interface: I2C & UART | Lifetime: >10 Years'
  },
  pm10: {
    name: 'Particulate Matter 10',
    sub: 'PM10',
    unit: 'µg/m³',
    icon: '☁️',
    whoLimit: 45,
    color: '#0284c7',
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
    color: '#64748b',
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
    color: '#a855f7',
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
    color: '#f59e0b',
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

export default function Dashboard({ cloudData, cloudLoading, cloudError, onDataLoad, refreshKey, onNavigateToWeather }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePollutantModal, setActivePollutantModal] = useState(null);

  const fmt = (val, decimals = 2) =>
    val != null ? Number(val).toFixed(decimals) : 'N/A';

  const fmtSmart = (val, d = 1) =>
    val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : 'N/A';

  useEffect(() => {
    let isMounted = true;
    if (cloudData) {
      const cloud = cloudData;
      const combined = {
        location: { name: 'Sensor Station', country: 'IN' },
        aqi: {
          value: cloud?.cpcb_aqi ?? 'N/A',
          label: cloud?.aqi_info?.label ?? 'N/A',
          color: cloud?.aqi_info?.color ?? '#aaa',
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
            color: cloud?.aqi_info?.color ?? '#aaa',
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
        console.error('Failed to fetch Supabase cloud data:', err);
        setError('Unable to fetch sensor data from cloud.');
        setLoading(false);
      });

    return () => { isMounted = false; };
  }, [cloudData, cloudError, refreshKey]);

  if (loading) {
    return (
      <div className="app-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw style={{ width: 32, height: 32, color: 'var(--primary)', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>Loading air quality data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="app-container" style={{ padding: '60px 20px' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <AlertCircle style={{ width: 40, height: 40, color: '#ef4444', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Data Unavailable</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{error || 'Could not load AQI data.'}</p>
        </div>
      </div>
    );
  }

  const { location, aqi, pollutants, weather } = data;
  const aqiValue = aqi.value || 0;
  const aqiLabel = aqi.label || 'Good';

  const scalePosition = Math.min((aqiValue / 500) * 100, 100);

  const getAqiColor = (val) => {
    if (val <= 50) return '#22c55e';
    if (val <= 100) return '#f59e0b';
    if (val <= 200) return '#f97316';
    if (val <= 300) return '#ef4444';
    if (val <= 400) return '#a855f7';
    return '#ec4899';
  };

  const aqiColor = getAqiColor(aqiValue);

  const activeDetail = activePollutantModal ? POLLUTANT_DETAILS[activePollutantModal] : null;
  const activePollutantVal = activePollutantModal && pollutants?.[activePollutantModal]?.value !== 'N/A'
    ? Number(pollutants[activePollutantModal].value)
    : null;

  const isFresh = (() => {
    if (!cloudData || cloudError) return false;
    const ts = cloudData.timestamp;
    if (!ts) return false;
    const dataAge = Date.now() - new Date(ts).getTime();
    return dataAge < 2 * 60 * 1000; 
  })();
  const isOnline = isFresh;
  const statusColor = isOnline ? '#22c55e' : '#ef4444';
  const statusText = isOnline ? 'Live AQI' : 'Offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
        Real-time Air Quality Index (AQI)
      </h1>

      <div className="card" style={{
        padding: 0, overflow: 'hidden', position: 'relative',
        marginTop: 12, minHeight: 280,
      }}>
        
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 90,
          background: 'linear-gradient(180deg, rgba(74, 222, 128, 0) 0%, rgba(74, 222, 128, 0.15) 40%, rgba(34, 197, 94, 0.25) 100%)',
          zIndex: 0,
        }}>
          <svg viewBox="0 0 960 80" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
            <path d="M0 80 L0 50 L30 50 L30 35 L45 35 L45 50 L80 50 L80 30 L95 25 L110 30 L110 50 L140 50 L140 40 L160 40 L160 50 L200 50 L200 20 L210 15 L220 20 L220 50 L260 55 L300 50 L300 35 L315 30 L330 35 L330 50 L370 50 L370 45 L390 45 L390 50 L430 50 L430 25 L445 20 L460 25 L460 50 L500 50 L500 40 L520 40 L520 50 L560 55 L600 50 L600 30 L615 25 L630 30 L630 50 L670 50 L670 45 L690 45 L690 50 L730 50 L730 35 L745 30 L760 35 L760 50 L800 50 L800 40 L820 40 L820 50 L860 50 L860 25 L875 20 L890 25 L890 50 L930 50 L930 45 L960 45 L960 80 Z"
              fill="rgba(34, 197, 94, 0.18)" />
          </svg>
        </div>

        <div style={{ padding: '28px 32px 24px', display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative', zIndex: 1 }}>
          
          <div style={{ flex: '1 1 auto', minWidth: 280 }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor,
                display: 'inline-block', boxShadow: `0 0 6px ${statusColor}`,
                animation: isOnline ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusText}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 16 }}>
              
              <div>
                <div style={{
                  fontSize: 64, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}>
                  {aqiValue}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginTop: 2 }}>
                  AQI (IN)
                </div>
              </div>

              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, fontWeight: 600, textAlign: 'center' }}>
                  Air Quality is
                </div>
                <div style={{
                  padding: '8px 24px', borderRadius: 14,
                  backgroundColor: `${aqiColor}22`,
                  border: `1px solid ${aqiColor}55`,
                  color: aqiColor, fontSize: 18, fontWeight: 800,
                  textAlign: 'center', minWidth: 110,
                }}>
                  {aqiLabel}
                </div>
              </div>
            </div>

            <div style={{ maxWidth: 320 }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                {['Good', 'Moderate', 'Poor', 'Unhealthy', 'Severe', 'Hazardous'].map((label) => (
                  <span key={label} style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                ))}
              </div>

              <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'visible', marginBottom: 6 }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #22c55e 0%, #22c55e 10%, #f59e0b 10%, #f59e0b 20%, #f97316 20%, #f97316 40%, #ef4444 40%, #ef4444 60%, #a855f7 60%, #a855f7 80%, #ec4899 80%, #ec4899 100%)',
                }} />

                <div style={{
                  position: 'absolute', top: '50%', left: `${scalePosition}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 14, height: 14, borderRadius: '50%',
                  backgroundColor: '#fff', border: `3px solid ${aqiColor}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  transition: 'left 0.6s ease',
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {['0', '50', '100', '200', '300', '400', '500+'].map((num) => (
                  <span key={num} style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>{num}</span>
                ))}
              </div>
            </div>
          </div>

          {weather && (
            <div style={{
              flex: '0 0 auto', width: 290,
              background: 'linear-gradient(135deg, #f0fdf4 0%, #e6f4ea 100%)',
              border: '1px solid #bbf7d0',
              borderRadius: 24, padding: '22px 24px 18px',
              position: 'relative',
              boxShadow: '0 8px 24px rgba(34, 197, 94, 0.08), 0 2px 6px rgba(0,0,0,0.02)',
            }}>
              
              <button
                onClick={onNavigateToWeather}
                title="View Weather Details"
                style={{
                  position: 'absolute', top: 20, right: 20,
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: '#273444',
                  border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(39, 52, 68, 0.2)',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <Navigation style={{ width: 15, height: 15, color: '#ffffff', transform: 'rotate(45deg)' }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span style={{ fontSize: 32 }}>🌤️</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span style={{ fontSize: 38, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>
                    {weather.temperature ?? 0}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>°c</span>
                </div>
              </div>

              <div style={{ height: 1, background: '#cbd5e1', marginBottom: 14, marginHorizontal: -4 }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 18, color: '#0284c7' }}>💧</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Humidity</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{weather.humidity} %</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Major Air Pollutants
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
              Click any card to inspect health impacts, sources & WHO guidelines
            </p>
          </div>
          <button
            onClick={() => setActivePollutantModal('pm25')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              backgroundColor: '#f0f9ff', border: '1px solid #bae6fd',
              color: '#0284c7', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e0f2fe';
              const arrow = e.currentTarget.querySelector('.guide-arrow');
              if (arrow) arrow.style.transform = 'translateX(3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f9ff';
              const arrow = e.currentTarget.querySelector('.guide-arrow');
              if (arrow) arrow.style.transform = 'translateX(0)';
            }}
          >
            <Info style={{ width: 14, height: 14 }} />
            <span>Parameter Guide</span>
            <ArrowRight className="guide-arrow" style={{ width: 13, height: 13, transition: 'transform 0.2s ease' }} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { key: 'pm25', name: 'Particulate Matter', sub: '(PM2.5)', unit: 'µg/m³', icon: '🌫️' },
            { key: 'pm10', name: 'Particulate Matter', sub: '(PM10)', unit: 'µg/m³', icon: '☁️' },
            { key: 'co', name: 'Carbon Monoxide', sub: '(CO)', unit: 'mg/m³', icon: '💨' },
            { key: 'no2', name: 'Nitrogen Dioxide', sub: '(NO₂)', unit: 'µg/m³', icon: '🏭' },
            { key: 'o3', name: 'Ozone', sub: '(O₃)', unit: 'µg/m³', icon: '☀️' },
          ].map(({ key, name, sub, unit, icon }) => {
            const p = pollutants?.[key];
            if (!p) return null;
            return (
              <div
                key={key}
                onClick={() => setActivePollutantModal(key)}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #38bdf8',
                  borderRadius: 18,
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(56, 189, 248, 0.2)';
                  const arr = e.currentTarget.querySelector('.pollutant-arrow');
                  if (arr) arr.style.transform = 'translateX(4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.02)';
                  const arr = e.currentTarget.querySelector('.pollutant-arrow');
                  if (arr) arr.style.transform = 'translateX(0)';
                }}
              >
                
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: '#f0f9ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  flexShrink: 0,
                }}>
                  {icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                    {name}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: '#64748b', marginTop: 2 }}>
                    {sub}
                  </div>
                  {(key === 'pm25' || key === 'pm10') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <img src="/sensirion_sps30.png" alt="SPS30" style={{ width: 16, height: 14, objectFit: 'contain', borderRadius: 2 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0284c7' }}>Sensirion SPS30</span>
                    </div>
                  )}
                  {key === 'co' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <img src="/co_sensor.png" alt="ZE07-CO" style={{ width: 16, height: 14, objectFit: 'contain', borderRadius: 2 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#475569' }}>Winsen ZE07-CO</span>
                    </div>
                  )}
                  {key === 'no2' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <img src="/no2_sensor.png" alt="MEMS NO2" style={{ width: 16, height: 14, objectFit: 'contain', borderRadius: 2 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9333ea' }}>Fermion MEMS NO2</span>
                    </div>
                  )}
                  {key === 'o3' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <img src="/mq131_sensor.png" alt="MQ-131" style={{ width: 16, height: 14, objectFit: 'contain', borderRadius: 2 }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#d97706' }}>MQ-131 Sensor</span>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                    {p.value}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8', marginTop: 4 }}>
                    {unit}
                  </div>
                </div>

                <div
                  className="pollutant-arrow"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    flexShrink: 0,
                    transition: 'transform 0.2s ease, background-color 0.2s ease',
                  }}
                  title="Click for parameter details"
                >
                  <ChevronRight style={{ width: 16, height: 16 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activePollutantModal && activeDetail && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999, padding: 20,
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={() => setActivePollutantModal(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 24,
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px 32px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              position: 'relative',
              animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            
            <button
              onClick={() => setActivePollutantModal(null)}
              style={{
                position: 'absolute', top: 24, right: 24,
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: '#f1f5f9', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background-color 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            >
              <X style={{ width: 18, height: 18, color: '#475569' }} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 18,
                backgroundColor: `${activeDetail.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
              }}>
                {activeDetail.icon}
              </div>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  {activeDetail.name} ({activeDetail.sub})
                </h3>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, margin: 0 }}>
                  WHO Safe Limit: <strong style={{ color: '#0f172a' }}>{activeDetail.whoLimit} {activeDetail.unit}</strong>
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc', borderRadius: 16,
              padding: '16px 20px', border: '1px solid #e2e8f0',
              marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
            }}>
              <div>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Current Reading</span>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1, marginTop: 4 }}>
                  {activePollutantVal != null ? `${activePollutantVal} ${activeDetail.unit}` : 'N/A'}
                </div>
              </div>

              {activePollutantVal != null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 12,
                  backgroundColor: activePollutantVal <= activeDetail.whoLimit ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${activePollutantVal <= activeDetail.whoLimit ? '#bbf7d0' : '#fecaca'}`,
                  color: activePollutantVal <= activeDetail.whoLimit ? '#166534' : '#991b1b',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {activePollutantVal <= activeDetail.whoLimit ? (
                    <>
                      <CheckCircle2 style={{ width: 16, height: 16 }} />
                      <span>Within WHO Safe Limit</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle style={{ width: 16, height: 16 }} />
                      <span>{Math.round(((activePollutantVal / activeDetail.whoLimit) - 1) * 100)}% Above WHO Limit</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Info style={{ width: 16, height: 16, color: '#0284c7' }} />
                  What is {activeDetail.sub}?
                </h4>
                <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {activeDetail.description}
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <HeartPulse style={{ width: 16, height: 16, color: '#ef4444' }} />
                  Health Impact & Symptoms
                </h4>
                <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, margin: 0 }}>
                  {activeDetail.healthImpact}
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Factory style={{ width: 16, height: 16, color: '#8b5cf6' }} />
                  Main Emission Sources
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {activeDetail.sources.map((src, i) => (
                    <div key={i} style={{
                      backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: 10,
                      fontSize: 12.5, color: '#334155', border: '1px solid #f1f5f9', fontWeight: 500,
                    }}>
                      • {src}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
                <div style={{ backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: 14, borderRadius: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Users style={{ width: 15, height: 15 }} />
                    High-Risk Groups
                  </div>
                  <p style={{ fontSize: 12, color: '#7c2d12', margin: 0, lineHeight: 1.5 }}>
                    {activeDetail.vulnerable}
                  </p>
                </div>

                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #dcfce7', padding: 14, borderRadius: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <ShieldAlert style={{ width: 15, height: 15 }} />
                    Protective Actions
                  </div>
                  <p style={{ fontSize: 12, color: '#14532d', margin: 0, lineHeight: 1.5 }}>
                    {activeDetail.precaution}
                  </p>
                </div>
              </div>

              <div style={{
                backgroundColor: '#f0f9ff', borderRadius: 16,
                padding: '16px 20px', border: '1.5px solid #bae6fd',
                marginTop: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Cpu style={{ width: 18, height: 18, color: '#0284c7' }} />
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#0369a1' }}>
                      Sensor Hardware Module
                    </span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                    backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc',
                  }}>
                    {activeDetail.sensorType}
                  </span>
                </div>

                {activeDetail.sensorImage ? (
                  <div style={{
                    backgroundColor: '#ffffff', borderRadius: 14, padding: '12px 16px',
                    marginBottom: 12, border: '1px solid #bae6fd',
                    display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)',
                  }}>
                    <img
                      src={activeDetail.sensorImage}
                      alt={activeDetail.sensorName}
                      style={{
                        width: 84, height: 70, objectFit: 'contain',
                        borderRadius: 8, backgroundColor: '#f8fafc', padding: 4, border: '1px solid #e2e8f0',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                        {activeDetail.sensorName}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>
                        MCERTS Certified Laser Scattering PM Sensor
                      </div>
                      {activeDetail.sensorUrl && (
                        <a
                          href={activeDetail.sensorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            fontSize: 12, fontWeight: 700, color: '#0284c7',
                            marginTop: 6, textDecoration: 'none',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                        >
                          <span>View Product Page on Robu.in</span>
                          <ExternalLink style={{ width: 13, height: 13 }} />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    Model: {activeDetail.sensorName}
                  </div>
                )}

                <p style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55, margin: 0 }}>
                  <strong>How it measures:</strong> {activeDetail.sensorWorking}
                </p>

                <div style={{ marginTop: 8, fontSize: 11.5, color: '#0284c7', fontWeight: 600 }}>
                  ⚙️ {activeDetail.sensorSpecs}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

