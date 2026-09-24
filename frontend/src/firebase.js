import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
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

const firebaseConfig = {
  apiKey: "AIzaSyC8UYQMhOaS5SFAdkCcdISTkEWw57WsmFs",
  authDomain: "smart-air-net.firebaseapp.com",
  databaseURL: "https://smart-air-net-default-rtdb.firebaseio.com",
  projectId: "smart-air-net",
  storageBucket: "smart-air-net.firebasestorage.app",
  messagingSenderId: "647061464752",
  appId: "1:647061464752:web:349c77286659f3a9d4fd75",
  measurementId: "G-09JTD9RQQJ"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistent browser local storage
export const auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase persistence warning:', err);
  });
}

// Initialize Realtime Database (RTDB)
export const rtdb = getDatabase(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Analytics if supported
export let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

/**
 * Sync user profile to Realtime Database in background (non-blocking)
 */
export const syncUserProfile = async (user, extraData = {}) => {
  if (!user || !user.uid) return null;

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
    console.warn('Realtime Database profile sync note:', rtdbErr?.message || rtdbErr);
  }

  return profileData;
};

/**
 * Log user actions to Realtime Database in background (non-blocking)
 */
export const logUserActivity = async (user, action, details = {}) => {
  if (!user || !user.uid) return;

  const nowIso = new Date().toISOString();
  const logEntry = {
    uid: user.uid,
    email: user.email || '',
    action, // 'login', 'register', 'dataset_download', etc.
    details,
    timestamp: nowIso,
  };

  try {
    const logsRtdbRef = rtdbRef(rtdb, 'activity_logs');
    const newLogRef = rtdbPush(logsRtdbRef);
    await rtdbSet(newLogRef, logEntry);
  } catch (rtdbLogErr) {
    console.warn('Realtime Database log note:', rtdbLogErr?.message || rtdbLogErr);
  }
};

// Authentication Helper Functions (Fast & non-blocking)
export const loginWithGoogle = async () => {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    // Background sync to RTDB without blocking modal resolution
    syncUserProfile(result.user, { provider: 'google.com' }).catch(() => {});
    logUserActivity(result.user, 'login', { method: 'google' }).catch(() => {});
  }
  return result;
};

export const registerWithEmail = async (email, password, displayName = '') => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (userCredential.user) {
    if (displayName) {
      try {
        await updateProfile(userCredential.user, { displayName });
      } catch (_) {}
    }
    syncUserProfile(userCredential.user, { displayName, provider: 'password' }).catch(() => {});
    logUserActivity(userCredential.user, 'register', { method: 'email', displayName }).catch(() => {});
  }
  return userCredential;
};

export const loginWithEmail = async (email, password) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  if (result.user) {
    syncUserProfile(result.user, { provider: 'password' }).catch(() => {});
    logUserActivity(result.user, 'login', { method: 'email' }).catch(() => {});
  }
  return result;
};

export const logoutUser = async () => {
  const current = auth.currentUser;
  if (current) {
    logUserActivity(current, 'logout', {}).catch(() => {});
  }
  return await firebaseSignOut(auth);
};

export { onAuthStateChanged };
export default app;
