import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getDatabase, 
  ref as rtdbRef, 
  set as rtdbSet, 
  push as rtdbPush 
} from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Default project configuration fallback (ensures production builds on Vercel run without crashing if env vars are unset)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyC8UYQMhOaS5SFAdkCcdISTkEWw57WsmFs",
  authDomain: "smart-air-net.firebaseapp.com",
  databaseURL: "https://smart-air-net-default-rtdb.firebaseio.com",
  projectId: "smart-air-net",
  storageBucket: "smart-air-net.firebasestorage.app",
  messagingSenderId: "647061464752",
  appId: "1:647061464752:web:349c77286659f3a9d4fd75",
  measurementId: "G-09JTD9RQQJ",
};

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL,
  projectId: env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId,
};

let app = null;
let auth = null;
let rtdb = null;
let googleProvider = null;
let analytics = null;
let isFirebaseInitialized = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 5 && !firebaseConfig.apiKey.includes('your_')) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    }
    rtdb = getDatabase(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    isFirebaseInitialized = true;

    if (typeof window !== 'undefined') {
      isSupported().then((supported) => {
        if (supported && app) analytics = getAnalytics(app);
      }).catch(() => {});
    }
  } else {
    console.warn('Firebase apiKey missing. Operating in offline resilient mode.');
  }
} catch (initErr) {
  console.warn('Firebase initialization error caught (resilient mode active):', initErr?.message || initErr);
}

export { auth, rtdb, googleProvider, analytics, isFirebaseInitialized };

/**
 * Safe wrapper around onAuthStateChanged that never throws and always resolves auth state
 */
export const onAuthStateChanged = (authInstance, callback) => {
  if (!authInstance || !isFirebaseInitialized) {
    if (typeof callback === 'function') {
      setTimeout(() => callback(null), 0);
    }
    return () => {};
  }
  try {
    return firebaseOnAuthStateChanged(authInstance, callback);
  } catch (err) {
    console.warn('onAuthStateChanged error caught:', err?.message || err);
    if (typeof callback === 'function') {
      setTimeout(() => callback(null), 0);
    }
    return () => {};
  }
};

/**
 * Sync user profile to Realtime Database in background (non-blocking)
 */
export const syncUserProfile = async (user, extraData = {}) => {
  if (!rtdb || !user || !user.uid) return null;

  const nowIso = new Date().toISOString();
  const provider = user.providerData?.[0]?.providerId || extraData.provider || 'email';
  const displayName = user.displayName || extraData.displayName || user.email?.split('@')[0] || 'User';

  const profileData = {
    uid: user.uid,
    email: user.email || '',
    displayName,
    photoURL: user.photoURL || '',
    provider,
    role: 'viewer',
    lastLoginAt: nowIso,
  };

  try {
    const userRtdbRef = rtdbRef(rtdb, `users/${user.uid}`);
    await rtdbSet(userRtdbRef, profileData);
  } catch (rtdbErr) {
    console.warn('RTDB profile sync note:', rtdbErr?.message || rtdbErr);
  }

  return profileData;
};

/**
 * Log user actions to Realtime Database in background (non-blocking)
 */
export const logUserActivity = async (user, action, details = {}) => {
  if (!rtdb || !user || !user.uid) return;

  const logEntry = {
    uid: user.uid,
    email: user.email || '',
    action,
    details,
    timestamp: new Date().toISOString(),
  };

  try {
    const logsRtdbRef = rtdbRef(rtdb, 'activity_logs');
    const newLogRef = rtdbPush(logsRtdbRef);
    await rtdbSet(newLogRef, logEntry);
  } catch (rtdbLogErr) {
    console.warn('RTDB log note:', rtdbLogErr?.message || rtdbLogErr);
  }
};

// ── Authentication Helpers ──────────────────────────────────────────

export const loginWithGoogle = async () => {
  if (!auth || !googleProvider) {
    throw new Error('Authentication is currently not initialized. Check your Firebase API key.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    syncUserProfile(result.user, { provider: 'google.com' }).catch(() => {});
    logUserActivity(result.user, 'login', { method: 'google' }).catch(() => {});
  }
  return result;
};

export const registerWithEmail = async (email, password, displayName = '') => {
  if (!auth) {
    throw new Error('Authentication is currently not initialized. Check your Firebase API key.');
  }
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    if (displayName) {
      try { await updateProfile(userCredential.user, { displayName }); } catch (_) {}
    }
    syncUserProfile(userCredential.user, { displayName, provider: 'password' }).catch(() => {});
    logUserActivity(userCredential.user, 'register', { method: 'email', displayName }).catch(() => {});
  }
  return userCredential;
};

export const loginWithEmail = async (email, password) => {
  if (!auth) {
    throw new Error('Authentication is currently not initialized. Check your Firebase API key.');
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  if (result.user) {
    syncUserProfile(result.user, { provider: 'password' }).catch(() => {});
    logUserActivity(result.user, 'login', { method: 'email' }).catch(() => {});
  }
  return result;
};

export const logoutUser = async () => {
  if (!auth) return;
  const current = auth.currentUser;
  if (current) logUserActivity(current, 'logout', {}).catch(() => {});
  return await firebaseSignOut(auth);
};

export default app;
