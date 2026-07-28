
import { useState, useEffect } from 'react';
import { getCloudLatest } from '../api';
import { Cpu, ExternalLink, ChevronRight, X } from 'lucide-react';
import sht45SensorImg from '../assets/sht45_sensor.png';
import windSpeedSensorImg from '../assets/wind_speed_sensor.png';
import windDirSensorImg from '../assets/wind_dir_sensor.png';
import rainGaugeSensorImg from '../assets/rain_gauge_sensor.png';

const fmt = (val, d = 1) => (val != null ? (Number(val) % 1 === 0 ? Number(val).toFixed(0) : Number(val).toFixed(d)) : null);

const getCompassDir = (deg) => {
  if (deg == null) return null;
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
};

const getHumidityLabel = (h) => {
  if (h == null) return '—';
  if (h < 30) return 'Very Dry';
  if (h < 50) return 'Comfortable';
  if (h < 70) return 'Moderate';
  if (h < 85) return 'Humid';
  return 'Very Humid';
};

const getTempLabel = (t) => {
  if (t == null) return '—';
  if (t < 10) return 'Cold';
  if (t < 20) return 'Cool';
  if (t < 28) return 'Pleasant';
  if (t < 35) return 'Warm';
  return 'Hot';
};

const getRainLabel = (r) => {
  if (r == null) return '—';
  if (r === 0) return 'No Rainfall';
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

export default function Weather({ cloudData, cloudLoading, cloudError, refreshKey }) {
  const [cloud, setCloud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeSensorModal, setActiveSensorModal] = useState(null);

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
    <div style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 36, height: 36, border: '3px solid #22c55e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14 }}>Loading weather data...</p>
    </div>
  );

  if (error || !cloud) return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 16 }}>Sensor Offline</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>{error || 'No data available.'}</p>
    </div>
  );

  const temperature = cloud?.temperature ?? null;
  const humidity    = cloud?.humidity    ?? null;
  const windSpeed   = cloud?.wind_speed  ?? null;
  const windDir     = cloud?.wind_direction ?? null;
  const rainGauge   = cloud?.rain_gauge  ?? null;
  const aqi         = cloud?.cpcb_aqi    ?? null;
  const aqiLabel    = cloud?.aqi_info?.label ?? null;
  const aqiColor    = cloud?.aqi_info?.color ?? '#94a3b8';

  const dateStr = (lastUpdated || new Date()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const isFresh = (() => {
    if (!cloud || error) return false;
    const ts = cloud.timestamp;
    if (!ts) return false;
    const dataAge = Date.now() - new Date(ts).getTime();
    return dataAge < 2 * 60 * 1000; 
  })();
  const isOnline = isFresh;
  const statusColor = isOnline ? '#22c55e' : '#ef4444';
  const statusText = isOnline ? 'Live Sensor' : 'Sensor Offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 0 }}>
        Weather Conditions
      </h1>

      <div
        className="card"
        style={{
          padding: 0, overflow: 'hidden', position: 'relative', minHeight: 220,
          cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onClick={() => setActiveSensorModal('temp_humidity')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(14, 165, 233, 0.15)';
          const arr = e.currentTarget.querySelector('.hero-card-arrow');
          if (arr) arr.style.transform = 'translateX(4px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          const arr = e.currentTarget.querySelector('.hero-card-arrow');
          if (arr) arr.style.transform = 'translateX(0)';
        }}
      >
        
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(180deg, rgba(56,189,248,0) 0%, rgba(56,189,248,0.1) 50%, rgba(14,165,233,0.18) 100%)',
          zIndex: 0,
        }}>
          <svg viewBox="0 0 960 80" style={{ width: '100%', height: '100%', position: 'absolute', bottom: 0 }} preserveAspectRatio="none">
            <path d="M0 80 L0 55 L40 55 L40 40 L55 35 L70 40 L70 55 L120 55 L120 38 L135 30 L150 38 L150 55 L200 55 L200 45 L220 45 L220 55 L270 55 L270 25 L282 18 L295 25 L295 55 L340 55 L340 42 L360 42 L360 55 L420 58 L480 55 L480 38 L495 30 L510 38 L510 55 L560 55 L560 45 L580 45 L580 55 L640 55 L640 25 L655 18 L670 25 L670 55 L720 55 L720 42 L740 42 L740 55 L800 55 L800 35 L815 28 L830 35 L830 55 L880 55 L880 45 L900 45 L900 55 L960 55 L960 80 Z"
              fill="rgba(14,165,233,0.12)" />
          </svg>
        </div>

        <div style={{ position: 'relative', zIndex: 1, padding: '28px 32px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>

          <div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}`, display: 'inline-block', animation: isOnline ? 'pulse 2s ease-in-out infinite' : 'none' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{statusText}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>· {lastUpdated ? lastUpdated.toLocaleTimeString() : '—'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <span style={{ fontSize: 72, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                {fmt(temperature, 1) ?? '--'}
              </span>
              <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 10 }}>°C</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{
                padding: '5px 14px', borderRadius: 10,
                backgroundColor: '#e0f2fe', border: '1px solid #bae6fd',
                color: '#0369a1', fontSize: 14, fontWeight: 700,
              }}>
                {getTempLabel(temperature)}
              </span>
              {aqi != null && (
                <span style={{
                  padding: '5px 14px', borderRadius: 10,
                  backgroundColor: `${aqiColor}22`, border: `1px solid ${aqiColor}55`,
                  color: aqiColor, fontSize: 14, fontWeight: 700,
                }}>
                  AQI {aqi} · {aqiLabel}
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>{dateStr}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0284c7' }}>Sensor Info</span>
            <div
              className="hero-card-arrow"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: '#e0f2fe', border: '1px solid #bae6fd',
                color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.2s ease',
              }}
            >
              <ChevronRight style={{ width: 18, height: 18, strokeWidth: 2.5 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>

        <WeatherCard
          icon="💧"
          param="Humidity"
          value={humidity != null ? `${fmt(humidity, 1)}%` : 'N/A'}
          label={getHumidityLabel(humidity)}
          progress={humidity != null ? humidity / 100 : null}
          accentColor="#0ea5e9"
          bgColor="#f0f9ff"
          borderColor="#bae6fd"
          labelBg="#e0f2fe"
          labelText="#0369a1"
          onClick={() => setActiveSensorModal('temp_humidity')}
          hasArrow
        />

        <WeatherCard
          icon="💨"
          param="Wind Speed"
          value={windSpeed != null ? `${fmt(windSpeed)} km/h` : 'N/A'}
          label={getWindLabel(windSpeed)}
          progress={windSpeed != null ? Math.min(windSpeed / 80, 1) : null}
          accentColor="#8b5cf6"
          bgColor="#faf5ff"
          borderColor="#ddd6fe"
          labelBg="#ede9fe"
          labelText="#6d28d9"
          onClick={() => setActiveSensorModal('wind_speed')}
          hasArrow
        />

        <WeatherCard
          icon="🌧️"
          param="Rain Gauge"
          value={rainGauge != null ? `${fmt(rainGauge)} mm` : 'N/A'}
          label={getRainLabel(rainGauge)}
          progress={rainGauge != null ? Math.min(rainGauge / 50, 1) : null}
          accentColor="#06b6d4"
          bgColor="#ecfeff"
          borderColor="#a5f3fc"
          labelBg="#cffafe"
          labelText="#0e7490"
          animated
          onClick={() => setActiveSensorModal('rain_gauge')}
          hasArrow
        />

        <WindDirCard
          windDir={windDir}
          onClick={() => setActiveSensorModal('wind_dir')}
          hasArrow
        />
      </div>

      {activeSensorModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setActiveSensorModal(null)}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: 24,
            maxWidth: 540, width: '100%', maxHeight: '90vh',
            overflowY: 'auto', border: '1.5px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: 24, position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  backgroundColor: '#e0f2fe', color: '#0284c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Cpu style={{ width: 22, height: 22 }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {activeSensorModal === 'temp_humidity' ? 'Temperature & Humidity Hardware' :
                     activeSensorModal === 'wind_speed' ? 'Wind Speed Hardware Sensor' :
                     activeSensorModal === 'wind_dir' ? 'Wind Direction Hardware Sensor' :
                     'Rain Gauge Hardware Sensor'}
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Environmental Telemetry Sensor
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveSensorModal(null)}
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none',
                  backgroundColor: '#f1f5f9', color: '#64748b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {activeSensorModal === 'temp_humidity' && (
              <div style={{
                backgroundColor: '#f0f9ff', borderRadius: 18, padding: 18,
                border: '1.5px solid #bae6fd', marginBottom: 16,
              }}>
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
                  marginBottom: 14, border: '1px solid #bae6fd',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)',
                }}>
                  <img
                    src={sht45SensorImg}
                    alt="7Semi SHT45 Breakout Board"
                    style={{
                      width: 96, height: 80, objectFit: 'contain',
                      borderRadius: 10, backgroundColor: '#f8fafc', padding: 6, border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                      7Semi SHT45 Humidity & Temperature Sensor Breakout Board
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      4-Pin JST Connector (I2C Digital Output)
                    </div>
                    <a
                      href="https://robocraze.com/products/7semi-sht45-humidity-temperature-sensor-breakout-board-with-4-pin-connector?variant=48177129554144"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12.5, fontWeight: 700, color: '#0284c7',
                        marginTop: 8, textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      <span>View Product Page on Robocraze</span>
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </a>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  <strong>Working Principle:</strong> Uses Sensirion’s flagship 4th generation SHT45 CMOSens® technology. Features a patented capacitive humidity sensor element and an integrated internal heater for high humidity condensation recovery. Communicates over I2C (Address 0x44).
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: '#0284c7', fontWeight: 700, backgroundColor: '#e0f2fe', padding: '8px 12px', borderRadius: 10, border: '1px solid #7dd3fc' }}>
                  ⚙️ Specs: Temp Accuracy ±0.1°C | RH Accuracy ±1.0% RH | Supply: 1.62V – 3.6V | 4-Pin JST Connector
                </div>
              </div>
            )}

            {activeSensorModal === 'wind_speed' && (
              <div style={{
                backgroundColor: '#faf5ff', borderRadius: 18, padding: 18,
                border: '1.5px solid #ddd6fe', marginBottom: 16,
              }}>
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
                  marginBottom: 14, border: '1px solid #ddd6fe',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  boxShadow: '0 2px 8px rgba(109, 40, 217, 0.06)',
                }}>
                  <img
                    src={windSpeedSensorImg}
                    alt="Wind Speed Sensor SN-3000-FSJT-NPN"
                    style={{
                      width: 96, height: 80, objectFit: 'contain',
                      borderRadius: 10, backgroundColor: '#f8fafc', padding: 6, border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                      Wind Speed Sensor SN-3000-FSJT-NPN (Three-Cup Anemometer)
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      NPN Open Collector Pulse Output Anemometer
                    </div>
                    <a
                      href="https://robu.in/product/wind-speed-sensor-sn-3000-fsjt-npn/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12.5, fontWeight: 700, color: '#6d28d9',
                        marginTop: 8, textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      <span>View Product Page on Robu.in</span>
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </a>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  <strong>Working Principle:</strong> Three hemispherical cups rotate as wind flows across the sensor. An internal magnetic Hall effect element measures cup rotation frequency and generates an NPN digital pulse signal directly proportional to wind velocity.
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: '#6d28d9', fontWeight: 700, backgroundColor: '#ede9fe', padding: '8px 12px', borderRadius: 10, border: '1px solid #c4b5fd' }}>
                  ⚙️ Range: 0 – 30 m/s (0 – 108 km/h) | Accuracy: ±1 m/s | Output: NPN Open Collector Pulse | Voltage: 12V – 24V DC
                </div>
              </div>
            )}

            {activeSensorModal === 'wind_dir' && (
              <div style={{
                backgroundColor: '#f8fafc', borderRadius: 18, padding: 18,
                border: '1.5px solid #cbd5e1', marginBottom: 16,
              }}>
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
                  marginBottom: 14, border: '1px solid #e2e8f0',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
                }}>
                  <img
                    src={windDirSensorImg}
                    alt="Wind Direction Sensor SN-3000-FSJT-I20"
                    style={{
                      width: 96, height: 80, objectFit: 'contain',
                      borderRadius: 10, backgroundColor: '#f8fafc', padding: 6, border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                      Wind Direction Sensor SN-3000-FSJT-I20 (Wind Vane)
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      4-20mA Current Output Wind Direction Transmitter
                    </div>
                    <a
                      href="https://robu.in/product/wind-speed-sensor-sn-3000-fsjt-i20/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12.5, fontWeight: 700, color: '#0284c7',
                        marginTop: 8, textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      <span>View Product Page on Robu.in</span>
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </a>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  <strong>Working Principle:</strong> A low-inertia wind vane rotates 360° to point in the direction of wind flow. An internal magnetic angle sensor measures the precise azimuth position and converts it to a 4-20mA analog current signal mapped to 0°–360° compass headings.
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: '#334155', fontWeight: 700, backgroundColor: '#e2e8f0', padding: '8px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}>
                  ⚙️ Measuring Range: 0° – 360° (16 Directions) | Accuracy: ±3° | Output: 4-20mA | Operating Voltage: 12V – 24V DC
                </div>
              </div>
            )}

            {activeSensorModal === 'rain_gauge' && (
              <div style={{
                backgroundColor: '#ecfeff', borderRadius: 18, padding: 18,
                border: '1.5px solid #a5f3fc', marginBottom: 16,
              }}>
                <div style={{
                  backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
                  marginBottom: 14, border: '1px solid #cffafe',
                  display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                  boxShadow: '0 2px 8px rgba(6, 182, 212, 0.06)',
                }}>
                  <img
                    src={rainGaugeSensorImg}
                    alt="DFRobot Gravity Tipping Bucket Rainfall Sensor"
                    style={{
                      width: 96, height: 80, objectFit: 'contain',
                      borderRadius: 10, backgroundColor: '#f8fafc', padding: 6, border: '1px solid #e2e8f0',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                      DFRobot Gravity: Tipping Bucket Rainfall Sensor (I2C / UART)
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Tipping Bucket Mechanism with Gravity Interface Board
                    </div>
                    <a
                      href="https://robocraze.com/products/dfrobot-gravity-tipping-bucket-rainfall-sensor-i2c-uart"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 12.5, fontWeight: 700, color: '#0e7490',
                        marginTop: 8, textDecoration: 'none',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    >
                      <span>View Product Page on Robocraze</span>
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </a>
                  </div>
                </div>

                <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                  <strong>Working Principle:</strong> Rainwater collects in the top funnel and drains into an internal mechanical tipping bucket. Each tip event corresponds to exactly 0.2794mm of rainfall, triggering a reed switch pulse that the DFRobot Gravity adapter board calculates into cumulative precipitation depth.
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: '#0e7490', fontWeight: 700, backgroundColor: '#cffafe', padding: '8px 12px', borderRadius: 10, border: '1px solid #a5f3fc' }}>
                  ⚙️ Resolution: 0.2794 mm per tip | Output Interface: I2C & UART (Gravity 4-pin) | Voltage: 3.3V – 5.0V DC
                </div>
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setActiveSensorModal(null)}
                style={{
                  padding: '10px 20px', borderRadius: 12,
                  backgroundColor: activeSensorModal === 'temp_humidity' ? '#0284c7' : activeSensorModal === 'wind_speed' ? '#6d28d9' : activeSensorModal === 'wind_dir' ? '#334155' : '#0e7490',
                  color: '#ffffff', fontWeight: 700, fontSize: 13, border: 'none',
                  cursor: 'pointer', transition: 'background-color 0.2s ease',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeatherCard({ icon, param, value, label, progress, accentColor, bgColor, borderColor, labelBg, labelText, animated, onClick, hasArrow }) {
  return (
    <div
      className="card"
      style={{
        padding: '20px 22px',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        position: 'relative', overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(14, 165, 233, 0.18)';
        const arr = e.currentTarget.querySelector('.weather-card-arrow');
        if (arr) arr.style.transform = 'translateX(3px)';
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        const arr = e.currentTarget.querySelector('.weather-card-arrow');
        if (arr) arr.style.transform = 'translateX(0)';
      }}
    >
      {animated && Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="raindrop-streak" style={{
          left: `${5 + i * 13}%`, top: 0, opacity: 0.25,
          animationDelay: `${(i * 0.18) % 1}s`,
          animationDuration: `${0.7 + (i % 3) * 0.2}s`,
          background: `linear-gradient(180deg, transparent 0%, ${accentColor}99 100%)`,
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{param}</span>
          </div>
          {hasArrow && (
            <div
              className="weather-card-arrow"
              style={{
                width: 26, height: 26, borderRadius: '50%',
                backgroundColor: labelBg, color: labelText, border: `1px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.2s ease',
              }}
            >
              <ChevronRight style={{ width: 15, height: 15, strokeWidth: 2.5 }} />
            </div>
          )}
        </div>

        <div style={{ fontSize: 34, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1, letterSpacing: '-0.02em' }}>
          {value}
        </div>

        <div style={{ marginTop: 10 }}>
          <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: labelBg, color: labelText }}>
            {label}
          </span>
        </div>

        {progress != null && (
          <div style={{ marginTop: 14, height: 5, backgroundColor: `${accentColor}22`, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.round(progress * 100)}%`,
              backgroundColor: accentColor, borderRadius: 3,
              transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function WindDirCard({ windDir, onClick, hasArrow }) {
  const dir = getCompassDir(windDir);
  return (
    <div
      className="card"
      style={{
        padding: '20px 22px', background: '#f8fafc', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.12)';
        const arr = e.currentTarget.querySelector('.wind-dir-arrow');
        if (arr) arr.style.transform = 'translateX(3px)';
      }}
      onMouseLeave={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        const arr = e.currentTarget.querySelector('.wind-dir-arrow');
        if (arr) arr.style.transform = 'translateX(0)';
      }}
    >
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🧭</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Wind Direction</span>
        </div>
        {hasArrow && (
          <div
            className="wind-dir-arrow"
            style={{
              width: 26, height: 26, borderRadius: '50%',
              backgroundColor: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s ease',
            }}
          >
            <ChevronRight style={{ width: 15, height: 15, strokeWidth: 2.5 }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg viewBox="0 0 120 120" style={{ width: 100, height: 100, flexShrink: 0 }}>
          
          <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="46" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 4" />

          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const r1 = 46, r2 = 51;
            return <line key={i}
              x1={60 + r1 * Math.sin(a)} y1={60 - r1 * Math.cos(a)}
              x2={60 + r2 * Math.sin(a)} y2={60 - r2 * Math.cos(a)}
              stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />;
          })}

          {[['N', 60, 8], ['E', 114, 63], ['S', 60, 118], ['W', 6, 63]].map(([l, x, y]) => (
            <text key={l} x={x} y={y} textAnchor="middle"
              fill={l === 'N' ? '#ef4444' : '#94a3b8'}
              fontSize="11" fontWeight="800" fontFamily="Inter, sans-serif">{l}</text>
          ))}

          <circle cx="60" cy="60" r="20" fill="white" stroke="#e2e8f0" strokeWidth="1" />

          <circle cx="60" cy="60" r="4" fill="#475569" />

          {windDir != null ? (
            <g transform={`rotate(${windDir}, 60, 60)`}>
              <polygon points="60,18 56.5,52 63.5,52" fill="#ef4444" />
              <polygon points="60,102 56.5,68 63.5,68" fill="#94a3b8" />
            </g>
          ) : (
            <text x="60" y="64" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="Inter, sans-serif">—</text>
          )}
        </svg>

        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text-main)', lineHeight: 1 }}>
            {dir ?? 'N/A'}
          </div>
          {windDir != null && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              {fmt(windDir, 0)}° from North
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569' }}>
              {windDir != null ? 'Wind Direction' : 'No sensor data'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
