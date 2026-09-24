import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, LineChart, Database, Radio, Menu, X, ArrowLeft, ArrowUpRight, LogOut, LogIn, UserCheck } from 'lucide-react';
import WindCanvas from './WindCanvas';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

const STATIONS = [
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
  const { currentUser, isRegisteredUser, openAuthModal, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isWeather = activeTab === 'weather' && activeNav === 'home';

  const getCurrentNavTab = () => {
    if (activeNav === 'overview') return 'overview';
    if (activeNav === 'historical') return 'historical';
    if (activeNav === 'forecast') return 'forecast';
    return 'live';
  };

  const handleTopTabClick = (tabId) => {
    onNavChange(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewDetailedDashboard = () => {
    if (currentUser || isRegisteredUser) {
      handleTopTabClick('dashboard');
    } else {
      openAuthModal(() => {
        handleTopTabClick('dashboard');
      });
    }
  };

  const handleNavItemClick = (tabId) => {
    if (tabId === 'overview' || currentUser || isRegisteredUser) {
      handleTopTabClick(tabId);
    } else {
      openAuthModal(() => {
        handleTopTabClick(tabId);
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      if (activeNav !== 'overview') {
        handleTopTabClick('overview');
      }
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const currentTab = getCurrentNavTab();
  const currentStationObj = STATIONS.find(s => s.id === selectedStation) || STATIONS[0];

  // Only these 3 options appear in the navigation on all inner pages
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {/* Back arrow — shown on all inner pages to return to start page */}
          {activeNav !== 'overview' && (
            <button
              onClick={() => handleTopTabClick('overview')}
              title="Back to Atmosphere Snapshot"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                borderRadius: 10,
                border: '1.5px solid #e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#475569',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#00bfa5'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#00bfa5'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
            </button>
          )}
          <div
            onClick={() => handleTopTabClick('overview')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}
          >
          <div
            className="app-header-brand-icon"
            style={{
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: '#00bfa5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
              flexShrink: 0,
            }}
          >
            <Wind style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div className="app-header-title" style={{ fontSize: 'clamp(17px, 3vw, 20px)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              Smart <span style={{ fontWeight: 500, color: '#00bfa5' }}>WeatherNet</span>
            </div>
            <div className="app-header-subtitle" style={{ fontSize: 10, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: -1 }}>
              Real-time AQI &amp; Weather
            </div>
          </div>
          </div>
        </div>

        {/* Center: Desktop Nav pills — hidden on Atmosphere Snapshot */}
        {activeNav !== 'overview' && (
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
                <motion.button
                  key={tab.id}
                  onClick={() => handleNavItemClick(tab.id)}
                  whileTap={{ scale: 0.95 }}
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
                </motion.button>
              );
            })}
          </nav>
        )}

        {/* Right: Desktop Live status badge & View Detailed Dashboard Button on Top Right */}
        <div className="desktop-only-nav" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {activeNav === 'overview' && (
            <button
              onClick={handleViewDetailedDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 22px',
                borderRadius: 999,
                border: '1.5px solid #7dd3fc',
                backgroundColor: '#f0f9ff',
                color: '#0284c7',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                boxShadow: '0 2px 10px rgba(2, 132, 199, 0.12)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 132, 199, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
                e.currentTarget.style.borderColor = '#7dd3fc';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(2, 132, 199, 0.12)';
              }}
            >
              <span>View Detailed Dashboard</span>
              <ArrowUpRight style={{ width: 16, height: 16, strokeWidth: 2.5, color: '#0284c7' }} />
            </button>
          )}

          {/* User Account / Profile Badge */}
          {currentUser ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: 999,
              padding: '3px 10px 3px 4px',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            }}>
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  backgroundColor: '#00bfa5',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}>
                  {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0f172a',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentUser.displayName || currentUser.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                title="Sign Out"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 6px',
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#00bfa5'; e.currentTarget.style.color = '#00bfa5'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }}
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
          )}

          <div style={{
            padding: '6px 14px',
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: currentStationObj.isLive ? '#dcfce7' : '#f1f5f9',
            color: currentStationObj.isLive ? '#15803d' : '#64748b',
            border: `1.5px solid ${currentStationObj.isLive ? '#bbf7d0' : '#e2e8f0'}`,
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: currentStationObj.isLive ? '#16a34a' : '#94a3b8' }} />
            <span>{currentStationObj.isLive ? 'LIVE' : 'STANDBY'}</span>
          </div>
        </div>

        {/* Right: Mobile Header Controls (Visible only on mobile <768px) */}
        <div className="mobile-only-header" style={{ display: 'none', alignItems: 'center', gap: 6 }}>
          {activeNav === 'overview' && (
            <button
              onClick={handleViewDetailedDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 9px',
                borderRadius: 999,
                border: '1.5px solid #7dd3fc',
                backgroundColor: '#f0f9ff',
                color: '#0284c7',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>Dashboard</span>
              <ArrowUpRight style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
            </button>
          )}

          <div className="mobile-live-badge" style={{
            padding: '4px 8px',
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            backgroundColor: currentStationObj.isLive ? '#dcfce7' : '#f1f5f9',
            color: currentStationObj.isLive ? '#15803d' : '#64748b',
            border: `1.5px solid ${currentStationObj.isLive ? '#bbf7d0' : '#e2e8f0'}`,
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
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              color: '#0f172a',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
              flexShrink: 0,
            }}
          >
            {mobileMenuOpen ? <X style={{ width: 17, height: 17, color: '#00bfa5' }} /> : <Menu style={{ width: 17, height: 17 }} />}
          </button>
        </div>

      </header>

      {/* ─── Mobile Navigation Drawer / Dropdown (<768px) ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div key="mobile-menu-wrapper">
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                top: 64,
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 48,
              }}
            />
            <motion.div
              key="mobile-drawer"
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
              {/* Mobile User Profile / Auth Action */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 14,
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                {currentUser ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="User" style={{ width: 30, height: 30, borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#00bfa5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                          {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser.displayName || currentUser.email?.split('@')[0]}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser.email}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 10,
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setMobileMenuOpen(false); openAuthModal(); }}
                    style={{
                      width: '100%',
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: 'none',
                      backgroundColor: '#00bfa5',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      cursor: 'pointer',
                    }}
                  >
                    <LogIn size={15} />
                    <span>Sign In or Register</span>
                  </button>
                )}
              </div>

              {/* Mobile Nav Links */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {NAV_ITEMS.map((tab) => {
                  const isActive = currentTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNavItemClick(tab.id);
                      }}
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Main Content Container ─── */}
      <main className="app-main" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {children}
      </main>

      {/* ─── Native Mobile Bottom Navigation Bar (<768px) ─── */}
      <nav className="mobile-bottom-nav">
        {[
          { id: 'live', label: 'Live Stream', icon: Radio },
          { id: 'forecast', label: 'Forecast', icon: LineChart },
          { id: 'historical', label: 'Archive', icon: Database },
        ].map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.id}
              onClick={() => handleNavItemClick(tab.id)}
              whileTap={{ scale: 0.92 }}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              aria-label={tab.label}
            >
              <div className="mobile-bottom-nav-icon-wrap">
                <Icon className="mobile-bottom-nav-icon" />
                {isActive && (
                  <motion.div
                    layoutId="mobileBottomIndicator"
                    className="mobile-bottom-nav-indicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
              </div>
              <span className="mobile-bottom-nav-label">{tab.label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* ─── Firebase Auth Modal ─── */}
      <AuthModal />
    </div>
  );
}
