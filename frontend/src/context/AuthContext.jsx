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

  // Check if device was previously authenticated / registered
  const [isRegisteredUser, setIsRegisteredUser] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('SMART_WEATHER_NET_REGISTERED') === 'true';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsRegisteredUser(true);
        try {
          localStorage.setItem('SMART_WEATHER_NET_REGISTERED', 'true');
          localStorage.setItem('SMART_WEATHER_NET_USER_EMAIL', user.email || '');
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
    if (res) handleAuthSuccess(); // null on mobile redirect — handled by getRedirectResult
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

  const logout = async () => {
    setIsRegisteredUser(false);
    try {
      localStorage.removeItem('SMART_WEATHER_NET_REGISTERED');
      localStorage.removeItem('SMART_WEATHER_NET_USER_EMAIL');
    } catch (_) {}
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
