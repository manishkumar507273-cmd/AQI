import { motion } from 'framer-motion';
import { RefreshCw, Home, BarChart2, TrendingUp } from 'lucide-react';
import WindCanvas from './WindCanvas';

export default function Layout({ children, onRefresh, loading, activeNav, onNavChange, activeTab, onTabChange }) {
  const isWeather = activeTab === 'weather' && activeNav === 'home';

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      backgroundColor: 'var(--bg-main)',
      position: 'relative',
    }}>
      {/* Background wallpaper layer for weather with smooth opacity fade */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: "url('/weather_bg.png') center top / cover no-repeat",
        opacity: isWeather ? 1 : 0,
        transition: 'opacity 0.15s ease-out',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <WindCanvas active={isWeather} />

      <aside style={{
        width: 240,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #1e293b',
        position: 'sticky',
        top: 0,
        height: '100vh',
        zIndex: 10,
        boxShadow: '4px 0 16px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          padding: '20px 24px',
          fontSize: 22,
          fontWeight: 800,
          color: '#38bdf8',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          AIR <span style={{ color: '#22c55e', fontSize: 18, fontWeight: 700 }}>NET</span>
        </div>

        <nav style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { id: 'home', label: 'Home', icon: Home },
            { id: 'historical', label: 'Historical Data', icon: BarChart2 },
            { id: 'forecast', label: 'Forecasting', icon: TrendingUp },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  backgroundColor: 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  transition: 'color 0.12s ease',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="nav-active-bg"
                    transition={{ type: 'spring', stiffness: 600, damping: 35 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon style={{ width: 18, height: 18 }} />
                  <span>{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div style={{ padding: 16, borderTop: '1px solid #1e293b', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Air Quality & Weather Platform
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', zIndex: 1 }}>
        <header style={{
          backgroundColor: isWeather ? 'rgba(255, 255, 255, 0.75)' : 'var(--bg-card)',
          backdropFilter: isWeather ? 'blur(12px)' : 'none',
          borderBottom: '1px solid var(--border-color)',
          padding: '0 28px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1,
          transition: 'background-color 0.15s ease, backdrop-filter 0.15s ease',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
            {activeNav === 'home' ? 'Home Dashboard' : activeNav === 'forecast' ? 'Forecasting Analytics' : 'Historical Analytics'}
          </div>

          <button
            onClick={onRefresh}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-main)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <RefreshCw style={{
              width: 14, height: 14, color: 'var(--primary)',
              animation: loading ? 'spin 1s linear infinite' : 'none'
            }} />
            <span>Refresh Data</span>
          </button>
        </header>

        <main style={{ flex: 1, padding: '24px 28px 40px 28px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>
            {activeNav === 'home' && (
              <div className="pill-tab-bar">
                <div
                  className="pill-tab-slider"
                  style={{
                    transform: activeTab === 'aqi' ? 'translateX(0%)' : 'translateX(100%)',
                  }}
                />
                <button
                  type="button"
                  className={`pill-tab-btn ${activeTab === 'aqi' ? 'active' : ''}`}
                  onClick={() => onTabChange('aqi')}
                >
                  <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="22" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 8H15C16.6569 8 18 6.65685 18 5C18 3.34315 16.6569 2 15 2C14.1716 2 13.5 2.67157 13.5 3.5" stroke={activeTab === 'aqi' ? '#ffffff' : '#60a5fa'} strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M3 14H19C20.6569 14 22 15.3431 22 17C22 18.6569 20.6569 20 19 20C18.1716 20 17.5 19.3284 17.5 18.5" stroke={activeTab === 'aqi' ? '#ffffff' : '#3b82f6'} strokeWidth="2.5" strokeLinecap="round"/>
                      <path d="M4 20H11" stroke={activeTab === 'aqi' ? '#ffffff' : '#facc15'} strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                    <span>AQI</span>
                  </span>
                </button>

                <button
                  type="button"
                  className={`pill-tab-btn ${activeTab === 'weather' ? 'active' : ''}`}
                  onClick={() => onTabChange('weather')}
                >
                  <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, lineHeight: 1 }}>☀️</span>
                    <span>Weather</span>
                  </span>
                </button>
              </div>
            )}

            <div className={`main-content-card ${isWeather ? 'weather-transparent' : ''}`}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


