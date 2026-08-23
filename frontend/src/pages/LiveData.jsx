import { useState } from 'react';
import { motion } from 'framer-motion';
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
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '5px',
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
          gap: 6,
        }}>
          <button
            onClick={() => setSubTab('aqi')}
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
            <span style={{ zIndex: 1 }}>AQI Dashboard</span>
          </button>

          <button
            onClick={() => setSubTab('weather')}
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
            <span style={{ zIndex: 1 }}>Weather Telemetry</span>
          </button>
        </div>
      </div>

      {/* Render Selected View */}
      {currentSubTab === 'aqi' ? (
        <Dashboard
          cloudData={cloudData}
          cloudLoading={cloudLoading}
          cloudError={cloudError}
          onDataLoad={onDataLoad}
          refreshKey={refreshKey}
          selectedStation={selectedStation}
        />
      ) : (
        <Weather
          cloudData={cloudData}
          cloudLoading={cloudLoading}
          cloudError={cloudError}
          refreshKey={refreshKey}
          selectedStation={selectedStation}
        />
      )}
    </div>
  );
}
