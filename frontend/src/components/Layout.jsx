import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, LineChart, Database, Radio, Menu, X, ArrowLeft, ArrowUpRight, LogOut, LogIn, UserCheck, ShieldAlert } from 'lucide-react';
import WindCanvas from './WindCanvas';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

function UserAvatar({ user, size = 28, fontSize = 12.5 }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.photoURL]);

  const initial = (user?.displayName || user?.email || 'U')[0].toUpperCase();

  if (user?.photoURL && !imgError) {
    return (
      <img
        src={user.photoURL}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: '#00bfa5',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize,
      fontWeight: 700,
      flexShrink: 0,
      boxShadow: '0 1px 3px rgba(0, 191, 165, 0.3)',
    }}>
      {initial}
    </div>
  );
}

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
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const isWeather = activeTab === 'weather' && activeNav === 'home';

  const getCurrentNavTab = () => {
    if (activeNav === 'dashboard') return 'live';
    return activeNav || 'live';
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

  const isAdmin = currentUser?.uid === 'admin-dev-bypass' || localStorage.getItem('SMART_WEATHER_ADMIN') === 'true';

  // Navigation options
  const NAV_ITEMS = [
    { id: 'live', label: 'Live Data Stream', mobileLabel: 'Live', icon: Radio },
    { id: 'historical', label: 'Analytics Archive', mobileLabel: 'Archive', icon: Database },
    ...(isAdmin 
      ? [{ id: 'forecast', label: 'Predictive Forecast', mobileLabel: 'Forecast', icon: LineChart }] 
      : [{ id: 'local-forecast', label: 'Predictive Forecast (Under Dev)', mobileLabel: 'Forecast', icon: LineChart }]),
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

        {/* Left: Brand & Location Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div className="app-header-title" style={{ fontSize: 'clamp(17px, 3vw, 20px)', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                Smart <span style={{ fontWeight: 500, color: '#00bfa5' }}>WeatherNet</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SMVITM Campus</span>
                <span className="location-coords mobile-hide" style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', borderLeft: '1px solid #e2e8f0', paddingLeft: 6, whiteSpace: 'nowrap' }}>13&deg;15'40&quot; N, 74&deg;47'13&quot; E</span>
              </div>
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

          {isAdmin && (
            <button
              onClick={() => handleNavItemClick('admin')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 999,
                border: '1.5px solid #e2e8f0',
                backgroundColor: currentTab === 'admin' ? '#0f172a' : '#ffffff',
                color: currentTab === 'admin' ? '#ffffff' : '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { 
                if (currentTab !== 'admin') {
                  e.currentTarget.style.backgroundColor = '#f8fafc'; 
                  e.currentTarget.style.color = '#0f172a'; 
                }
              }}
              onMouseLeave={e => { 
                if (currentTab !== 'admin') {
                  e.currentTarget.style.backgroundColor = '#ffffff'; 
                  e.currentTarget.style.color = '#475569'; 
                }
              }}
            >
              <ShieldAlert size={14} />
              <span>Admin Requests</span>
            </button>
          )}

          {/* User Account / Profile Badge */}
          {(currentUser || isRegisteredUser) ? (
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
              <UserAvatar user={currentUser || { displayName: 'G' }} size={28} fontSize={12.5} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#0f172a',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0]) : 'Guest Access'}
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
              onClick={() => openAuthModal(() => handleTopTabClick('dashboard'))}
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
          {isAdmin && (
            <button
              onClick={() => handleNavItemClick('admin')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 30, height: 30,
                borderRadius: '50%',
                backgroundColor: currentTab === 'admin' ? '#0f172a' : '#f1f5f9',
                color: currentTab === 'admin' ? '#ffffff' : '#475569',
                border: 'none',
              }}
            >
              <ShieldAlert size={16} />
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
              transition={{ type: 'spring', stiffness: 350, damping: 25, mass: 0.8 }}
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
                {(currentUser || isRegisteredUser) ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <UserAvatar user={currentUser || { displayName: 'G' }} size={30} fontSize={13} />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser ? (currentUser.displayName || currentUser.email?.split('@')[0]) : 'Guest Access'}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {currentUser ? currentUser.email : 'Local Session'}
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
                    onClick={() => { setMobileMenuOpen(false); openAuthModal(() => handleTopTabClick('dashboard')); }}
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
                {activeNav === 'overview' && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleViewDetailedDashboard();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 700,
                      backgroundColor: '#f0f9ff',
                      color: '#0284c7',
                      cursor: 'pointer',
                      textAlign: 'left',
                      boxShadow: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ArrowUpRight style={{ width: 18, height: 18 }} />
                    <span>View Dashboard</span>
                  </button>
                )}

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
      <main className="app-main" style={{ minHeight: 'calc(100vh - 140px)', paddingBottom: 60 }}>
        {children}
        
        {/* ─── Global Footer (Contact Us) ─── */}
        <div style={{
          marginTop: 40,
          marginBottom: 20,
          textAlign: 'center',
          position: 'relative',
          zIndex: 2,
        }}>
          <button
            onClick={() => setIsContactModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 13.5,
              fontWeight: 700,
              color: '#64748b',
              cursor: 'pointer',
              textDecoration: 'underline',
              textDecorationColor: '#cbd5e1',
              textUnderlineOffset: 4,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#00bfa5'; e.currentTarget.style.textDecorationColor = '#00bfa5'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.textDecorationColor = '#cbd5e1'; }}
          >
            Contact Us
          </button>
        </div>
      </main>

      {/* ─── Native Mobile Bottom Navigation Bar (<768px) ─── */}
      {/* Only show bottom nav after sign-in; hide on the overview/landing page for guests */}
      {(currentUser || isRegisteredUser || activeNav !== 'overview') && (
        <nav className="mobile-bottom-nav">
          {NAV_ITEMS.map((tab) => {
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
                <span className="mobile-bottom-nav-label">{tab.mobileLabel || tab.label}</span>
              </motion.button>
            );
          })}
        </nav>
      )}

      {/* ─── Firebase Auth Modal ─── */}
      <AuthModal />

      {/* ─── Contact Us Developer Modal ─── */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div style={{ position: 'fixed', zIndex: 100, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsContactModalOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                position: 'relative',
                background: '#ffffff',
                borderRadius: 24,
                padding: '32px 24px',
                maxWidth: 400,
                width: '100%',
                boxShadow: '0 20px 40px rgba(15, 23, 42, 0.1)',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
              }}
            >
              <button
                onClick={() => setIsContactModalOpen(false)}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                <X size={16} />
              </button>
              
              <div style={{ width: 48, height: 48, borderRadius: 16, background: '#e6fcf9', color: '#00bfa5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <UserCheck size={24} />
              </div>


              
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#475569', lineHeight: 1.8 }}>
                Developed by<br/>
                <span style={{ color: '#00bfa5' }}>Manish Kumar</span><br/>
                <span style={{ color: '#00bfa5' }}>Manikanta CH</span><br/>
                <span style={{ color: '#00bfa5' }}>Madan</span><br/>
                <span style={{ color: '#00bfa5' }}>Aditya Thunga K</span><br/>
                <span style={{ color: '#00bfa5' }}>Prathvish Kumar</span>
              </p>
              
              <div style={{ margin: '20px auto', width: 40, height: 2, backgroundColor: '#e2e8f0', borderRadius: 2 }} />

              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#64748b' }}>
                Under the Guidance of<br/>
                <a 
                  href="https://sode-edu.in/smvitm/about-smvitm/principal/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 4, 
                    textDecoration: 'underline', 
                    textUnderlineOffset: 3, 
                    color: '#334155', 
                    transition: 'all 0.2s ease',
                    marginTop: 4
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.color = '#00bfa5'; }}
                  onMouseOut={(e) => { e.currentTarget.style.color = '#334155'; }}
                >
                  <strong style={{ fontSize: 14, color: 'inherit' }}>Dr. Nagaraj Bhat</strong>
                  <ArrowUpRight size={14} style={{ color: 'inherit' }} />
                </a>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
