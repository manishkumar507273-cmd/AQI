import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, CloudSun, Sparkles } from 'lucide-react';
import Dashboard from './Dashboard';
import Weather from './Weather';
import Overview from './Overview';

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
              padding: '9px clamp(12px, 3.5vw, 24px)',
              borderRadius: 999,
              border: 'none',
              fontSize: 'clamp(12px, 3vw, 14px)',
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
            <span style={{ zIndex: 1 }}>
              <span className="desktop-only-inline">AQI Dashboard</span>
              <span className="mobile-only-inline">Air Quality</span>
            </span>
          </button>

          <button
            onClick={() => setSubTab('weather')}
            className="subtab-pill-btn"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px clamp(12px, 3.5vw, 24px)',
              borderRadius: 999,
              border: 'none',
              fontSize: 'clamp(12px, 3vw, 14px)',
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
            <span style={{ zIndex: 1 }}>
              <span className="desktop-only-inline">Weather Telemetry</span>
              <span className="mobile-only-inline">Weather</span>
            </span>
          </button>

          <button
            onClick={() => setSubTab('overview')}
            className="subtab-pill-btn"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px clamp(12px, 3.5vw, 24px)',
              borderRadius: 999,
              border: 'none',
              fontSize: 'clamp(12px, 3vw, 14px)',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: currentSubTab === 'overview' ? '#ffffff' : '#64748b',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {currentSubTab === 'overview' && (
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
            <Sparkles style={{ width: 17, height: 17, zIndex: 1 }} />
            <span style={{ zIndex: 1 }}>
              <span className="desktop-only-inline">Atmosphere Snapshot</span>
              <span className="mobile-only-inline">Snapshot</span>
            </span>
          </button>
        </div>
      </div>

      {/* Render Selected View */}
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

      {currentSubTab === 'overview' && (
        <Overview
          refreshKey={refreshKey}
          selectedStation={selectedStation}
        />
      )}
    </div>
  );
}
