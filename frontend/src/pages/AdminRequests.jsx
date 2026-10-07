import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, Mail, Server, Trash2, Send, Building2, Briefcase, Download, AlertCircle, Info } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref as rtdbRef, onValue, update, remove } from 'firebase/database';
import { useAuth } from '../context/AuthContext';
import { sendDatasetEmail, downloadHistoricalDataset } from '../api';

const parseDatasetRequest = (datasetStr = '') => {
  const isWeather = /meteo|weather/i.test(datasetStr);
  const category = isWeather ? 'weather' : 'aqi';
  const yearMatch = datasetStr.match(/\b(202[0-9])\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;
  
  const monthNames = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };
  let month = null;
  const lower = datasetStr.toLowerCase();
  for (const [mName, mNum] of Object.entries(monthNames)) {
    if (lower.includes(mName)) {
      month = mNum;
      break;
    }
  }
  return { category, year, month };
};

export default function AdminRequests() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (!rtdb) {
      setLoading(false);
      return;
    }
    const requestsRef = rtdbRef(rtdb, 'data_requests');
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const parsed = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        parsed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(parsed);
      } else {
        setRequests([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firebase read error:', error);
      setErrorMsg('Failed to fetch requests: ' + error.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (req) => {
    setActionInProgress(req.id);
    setFeedback(null);
    try {
      const { category, year, month } = parseDatasetRequest(req.dataset);

      // 1. Dispatch dataset CSV via backend email service
      let emailResult = { email_sent: false, message: '' };
      try {
        let idToken = null;
        try { idToken = currentUser ? await currentUser.getIdToken() : null; } catch (_) {}
        emailResult = await sendDatasetEmail({
          recipient_email: req.email,
          recipient_name: req.name || 'Researcher',
          dataset_name: req.dataset || 'Atmospheric Dataset',
          category,
          year,
          month,
          purpose: req.purpose || '',
          requestId: req.id,
          idToken
        });
      } catch (emailErr) {
        console.warn('Send email note:', emailErr);
        emailResult = {
          email_sent: false,
          message: emailErr.response?.data?.message || emailErr.response?.data?.detail || emailErr.message || 'Email delivery failed'
        };
      }

      // 2. Update Firebase status
      const reqRef = rtdbRef(rtdb, `data_requests/${req.id}`);
      await update(reqRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        emailStatus: emailResult.email_sent ? 'sent' : 'pending_smtp',
        emailMessage: emailResult.message || (emailResult.email_sent ? 'Delivered via SMTP' : 'Requires SMTP config')
      });

      if (emailResult.email_sent) {
        setFeedback({
          type: 'success',
          message: `Request approved! Dataset CSV (${emailResult.filename || 'dataset.csv'}) was successfully emailed to ${req.email}.`
        });
      } else if (emailResult.requires_smtp_config) {
        setFeedback({
          type: 'warning',
          message: `Request approved, but the email was not sent: ${emailResult.message || 'SMTP_USER & SMTP_PASSWORD are not configured.'} You can click "Download CSV" below to send it manually.`
        });
      } else {
        setFeedback({
          type: 'notice',
          message: `Request approved! Notice: ${emailResult.message}`
        });
      }
      
    } catch (err) {
      console.error('Failed to approve request', err);
      setFeedback({
        type: 'error',
        message: 'Error approving request: ' + err.message
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDownloadDataset = async (req) => {
    setDownloadingId(req.id);
    try {
      const { category, year, month } = parseDatasetRequest(req.dataset);
      await downloadHistoricalDataset({ category, year, month: month || 'all' });
    } catch (err) {
      alert('Error downloading dataset CSV: ' + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleReject = async (id) => {
    setActionInProgress(id);
    try {
      const reqRef = rtdbRef(rtdb, `data_requests/${id}`);
      await update(reqRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
      setFeedback({ type: 'info', message: 'Request marked as rejected.' });
    } catch (err) {
      console.error('Failed to reject request', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this request?')) return;
    try {
      const reqRef = rtdbRef(rtdb, `data_requests/${id}`);
      await remove(reqRef);
    } catch (err) {
      console.error('Failed to delete request', err);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Requests...</div>;
  if (errorMsg) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{errorMsg}</div>;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShieldAlert size={28} color="#00bfa5" />
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Admin: Dataset Requests</h1>
        </div>
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              borderRadius: 12,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13.5,
              fontWeight: 500,
              background: feedback.type === 'success' ? '#f0fdf4' : feedback.type === 'warning' ? '#fffbeb' : '#fef2f2',
              border: feedback.type === 'success' ? '1px solid #bbf7d0' : feedback.type === 'warning' ? '1px solid #fef08a' : '1px solid #fecaca',
              color: feedback.type === 'success' ? '#15803d' : feedback.type === 'warning' ? '#854d0e' : '#b91c1c'
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <div style={{ flex: 1 }}>{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {requests.length === 0 ? (
        <div style={{ padding: 40, background: '#f8fafc', borderRadius: 16, textAlign: 'center', color: '#64748b' }}>
          <Server size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          <p>No dataset requests found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {requests.map(req => (
            <motion.div 
              key={req.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 16,
                padding: '20px 24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{req.name || 'Anonymous User'}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, fontSize: 13, color: '#475569' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> {req.email}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={14} /> {req.organization || 'No Org'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={14} /> {req.industry || 'No Industry'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {req.status === 'pending' && <span style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Pending</span>}
                  {req.status === 'approved' && <span style={{ padding: '6px 12px', background: '#dcfce7', color: '#15803d', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Approved</span>}
                  {req.status === 'rejected' && <span style={{ padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Rejected</span>}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 13.5, color: '#334155' }}>
                <strong style={{ color: '#0f172a' }}>Dataset Requested:</strong> {req.dataset}<br/><br/>
                <strong style={{ color: '#0f172a' }}>Intended Use Case:</strong><br/>
                {req.purpose || 'No use case provided'}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                {/* Instant Download Action */}
                <button
                  onClick={() => handleDownloadDataset(req)}
                  disabled={downloadingId === req.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: downloadingId === req.id ? 'wait' : 'pointer',
                    fontSize: 13
                  }}
                  title="Download the requested dataset CSV directly"
                >
                  <Download size={15} />
                  {downloadingId === req.id ? 'Generating...' : 'Download CSV'}
                </button>

                {req.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleReject(req.id)}
                      disabled={actionInProgress === req.id}
                      style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => handleApprove(req)}
                      disabled={actionInProgress === req.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00bfa5', border: 'none', color: '#ffffff', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      <CheckCircle2 size={16} />
                      {actionInProgress === req.id ? 'Processing...' : 'Approve & Send Email'}
                    </button>
                  </>
                )}
                <button 
                  onClick={() => handleDelete(req.id)}
                  style={{ padding: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 8, cursor: 'pointer' }}
                  title="Delete Request"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
