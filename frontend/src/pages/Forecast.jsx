import { motion } from 'framer-motion';
import { AlertTriangle, Cpu, Zap, TrendingUp } from 'lucide-react';

export default function Forecast() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#0f172a', width: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Forecasting &amp; Trend Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>
          Machine learning telemetry forecasting and atmospheric projections
        </p>
      </motion.div>

      {/* Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 24,
          padding: '28px 32px',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Predictive Model Status
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>
            Inference Engine <span style={{ color: '#d97706', fontSize: 16, fontWeight: 600 }}>[ Standby ]</span>
          </div>
        </div>
      </motion.div>

      {/* Main Notice Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: '48px 32px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: '#fef3c7',
          color: '#d97706',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle style={{ width: 28, height: 28 }} />
        </div>

        <div style={{ maxWidth: 500 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Predictive Model Integration Required
          </h2>
          <p style={{ fontSize: 13.5, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
            The forecasting engine is pending connection to a trained machine learning model. Real-time predictive telemetry, trend projections, and atmospheric risk modeling will be rendered here once integrated.
          </p>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 14, width: '100%', maxWidth: 700, marginTop: 12 }}>
          {[
            { badgeBg: '#e0f2fe', badgeText: '#0284c7', icon: Cpu, label: 'ML Model', status: 'Pending' },
            { badgeBg: '#e0e7ff', badgeText: '#4f46e5', icon: Zap, label: 'Inference API', status: 'Pending' },
            { badgeBg: '#fef3c7', badgeText: '#d97706', icon: TrendingUp, label: 'Forecast Engine', status: 'Pending' },
          ].map(({ badgeBg, badgeText, icon: Icon, label, status }) => (
            <div key={label} style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '16px 18px',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon style={{ width: 18, height: 18, color: badgeText }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{label}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: badgeText, backgroundColor: badgeBg, padding: '3px 9px', borderRadius: 999 }}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
