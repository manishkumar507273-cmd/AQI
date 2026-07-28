import { TrendingUp, AlertTriangle } from 'lucide-react';

export default function Forecast() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: 'var(--font-sans)', color: '#334155', width: '100%', boxSizing: 'border-box' }}>
      <div>
        <div style={{ fontSize: 13, color: '#0284c7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp style={{ width: 16, height: 16 }} />
          <span>Predictive Intelligence</span>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Forecasting &amp; Trend Analytics
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Machine learning telemetry forecasting and atmospheric projections
        </p>
      </div>

      <div style={{
        background: '#f8fafc',
        borderRadius: 16,
        padding: '56px 24px',
        border: '1px solid #e2e8f0',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          boxShadow: '0 4px 12px rgba(239, 68, 68, 0.12)'
        }}>
          <AlertTriangle style={{ width: 28, height: 28 }} />
        </div>
        
        <div style={{ maxWidth: 520, width: '100%' }}>
          <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Predictive Model Integration Required
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', marginTop: 8, lineHeight: 1.6 }}>
            The forecasting engine is pending connection to a trained machine learning model. Real-time predictive telemetry, trend projections, and atmospheric risk modeling will be rendered here once integrated.
          </p>
        </div>
      </div>
    </div>
  );
}
