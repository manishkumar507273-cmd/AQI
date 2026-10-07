import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, CheckCircle, AlertCircle, ShieldCheck, Lock, Building2, User, Mail, Database, Server, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { submitDataRequest } from '../firebase';

export default function DataRequestModal({ 
  isOpen, 
  onClose, 
  datasetType,
  availableYears = [2026],
  periodOptions = [],
  selectedYear,
  onYearChange,
  selectedMonths = [],
  onMonthsChange
}) {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    name: currentUser?.displayName || '',
    email: currentUser?.email || '',
    organization: '',
    industry: '',
    purpose: '',
    agreedToTerms: false
  });
  
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agreedToTerms) {
      setErrorMsg('You must agree to the Data License Agreement to proceed.');
      return;
    }
    
    setStatus('submitting');
    setErrorMsg('');

    try {
      const periodLabels = selectedMonths.length > 0 
        ? selectedMonths.map(m => periodOptions.find(o => o.value === m)?.label).filter(Boolean).join(', ')
        : 'None selected';
      await submitDataRequest(currentUser, {
        ...formData,
        dataset: `${datasetType === 'aqi' ? 'AQI' : 'Meteorological'} Year ${selectedYear} (${periodLabels}) Dataset`,
      });
      setStatus('success');
    } catch (err) {
      console.error('Data request error:', err);
      setErrorMsg('Failed to submit request. Please try again.');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  const inputStyle = { 
    width: '100%', 
    padding: '12px 16px 12px 42px', 
    backgroundColor: '#f8fafc', 
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 14, 
    color: '#0f172a',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'all 0.2s',
    fontWeight: 500
  };

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 };

  const inputIconWrapper = { position: 'relative', width: '100%' };
  const inputIconStyle = { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 20px',
        overflowY: 'auto'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="data-request-modal"
          style={{ margin: 'auto', maxWidth: 600, width: '100%', background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}
        >
          {/* Header */}
          <div className="data-request-modal-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <ShieldCheck size={28} color="#00bfa5" />
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' }}>
                  Enterprise Data Access Request
                </h2>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} /> Secure Authorization Portal
              </p>
            </div>
            <button 
              onClick={onClose} 
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <X size={20} color="#ffffff" />
            </button>
          </div>

          <div className="data-request-modal-body">
            {status === 'success' ? (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12 }}>
                  <CheckCircle size={72} color="#00bfa5" style={{ margin: '0 auto 20px' }} />
                </motion.div>
                <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 12px 0' }}>Request Successfully Logged</h3>
                <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.6, marginBottom: 32, maxWidth: 450, margin: '0 auto 32px' }}>
                  Your authorization request for the <strong>{datasetType === 'aqi' ? 'AQI Telemetry' : 'Meteorological'} Dataset</strong> has been submitted. 
                  Our data governance team will review your application. Upon approval, the secure payload will be dispatched to <strong>{formData.email}</strong>.
                </p>
                <button
                  onClick={onClose}
                  style={{
                    padding: '14px 32px', backgroundColor: '#0f172a', border: 'none', borderRadius: 12,
                    color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: 15,
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)', transition: 'transform 0.1s'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {errorMsg && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: 12, color: '#dc2626', fontSize: 14, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600 }}>
                    <AlertCircle size={18} /> {errorMsg}
                  </motion.div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Dataset Year *</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        style={{...inputStyle, cursor: 'pointer', appearance: 'none', fontFamily: 'var(--font-mono)' }}
                        onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                      >
                        {availableYears.map((yr) => (
                          <option key={yr} value={yr}>{yr}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 2, position: 'relative' }}>
                      <label style={labelStyle}>Dataset Period (Select Months) *</label>
                      <div 
                        onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                        style={{
                          ...inputStyle,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: '#ffffff'
                        }}
                      >
                        <span style={{ color: selectedMonths.length > 0 ? '#0f172a' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedMonths.length > 0 
                            ? selectedMonths.map(m => periodOptions.find(o => o.value === m)?.label).filter(Boolean).join(', ')
                            : 'Select months...'}
                        </span>
                        <ChevronDown size={18} color="#64748b" style={{ transform: isMonthDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                      </div>

                      <AnimatePresence>
                        {isMonthDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 8,
                              padding: '12px 16px',
                              backgroundColor: '#ffffff',
                              border: '1.5px solid #e2e8f0',
                              borderRadius: 12,
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                              maxHeight: 200,
                              overflowY: 'auto',
                              zIndex: 10
                            }}
                          >
                            {periodOptions.length === 0 ? (
                              <span style={{ fontSize: 13, color: '#94a3b8' }}>No recorded data</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {periodOptions.map((m) => (
                                  <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0f172a', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox"
                                      checked={selectedMonths.includes(m.value)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          onMonthsChange([...selectedMonths, m.value].sort((a, b) => a - b));
                                        } else {
                                          onMonthsChange(selectedMonths.filter(val => val !== m.value));
                                        }
                                      }}
                                      style={{ accentColor: '#00bfa5', width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                    {m.label}
                                  </label>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Full Name *</label>
                    <div style={inputIconWrapper}>
                      <User size={18} style={inputIconStyle} />
                      <input
                        required type="text" name="name" value={formData.name} onChange={handleChange}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Corporate Email *</label>
                    <div style={inputIconWrapper}>
                      <Mail size={18} style={inputIconStyle} />
                      <input
                        required type="email" name="email" value={formData.email} onChange={handleChange}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Organization / Institution *</label>
                    <div style={inputIconWrapper}>
                      <Building2 size={18} style={inputIconStyle} />
                      <input
                        required type="text" name="organization" value={formData.organization} onChange={handleChange}
                        style={inputStyle}
                        onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Industry *</label>
                    <select
                      required name="industry" value={formData.industry} onChange={handleChange}
                      style={{...inputStyle, paddingLeft: 16, cursor: 'pointer', appearance: 'none' }}
                      onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                    >
                      <option value="" disabled>Select Industry</option>
                      <option value="Enterprise / Corporate">Enterprise / Corporate</option>
                      <option value="Government / Public Sector">Government / Public Sector</option>
                      <option value="Academic / Research">Academic / Research</option>
                      <option value="Student">Student</option>
                      <option value="Non-Profit">Non-Profit</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Intended Use Case *</label>
                  <textarea
                    required name="purpose" value={formData.purpose} onChange={handleChange}
                    style={{ ...inputStyle, paddingLeft: 16, minHeight: 90, resize: 'vertical' }}
                    placeholder="Describe your operational or analytical requirements for this telemetry data..."
                    onFocus={e => { e.target.style.borderColor = '#00bfa5'; e.target.style.backgroundColor = '#ffffff'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.backgroundColor = '#f8fafc'; }}
                  />
                </div>

                <div style={{ marginBottom: 32, padding: '16px 20px', backgroundColor: '#f1f5f9', borderLeft: '4px solid #00bfa5', borderRadius: '0 12px 12px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      name="agreedToTerms" 
                      checked={formData.agreedToTerms} 
                      onChange={handleChange}
                      style={{ marginTop: 2, accentColor: '#00bfa5', width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                      <strong style={{ color: '#0f172a' }}>Data Governance Agreement:</strong> I acknowledge that this dataset is proprietary. I agree to abide by the Data Privacy Framework and confirm that this data will not be redistributed, monetized, or utilized for competitive benchmarking without explicit written consent.
                    </span>
                  </label>
                </div>

                <div className="data-request-buttons">
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    style={{
                      flex: 1, padding: '14px 24px', border: 'none', borderRadius: 12,
                      background: '#00bfa5', color: '#ffffff', fontWeight: 800, fontSize: 15,
                      cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      opacity: status === 'submitting' ? 0.7 : 1,
                      boxShadow: '0 4px 14px rgba(0, 191, 165, 0.3)',
                      transition: 'transform 0.1s'
                    }}
                    onMouseOver={e => !status.submitting && (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseOut={e => !status.submitting && (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {status === 'submitting' ? 'Processing...' : 'Submit Request securely'}
                    {!status === 'submitting' && <Send size={18} />}
                  </button>
                  
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={status === 'submitting'}
                    style={{
                      flex: 1, padding: '14px 28px', border: '1.5px solid #e2e8f0', borderRadius: 12,
                      background: '#ffffff', color: '#64748b', fontWeight: 700, fontSize: 15,
                      cursor: status === 'submitting' ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    onMouseOut={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
