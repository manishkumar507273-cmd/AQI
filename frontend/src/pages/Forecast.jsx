import { motion } from 'framer-motion';
import { TrendingUp, AlertTriangle, Cpu, Zap } from 'lucide-react';

export default function Forecast() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#ffffff', width: '100%', boxSizing: 'border-box' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
          Forecasting &amp; Trend Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 3 }}>
          Machine learning telemetry forecasting and atmospheric projections
        </p>
      </motion.div>

      {/* Dark Slate Hero Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{
          backgroundColor: '#131e2b',
          borderRadius: 24,
          padding: '28px 32px',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Predictive Model Status
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ffffff' }}>
            Inference Engine <span style={{ color: '#fbbf24', fontSize: 16, fontWeight: 600 }}>[ Standby ]</span>
          </div>
        </div>

        <div style={{
          backgroundColor: '#182638',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '14px 20px',
          fontSize: 13,
          color: '#ffffff',
        }}>
          ⚡ Target Latency: <strong style={{ color: '#00bfa5' }}>&lt; 50ms</strong>
        </div>
      </motion.div>

      {/* Dark Slate Main Notice Card */}
      <div style={{
        backgroundColor: '#131e2b',
        borderRadius: 24,
        padding: '48px 32px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: 'rgba(251, 191, 36, 0.15)',
          color: '#fbbf24',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle style={{ width: 28, height: 28 }} />
        </div>

        <div style={{ maxWidth: 500 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Predictive Model Integration Required
          </h2>
          <p style={{ fontSize: 13.5, color: '#94a3b8', marginTop: 8, lineHeight: 1.6 }}>
            The forecasting engine is pending connection to a trained machine learning model. Real-time predictive telemetry, trend projections, and atmospheric risk modeling will be rendered here once integrated.
          </p>
        </div>

        {/* Dark Slate Status Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 700, marginTop: 12 }}>
          {[
            { badgeBg: 'rgba(56, 189, 248, 0.12)', badgeText: '#38bdf8', icon: Cpu, label: 'ML Model', status: 'Pending' },
            { badgeBg: 'rgba(129, 140, 248, 0.12)', badgeText: '#818cf8', icon: Zap, label: 'Inference API', status: 'Pending' },
            { badgeBg: 'rgba(251, 191, 36, 0.12)', badgeText: '#fbbf24', icon: TrendingUp, label: 'Forecast Engine', status: 'Pending' },
          ].map(({ badgeBg, badgeText, icon: Icon, label, status }) => (
            <div key={label} style={{
              backgroundColor: '#182638',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: '16px 18px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon style={{ width: 18, height: 18, color: badgeText }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
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
