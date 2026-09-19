import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, LineChart, Database, Radio, ChevronDown, Menu, X } from 'lucide-react';
import WindCanvas from './WindCanvas';

export const STATIONS = [
  { id: 'station-1', name: 'SMVITM — Station 1', sub: 'Active Live Stream', location: 'SMVITM Campus', isLive: true },
  { id: 'station-2', name: 'Station 2', sub: 'Standby / Pending Setup', location: 'Station 2', isLive: false },
  { id: 'station-3', name: 'Station 3', sub: 'Standby / Pending Setup', location: 'Station 3', isLive: false },
  { id: 'station-4', name: 'Station 4', sub: 'Standby / Pending Setup', location: 'Station 4', isLive: false },
  { id: 'station-5', name: 'Station 5', sub: 'Standby / Pending Setup', location: 'Station 5', isLive: false },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isWeather = activeTab === 'weather' && activeNav === 'home';

  const getCurrentNavTab = () => {
    if (activeNav === 'historical') return 'historical';
    if (activeNav === 'forecast') return 'forecast';
    return 'live';
  };

  const handleTopTabClick = (tabId) => {
    if (tabId === 'live') {
      onNavChange('live');
    } else if (tabId === 'forecast') {
      onNavChange('forecast');
    } else if (tabId === 'historical') {
      onNavChange('historical');
    }
    setMobileMenuOpen(false);
  };

  const currentTab = getCurrentNavTab();
  const currentStationObj = STATIONS.find(s => s.id === selectedStation) || STATIONS[0];

  const NAV_ITEMS = [
    { id: 'live', label: 'Live Data Stream', icon: Radio },
    { id: 'historical', label: 'Analytics Archive', icon: Database },
    { id: 'forecast', label: 'Predictive Forecast', icon: LineChart },
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
      width: '100%',
    }}>
      <WindCanvas active={isWeather} />

      {/* ─── Sticky Header ─── */}
      <header className="app-header" style={{
        minHeight: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
        width: '100%',
        boxSizing: 'border-box',
      }}>

        {/* Left: Brand */}
        <div
          onClick={() => handleTopTabClick('live')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: '#00bfa5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
            flexShrink: 0,
          }}>
            <Wind style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <div style={{ fontSize: 'clamp(18px, 3vw, 20px)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              Smart <span style={{ fontWeight: 500, color: '#00bfa5' }}>AirNet</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: -1 }}>
              Real-time AQI &amp; Weather
            </div>
          </div>
        </div>

        {/* Center: Desktop Nav pills (Hidden on mobile <768px) */}
        <nav className="desktop-only-nav" style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          padding: '4px',
          borderRadius: 999,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          gap: 2,
          position: 'relative',
          flex: '0 0 auto',
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
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13,
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
                <Icon style={{ width: 15, height: 15, opacity: isActive ? 1 : 0.75 }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Desktop Station controls (Hidden on mobile <768px) */}
        <div className="desktop-only-nav" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 14,
            padding: '6px 12px',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          }}>
            <Radio style={{ width: 15, height: 15, color: currentStationObj.isLive ? '#00bfa5' : '#94a3b8', marginRight: 6, flexShrink: 0 }} />
            <select
              value={selectedStation}
              onChange={(e) => onStationChange && onStationChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#0f172a',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                paddingRight: 18,
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                minWidth: 160,
              }}
            >
              {STATIONS.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} {st.isLive ? '(Live)' : '(NaN)'}
                </option>
              ))}
            </select>
            <ChevronDown style={{ width: 14, height: 14, color: '#64748b', position: 'absolute', right: 8, pointerEvents: 'none' }} />
          </div>

          <div style={{
            padding: '5px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            backgroundColor: currentStationObj.isLive ? '#dcfce7' : '#f1f5f9',
            color: currentStationObj.isLive ? '#15803d' : '#64748b',
            border: `1px solid ${currentStationObj.isLive ? '#bbf7d0' : '#e2e8f0'}`,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: currentStationObj.isLive ? '#16a34a' : '#94a3b8' }} />
            <span>{currentStationObj.isLive ? 'LIVE' : 'STANDBY'}</span>
          </div>
        </div>

        {/* Right: Mobile Header Controls (Visible only on mobile <768px) */}
        <div className="mobile-only-header" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '4px 8px',
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: currentStationObj.isLive ? '#dcfce7' : '#f1f5f9',
            color: currentStationObj.isLive ? '#15803d' : '#64748b',
            border: `1px solid ${currentStationObj.isLive ? '#bbf7d0' : '#e2e8f0'}`,
            fontFamily: 'var(--font-mono)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: currentStationObj.isLive ? '#16a34a' : '#94a3b8' }} />
            <span>{currentStationObj.isLive ? 'LIVE' : 'STANDBY'}</span>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
            }}
          >
            {mobileMenuOpen ? <X style={{ width: 20, height: 20, color: '#00bfa5' }} /> : <Menu style={{ width: 20, height: 20 }} />}
          </button>
        </div>

      </header>

      {/* ─── Mobile Navigation Drawer / Dropdown (<768px) ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1.5px solid #e2e8f0',
              boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
              padding: '16px 20px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              zIndex: 49,
            }}
          >
            {/* Mobile Nav Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {NAV_ITEMS.map((tab) => {
                const isActive = currentTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTopTabClick(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 600,
                      backgroundColor: isActive ? '#00bfa5' : '#f8fafc',
                      color: isActive ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: isActive ? '0 4px 14px rgba(0, 191, 165, 0.35)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon style={{ width: 18, height: 18 }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Mobile Station Selector */}
            <div style={{
              paddingTop: 12,
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Select Active Station
              </div>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 14,
                padding: '8px 12px',
              }}>
                <Radio style={{ width: 16, height: 16, color: currentStationObj.isLive ? '#00bfa5' : '#94a3b8', marginRight: 8, flexShrink: 0 }} />
                <select
                  value={selectedStation}
                  onChange={(e) => {
                    onStationChange && onStationChange(e.target.value);
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#0f172a',
                    fontSize: 13,
                    fontWeight: 700,
                    width: '100%',
                    cursor: 'pointer',
                    appearance: 'none',
                  }}
                >
                  {STATIONS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.isLive ? '(Live)' : '(Standby)'}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ width: 16, height: 16, color: '#64748b', position: 'absolute', right: 12, pointerEvents: 'none' }} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content Container ─── */}
      <main className="app-main">
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
