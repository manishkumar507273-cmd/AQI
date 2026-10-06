import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Clock, Mail, Server, Trash2, Send } from 'lucide-react';
import { rtdb } from '../firebase';
import { ref as rtdbRef, onValue, update, remove } from 'firebase/database';
import { useAuth } from '../context/AuthContext';

export default function AdminRequests() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(null);

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
        // Sort by newest first
        parsed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRequests(parsed);
      } else {
        setRequests([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApprove = async (id, reqEmail) => {
    setActionInProgress(id);
    try {
      // 1. Update Firebase
      const reqRef = rtdbRef(rtdb, `data_requests/${id}`);
      await update(reqRef, { status: 'approved', approvedAt: new Date().toISOString() });
      
      // 2. Mock calling backend to send email
      console.log(`[MOCK BACKEND API] Sending dataset via email to ${reqEmail}...`);
      
    } catch (err) {
      console.error('Failed to approve request', err);
      alert('Error approving request: ' + err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (id) => {
    setActionInProgress(id);
    try {
      const reqRef = rtdbRef(rtdb, `data_requests/${id}`);
      await update(reqRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
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

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
        <ShieldAlert size={28} color="#00bfa5" />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>Admin: Dataset Requests</h1>
      </div>

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: '#475569' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={14} /> {req.email}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Server size={14} /> {req.organization || 'No Org'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Status Badge */}
                <div>
                  {req.status === 'pending' && <span style={{ padding: '6px 12px', background: '#fef3c7', color: '#d97706', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Pending</span>}
                  {req.status === 'approved' && <span style={{ padding: '6px 12px', background: '#dcfce7', color: '#15803d', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Approved</span>}
                  {req.status === 'rejected' && <span style={{ padding: '6px 12px', background: '#fee2e2', color: '#b91c1c', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Rejected</span>}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 10, fontSize: 13.5, color: '#334155' }}>
                <strong style={{ color: '#0f172a' }}>Dataset Requested:</strong> {req.dataset}<br/><br/>
                <strong style={{ color: '#0f172a' }}>Purpose:</strong><br/>
                {req.purpose || 'No purpose provided'}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
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
                      onClick={() => handleApprove(req.id, req.email)}
                      disabled={actionInProgress === req.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#00bfa5', border: 'none', color: '#ffffff', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      <CheckCircle2 size={16} />
                      {actionInProgress === req.id ? 'Approving...' : 'Approve & Send Email'}
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
