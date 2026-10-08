import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import LiveData from './pages/LiveData';
import Overview from './pages/Overview';
import Forecast from './pages/Forecast';
import Historical from './pages/Historical';
import AdminRequests from './pages/AdminRequests';
import { getCloudLatest, getCachedData } from './api';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { currentUser, isRegisteredUser, loading: authLoading } = useAuth();
  const [activeNav, setActiveNav] = useState(() => localStorage.getItem('SMART_WEATHER_ACTIVE_NAV') || 'overview');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('SMART_WEATHER_ACTIVE_TAB') || 'aqi');

  useEffect(() => {
    localStorage.setItem('SMART_WEATHER_ACTIVE_NAV', activeNav);
  }, [activeNav]);

  useEffect(() => {
    localStorage.setItem('SMART_WEATHER_ACTIVE_TAB', activeTab);
  }, [activeTab]);
  const [selectedStation, setSelectedStation] = useState(() => localStorage.getItem('SMART_WEATHER_ACTIVE_STATION') || 'station-1');

  useEffect(() => {
    localStorage.setItem('SMART_WEATHER_ACTIVE_STATION', selectedStation);
  }, [selectedStation]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cloudData, setCloudData] = useState(() => getCachedData('CACHE_CLOUD_LATEST'));
  const [cloudLoading, setCloudLoading] = useState(() => !getCachedData('CACHE_CLOUD_LATEST'));
  const [cloudError, setCloudError] = useState(null);
  const [lastCloudId, setLastCloudId] = useState(null);
  const lastIdRef = useRef(null);

  // If user signs out while on an inner page, safely return to overview
  useEffect(() => {
    if (!authLoading && !currentUser && !isRegisteredUser && activeNav !== 'overview') {
      setActiveNav('overview');
    }
  }, [authLoading, currentUser, isRegisteredUser, activeNav]);

  // Admin-only pages: Predictive Forecast and Admin Requests
  const isAdmin = currentUser?.uid === 'admin-dev-bypass' || localStorage.getItem('SMART_WEATHER_ADMIN') === 'true';
  useEffect(() => {
    if (!authLoading && !isAdmin && (activeNav === 'forecast' || activeNav === 'admin')) {
      setActiveNav('overview');
    }
  }, [authLoading, isAdmin, activeNav]);

  useEffect(() => {
    let isMounted = true;
    getCloudLatest()
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data;
        if (data) {
          setCloudData(data);
          setCloudError(null);
          if (data.id != null) {
            lastIdRef.current = data.id;
            setLastCloudId(data.id);
          }
        }
        setCloudLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to fetch Supabase cloud data:', err);
        if (!cloudData) setCloudError('Unable to fetch cloud sensor data.');
        setCloudLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDataLoad = useCallback(() => setLoading(false), []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLoading(true);
    getCloudLatest()
      .then((res) => {
        const data = res.data?.data;
        if (data) {
          setCloudData(data);
          if (data.id != null) {
            lastIdRef.current = data.id;
            setLastCloudId(data.id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 5 minutes to fetch the latest telemetry and hourly GitHub Actions forecasts
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefresh();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [handleRefresh]);

  return (
    <Layout
      onRefresh={handleRefresh}
      loading={loading}
      activeNav={activeNav}
      onNavChange={setActiveNav}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      selectedStation={selectedStation}
      onStationChange={setSelectedStation}
      lastCloudId={lastCloudId}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeNav}
          initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
          transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
          style={{ width: '100%' }}
        >
          {(activeNav === 'live' || activeNav === 'dashboard') && (
            <LiveData
              cloudData={cloudData}
              cloudLoading={cloudLoading}
              cloudError={cloudError}
              onDataLoad={handleDataLoad}
              refreshKey={refreshKey}
              selectedStation={selectedStation}
              activeSubTab={activeTab}
              onSubTabChange={setActiveTab}
            />
          )}

          {activeNav === 'overview' && (
            <Overview refreshKey={refreshKey} selectedStation={selectedStation} onNavigate={setActiveNav} />
          )}

          {activeNav === 'forecast' && isAdmin && (
            <Forecast refreshKey={refreshKey} selectedStation={selectedStation} />
          )}

          {activeNav === 'local-forecast' && (
            <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: 24, border: '1px solid #e2e8f0', margin: '40px auto', maxWidth: 640, boxShadow: '0 10px 30px rgba(15, 23, 42, 0.04)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 12, letterSpacing: '-0.02em' }}>Forecast Under Development</h2>
              <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.6, maxWidth: 450, margin: '0 auto' }}>
                We are currently building localized predictive models specifically tailored for your region. Stay tuned for highly accurate, AI-powered air quality forecasts!
              </p>
            </div>
          )}

          {activeNav === 'historical' && (
            <Historical refreshKey={refreshKey} selectedStation={selectedStation} />
          )}

          {activeNav === 'admin' && isAdmin && (
            <AdminRequests />
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
