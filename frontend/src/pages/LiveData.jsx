import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CloudSun } from 'lucide-react';
import Dashboard from './Dashboard';
import Weather from './Weather';

export default function LiveData({
  cloudData,
  cloudLoading,
  cloudError,
  onDataLoad,
  refreshKey,
  selectedStation = 'station-1',
  activeSubTab = 'aqi',
  onSubTabChange,
}) {
  const [internalSubTab, setInternalSubTab] = useState('aqi');
  const currentSubTab = onSubTabChange ? activeSubTab : internalSubTab;
  const setSubTab = onSubTabChange || setInternalSubTab;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Sub-Navigation Selector inside Live Data Stream Page */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
      }}>
        <div className="subtab-pill-container" style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '5px',
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
          gap: 6,
          maxWidth: '100%',
        }}>
          <button
            onClick={() => setSubTab('aqi')}
            className="subtab-pill-btn"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: currentSubTab === 'aqi' ? '#ffffff' : '#64748b',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {currentSubTab === 'aqi' && (
              <motion.div
                layoutId="liveSubTabPill"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#00bfa5',
                  borderRadius: 999,
                  boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                  zIndex: 0,
                }}
              />
            )}
            <Activity style={{ width: 17, height: 17, zIndex: 1 }} />
            <span style={{ zIndex: 1 }} className="desktop-only-inline">AQI Live Telemetry</span>
            <span style={{ zIndex: 1 }} className="mobile-only-inline">AQI</span>
          </button>

          <button
            onClick={() => setSubTab('weather')}
            className="subtab-pill-btn"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 24px',
              borderRadius: 999,
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: currentSubTab === 'weather' ? '#ffffff' : '#64748b',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {currentSubTab === 'weather' && (
              <motion.div
                layoutId="liveSubTabPill"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#00bfa5',
                  borderRadius: 999,
                  boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                  zIndex: 0,
                }}
              />
            )}
            <CloudSun style={{ width: 17, height: 17, zIndex: 1 }} />
            <span style={{ zIndex: 1 }} className="desktop-only-inline">Weather Live Telemetry</span>
            <span style={{ zIndex: 1 }} className="mobile-only-inline">Weather</span>
          </button>
        </div>

      </div>

      {/* Render Selected View */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentSubTab}
          initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: '100%' }}
        >
          {currentSubTab === 'aqi' && (
            <Dashboard
              cloudData={cloudData}
              cloudLoading={cloudLoading}
              cloudError={cloudError}
              onDataLoad={onDataLoad}
              refreshKey={refreshKey}
              selectedStation={selectedStation}
            />
          )}

          {currentSubTab === 'weather' && (
            <Weather
              cloudData={cloudData}
              cloudLoading={cloudLoading}
              cloudError={cloudError}
              refreshKey={refreshKey}
              selectedStation={selectedStation}
            />
          )}


        </motion.div>
      </AnimatePresence>
    </div>
  );
}
