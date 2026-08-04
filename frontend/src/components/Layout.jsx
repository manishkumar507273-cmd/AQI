import { motion } from 'framer-motion';
import { Wind, Activity, CloudSun, LineChart, Database, Radio, ChevronDown } from 'lucide-react';
import WindCanvas from './WindCanvas';

export const STATIONS = [
  { id: 'station-1', name: 'SMVITM — Station 1', sub: 'Active Live Stream', location: 'SMVITM Campus', isLive: true },
  { id: 'station-2', name: 'Station 2 — Industrial Zone', sub: 'Standby / Pending Setup', location: 'Industrial Sector 62', isLive: false },
  { id: 'station-3', name: 'Station 3 — Suburban Eco Park', sub: 'Standby / Pending Setup', location: 'Eco Green District', isLive: false },
  { id: 'station-4', name: 'Station 4 — Traffic Corridor', sub: 'Standby / Pending Setup', location: 'North Highway Junction', isLive: false },
  { id: 'station-5', name: 'Station 5 — Coastal Baseline', sub: 'Standby / Pending Setup', location: 'Coastal Monitoring Post', isLive: false },
];

export default function Layout({
  children,
  activeNav,
  onNavChange,
  activeTab,
  onTabChange,
  selectedStation = 'station-1',
  onStationChange,
}) {
  const isWeather = activeTab === 'weather' && activeNav === 'home';

  const getCurrentNavTab = () => {
    if (activeNav === 'historical') return 'historical';
    if (activeNav === 'forecast') return 'forecast';
    return activeTab === 'weather' ? 'weather' : 'aqi';
  };

  const handleTopTabClick = (tabId) => {
    if (tabId === 'aqi') {
      onNavChange('home');
      onTabChange('aqi');
    } else if (tabId === 'weather') {
      onNavChange('home');
      onTabChange('weather');
    } else if (tabId === 'forecast') {
      onNavChange('forecast');
    } else if (tabId === 'historical') {
      onNavChange('historical');
    }
  };

  const currentTab = getCurrentNavTab();
  const currentStationObj = STATIONS.find(s => s.id === selectedStation) || STATIONS[0];

  const NAV_ITEMS = [
    { id: 'aqi', label: 'AQI Dashboard', icon: Activity },
    { id: 'weather', label: 'Weather Telemetry', icon: CloudSun },
    { id: 'forecast', label: 'Predictive Forecast', icon: LineChart },
    { id: 'historical', label: 'Analytics Archive', icon: Database },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      backgroundImage: 'radial-gradient(ellipse 120% 80% at 50% -20%, #e2e8f0 0%, #f1f5f9 65%, #e2e8f0 100%)',
      color: '#0f172a',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      <WindCanvas active={isWeather} />

      {/* ─── Top Header Navigation Bar ─── */}
      <header style={{
        minHeight: 68,
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.90)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
      }}>
        {/* Left Side: Brand Logo */}
        <div 
          onClick={() => handleTopTabClick('aqi')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: '#00bfa5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
          }}>
            <Wind style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <span style={{ fontSize: 21, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
              Atmo<span style={{ fontWeight: 400, color: '#00bfa5' }}>Logic</span>
            </span>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: -2 }}>
              Real-time AQI &amp; Weather
            </div>
          </div>
        </div>

        {/* Center: Smooth Segmented Floating Pill Navigation Bar */}
        <nav style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          padding: '4px',
          borderRadius: 999,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          gap: 4,
          maxWidth: '100%',
          overflowX: 'auto',
          position: 'relative',
        }}>
          {NAV_ITEMS.map((tab) => {
            const isActive = currentTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTopTabClick(tab.id)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  backgroundColor: 'transparent',
                  color: isActive ? '#ffffff' : '#64748b',
                  transition: 'color 0.15s ease',
                  zIndex: 1,
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabPill"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: '#00bfa5',
                      borderRadius: 999,
                      boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                      zIndex: -1,
                    }}
                  />
                )}
                <Icon style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.75 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Side: Station Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 14,
            padding: '6px 14px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            transition: 'border-color 0.2s ease',
          }}>
            <Radio style={{ width: 16, height: 16, color: currentStationObj.isLive ? '#00bfa5' : '#94a3b8', marginRight: 8 }} />
            
            <select
              value={selectedStation}
              onChange={(e) => onStationChange && onStationChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#0f172a',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                paddingRight: 18,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
              }}
            >
              {STATIONS.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.isLive ? '(Live)' : '(Standby)'}
                </option>
              ))}
            </select>

            <ChevronDown style={{ width: 14, height: 14, color: '#64748b', position: 'absolute', right: 10, pointerEvents: 'none' }} />
          </div>

          <div style={{
            padding: '5px 12px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: currentStationObj.isLive ? '#dcfce7' : '#f1f5f9',
            color: currentStationObj.isLive ? '#15803d' : '#64748b',
            border: `1px solid ${currentStationObj.isLive ? '#bbf7d0' : '#e2e8f0'}`,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: currentStationObj.isLive ? '#16a34a' : '#94a3b8' }} />
            <span>{currentStationObj.isLive ? 'LIVE NODE' : 'STANDBY (NULL)'}</span>
          </div>
        </div>

      </header>

      {/* ─── Main Content Container ─── */}
      <main style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 60px', boxSizing: 'border-box' }}>
        <motion.div
          key={currentTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
