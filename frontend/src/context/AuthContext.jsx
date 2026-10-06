import { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  loginWithGoogle as fbLoginWithGoogle, 
  loginWithEmail as fbLoginWithEmail, 
  registerWithEmail as fbRegisterWithEmail, 
  logoutUser as fbLogout 
} from '../firebase';

const AuthContext = createContext({
  currentUser: null,
  loading: true,
  authModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState(null);

  // Read initial state from localStorage to prevent flash of guest state
  const [isRegisteredUser, setIsRegisteredUser] = useState(() => {
    try {
      return localStorage.getItem('SMART_WEATHER_NET_REGISTERED') === 'true';
    } catch (_) { return false; }
  });

  useEffect(() => {
    // If the user used the admin bypass, restore their admin session
    const isAdmin = localStorage.getItem('SMART_WEATHER_ADMIN') === 'true';
    if (isAdmin) {
      setCurrentUser({
        uid: 'admin-dev-bypass',
        email: 'admin@local.dev',
        displayName: 'Admin Developer',
      });
      setIsRegisteredUser(true);
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // If we already have an admin bypass session restored, ignore Firebase's null user
      if (localStorage.getItem('SMART_WEATHER_ADMIN') === 'true') {
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      if (user) {
        setIsRegisteredUser(true);
        try {
          localStorage.setItem('SMART_WEATHER_NET_REGISTERED', 'true');
          localStorage.setItem('SMART_WEATHER_NET_USER_EMAIL', user.email || '');
        } catch (_) {}
      } else {
        // Ensure that if Firebase confirms no user is logged in, we lock the dashboard
        setIsRegisteredUser(false);
        try {
          localStorage.removeItem('SMART_WEATHER_NET_REGISTERED');
        } catch (_) {}
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openAuthModal = (callback = null) => {
    setRedirectAfterAuth(() => callback);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setRedirectAfterAuth(null);
  };

  const handleAuthSuccess = () => {
    setIsRegisteredUser(true);
    try {
      localStorage.setItem('SMART_WEATHER_NET_REGISTERED', 'true');
    } catch (_) {}
    setAuthModalOpen(false);
    if (redirectAfterAuth) {
      redirectAfterAuth();
      setRedirectAfterAuth(null);
    }
  };

  const loginWithGoogle = async () => {
    const res = await fbLoginWithGoogle();
    handleAuthSuccess();
    return res;
  };

  const loginWithEmail = async (email, password) => {
    const res = await fbLoginWithEmail(email, password);
    handleAuthSuccess();
    return res;
  };

  const registerWithEmail = async (email, password, displayName = '') => {
    const res = await fbRegisterWithEmail(email, password, displayName);
    handleAuthSuccess();
    return res;
  };

  const loginAsAdmin = () => {
    setCurrentUser({
      uid: 'admin-dev-bypass',
      email: 'admin@local.dev',
      displayName: 'Admin Developer',
    });
    try {
      localStorage.setItem('SMART_WEATHER_ADMIN', 'true');
    } catch (_) {}
    handleAuthSuccess();
  };

  const logout = async () => {
    setIsRegisteredUser(false);
    try {
      localStorage.removeItem('SMART_WEATHER_NET_REGISTERED');
      localStorage.removeItem('SMART_WEATHER_NET_USER_EMAIL');
      localStorage.removeItem('SMART_WEATHER_ADMIN');
    } catch (_) {}
    
    // If it's the admin bypass, just reset state
    if (currentUser?.uid === 'admin-dev-bypass') {
      setCurrentUser(null);
      return;
    }
    return await fbLogout();
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      isRegisteredUser,
      loading,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      loginAsAdmin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
