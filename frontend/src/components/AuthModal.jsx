import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User, Eye, EyeOff, Sparkles, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, loginWithGoogle, loginWithEmail, registerWithEmail, loginAsAdmin } = useAuth();
  
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!authModalOpen) return null;

  const resetState = () => {
    setErrorMsg('');
    setLoading(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrorMsg('');
  };

  const getFriendlyError = (err) => {
    const code = err?.code || '';
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Switch to Sign In.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Incorrect email or password. Please verify and try again.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in was cancelled before completion.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Console. Add your Vercel domain under Authentication > Settings > Authorized domains.';
    }
    return err?.message || 'Authentication failed. Please try again.';
  };

  const handleGoogleSubmit = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await loginWithGoogle();
      resetState();
    } catch (err) {
      console.error('Google Auth Error:', err);
      setErrorMsg(getFriendlyError(err));
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'admin') {
      if (!password) {
        setErrorMsg('Please enter the bypass code.');
        return;
      }
      if (password === '1234') {
        loginAsAdmin();
        resetState();
      } else {
        setErrorMsg('Incorrect Admin Password.');
      }
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter.');
        return;
      }
    }

    // Developer Admin Bypass (fallback if typed in login)
    if (mode === 'login' && email.trim().toLowerCase() === 'admin' && password === '1234') {
      loginAsAdmin();
      resetState();
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(email.trim(), password, displayName.trim());
      } else {
        await loginWithEmail(email.trim(), password);
      }
      resetState();
    } catch (err) {
      console.error('Email Auth Error:', err);
      setErrorMsg(getFriendlyError(err));
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {/* Backdrop click dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeAuthModal}
          style={{ position: 'absolute', inset: 0 }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: 440,
            backgroundColor: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
            overflow: 'hidden',
            fontFamily: 'var(--font-sans)',
            color: '#0f172a',
          }}
        >
          {/* Top Brand Accent Bar */}
          <div style={{
            height: 4,
            width: '100%',
            background: 'linear-gradient(90deg, #00bfa5 0%, #0284c7 50%, #6366f1 100%)',
          }} />

          {/* Close Button */}
          <button
            onClick={closeAuthModal}
            aria-label="Close dialog"
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={16} />
          </button>

          <div style={{ padding: '26px 28px 24px' }}>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.02em',
                marginBottom: 10,
              }}>
                <Sparkles size={13} color="#16a34a" />
                <span>Dashboard Access</span>
              </div>

              <h2 style={{
                fontSize: 22,
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.03em',
                margin: '0 0 6px',
              }}>
                {mode === 'register' ? 'Create Your Account' : mode === 'admin' ? 'Developer Access' : 'Welcome Back'}
              </h2>

              <p style={{
                fontSize: 13,
                color: '#64748b',
                lineHeight: 1.45,
                margin: 0,
              }}>
                {mode === 'admin' 
                  ? 'Enter the bypass code to unlock local dashboard access without a Firebase account.'
                  : 'Sign in to view real-time live sensor telemetry, historical analysis, and predictive forecasts.'}
              </p>
            </div>

            {mode !== 'admin' && (
              <>
                {/* Google One-Click Login Button */}
            <button
              type="button"
              onClick={handleGoogleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '11px 16px',
                borderRadius: 14,
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '18px 0 14px',
            }}>
              <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                or with email
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            </div>

            {/* Mode Switcher Tabs */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f1f5f9',
              borderRadius: 12,
              padding: 3,
              marginBottom: 16,
            }}>
              <button
                type="button"
                onClick={() => switchMode('register')}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: mode === 'register' ? '#ffffff' : 'transparent',
                  color: mode === 'register' ? '#0f172a' : '#64748b',
                  boxShadow: mode === 'register' ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: mode === 'login' ? '#ffffff' : 'transparent',
                  color: mode === 'login' ? '#0f172a' : '#64748b',
                  boxShadow: mode === 'login' ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Sign In
              </button>
            </div>
            </>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 10,
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Email Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Full Name (Optional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 36px',
                        borderRadius: 11,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#00bfa5'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    />
                  </div>
                </div>
              )}

              {mode !== 'admin' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Email Address
                  </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                  <input
                    type={mode === 'register' ? 'email' : 'text'}
                    required
                    placeholder="name@example.com or admin"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      borderRadius: 11,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#00bfa5'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  />
                </div>
              </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                  {mode === 'admin' ? 'Bypass Code' : 'Password'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={mode === 'admin' ? 'Enter admin code' : mode === 'register' ? 'At least 6 characters' : 'Enter password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 36px',
                      borderRadius: 11,
                      border: '1.5px solid #cbd5e1',
                      fontSize: 13,
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#00bfa5'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: 10,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: 2,
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 5 }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '9px 12px 9px 36px',
                        borderRadius: 11,
                        border: '1.5px solid #cbd5e1',
                        fontSize: 13,
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#00bfa5'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 6,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '11px 16px',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: loading ? '#94a3b8' : '#00bfa5',
                  color: '#ffffff',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 14px rgba(0, 191, 165, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Please wait...</span>
                  </>
                ) : mode === 'register' ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Create Account & Unlock Dashboard</span>
                  </>
                ) : mode === 'admin' ? (
                  <>
                    <Sparkles size={16} />
                    <span>Unlock Dashboard</span>
                  </>
                ) : (
                  <span>Sign In & Unlock Dashboard</span>
                )}
              </button>
            </form>

            {/* Bottom switcher prompt */}
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12.5, color: '#64748b' }}>
              {mode === 'admin' ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#64748b',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Return to Sign In
                </button>
              ) : mode === 'register' ? (
                <>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#0284c7',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Need an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#00bfa5',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Create Account
                  </button>
                </>
              )}
            </div>

            {/* Developer Admin Bypass */}
            {mode !== 'admin' && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => switchMode('admin')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 8px',
                    color: '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Developer Admin Bypass
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
