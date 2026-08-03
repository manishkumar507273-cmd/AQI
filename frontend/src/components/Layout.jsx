import { motion } from 'framer-motion';
import { Wind } from 'lucide-react';
import WindCanvas from './WindCanvas';

export default function Layout({ children, activeNav, onNavChange, activeTab, onTabChange }) {
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

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b131e',
      backgroundImage: 'radial-gradient(ellipse 100% 80% at 50% -20%, #152233 0%, #0b131e 70%, #080e17 100%)',
      color: '#f8fafc',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
    }}>
      <WindCanvas active={isWeather} />

      {/* ─── Top Header Navigation Bar ─── */}
      <header style={{
        height: 64,
        padding: '0 36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(11, 19, 30, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            backgroundColor: '#00bfa5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0b131e',
            boxShadow: '0 2px 10px rgba(0, 191, 165, 0.3)',
          }}>
            <Wind style={{ width: 18, height: 18 }} />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
            AQI <span style={{ fontWeight: 400, color: '#00bfa5' }}>Live</span>
          </span>
        </div>

        {/* Centered Floating Pill Navigation (Perfectly centered in header) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          padding: '4px',
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          gap: 2,
        }}>
          {[
            { id: 'aqi', label: 'AQI' },
            { id: 'weather', label: 'Weather' },
            { id: 'forecast', label: 'Forecast' },
            { id: 'historical', label: 'Analytics' },
          ].map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTopTabClick(tab.id)}
                style={{
                  padding: '7px 20px',
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#00bfa5' : 'transparent',
                  color: isActive ? '#0b131e' : '#94a3b8',
                  boxShadow: isActive ? '0 2px 10px rgba(0, 191, 165, 0.35)' : 'none',
                  transition: 'all 0.18s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right spacing placeholder for layout balance */}
        <div style={{ width: 100 }} />
      </header>

      {/* ─── Main Content Container ─── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 24px 48px' }}>
        <motion.div
          key={currentTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
