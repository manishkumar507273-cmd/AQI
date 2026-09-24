import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import LiveData from './pages/LiveData';
import Overview from './pages/Overview';
import Forecast from './pages/Forecast';
import Historical from './pages/Historical';
import { getCloudLatest } from './api';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { currentUser, isRegisteredUser, loading: authLoading } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [activeTab, setActiveTab] = useState('aqi');
  const [selectedStation, setSelectedStation] = useState('station-1');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cloudData, setCloudData] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState(null);
  const [lastCloudId, setLastCloudId] = useState(null);
  const lastIdRef = useRef(null);

  // If user signs out while on an inner page, safely return to overview
  useEffect(() => {
    if (!authLoading && !currentUser && !isRegisteredUser && activeNav !== 'overview') {
      setActiveNav('overview');
    }
  }, [authLoading, currentUser, isRegisteredUser, activeNav]);

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
          initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
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

          {activeNav === 'forecast' && (
            <Forecast refreshKey={refreshKey} selectedStation={selectedStation} />
          )}

          {activeNav === 'historical' && (
            <Historical refreshKey={refreshKey} selectedStation={selectedStation} />
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}
