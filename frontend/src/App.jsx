import { useState, useCallback, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Weather from './pages/Weather';
import Forecast from './pages/Forecast';
import Historical from './pages/Historical';
import { getCloudLatest } from './api';

const CLOUD_POLL_MS = 5000;

export default function App() {
  const [activeNav, setActiveNav] = useState('home');
  const [activeTab, setActiveTab] = useState('aqi');
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cloudData, setCloudData] = useState(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState(null);
  const [lastCloudId, setLastCloudId] = useState(null);
  const lastIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const poll = () => {
      getCloudLatest()
        .then((res) => {
          if (!isMounted) return;
          const data = res.data?.data;
          if (data) {
            setCloudData(data);
            setCloudError(null);
            if (data.id != null && data.id !== lastIdRef.current) {
              lastIdRef.current = data.id;
              setLastCloudId(data.id);
              setRefreshKey((k) => k + 1);
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
    };

    poll();
    const timer = setInterval(poll, CLOUD_POLL_MS);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const handleDataLoad = useCallback(() => setLoading(false), []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLoading(true);
    getCloudLatest()
      .then((res) => {
        const data = res.data?.data;
        if (data) setCloudData(data);
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
      lastCloudId={lastCloudId}
    >
      <div className="tab-view-container">
        <div className={`tab-view-pane ${activeNav === 'home' && activeTab === 'aqi' ? 'active' : ''}`}>
          <Dashboard
            cloudData={cloudData}
            cloudLoading={cloudLoading}
            cloudError={cloudError}
            onDataLoad={handleDataLoad}
            refreshKey={refreshKey}
            onNavigateToWeather={() => setActiveTab('weather')}
          />
        </div>

        <div className={`tab-view-pane ${activeNav === 'home' && activeTab === 'weather' ? 'active' : ''}`}>
          <Weather
            cloudData={cloudData}
            cloudLoading={cloudLoading}
            cloudError={cloudError}
            refreshKey={refreshKey}
          />
        </div>

        <div className={`tab-view-pane ${activeNav === 'forecast' ? 'active' : ''}`}>
          <Forecast refreshKey={refreshKey} />
        </div>

        <div className={`tab-view-pane ${activeNav === 'historical' ? 'active' : ''}`}>
          <Historical refreshKey={refreshKey} />
        </div>
      </div>
    </Layout>
  );
}

