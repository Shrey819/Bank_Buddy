import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('bankBuddyUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const [isHighContrast, setIsHighContrast] = useState(() => {
    return localStorage.getItem('bankBuddyContrast') === 'true';
  });

  const [loading, setLoading] = useState(true);

  // Apply display mode to html/body elements
  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast', 'dark');
      if (document.body) document.body.classList.add('high-contrast', 'dark');
      localStorage.setItem('bankBuddyContrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast', 'dark');
      if (document.body) document.body.classList.remove('high-contrast', 'dark');
      localStorage.setItem('bankBuddyContrast', 'false');
    }
  }, [isHighContrast]);

  const toggleDisplayMode = (checked) => {
    setIsHighContrast(checked);
  };

  // Verify session on mount with /api/v1/me
  useEffect(() => {
    const verifySession = async () => {
      const token = user?.token || user?.accessToken;
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/v1/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401 || res.status === 403) {
          // Token expired or revoked
          logout();
        } else if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser((prev) => {
              const updated = { ...prev, ...data.user };
              localStorage.setItem('bankBuddyUser', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (err) {
        // Offline / network fallback: preserve existing local state
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (identifier, password, skipOtp = false) => {
    const res = await fetch('/api/v1/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password, skipOtp })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid credentials');
    }
    if (data.accessToken) {
      const userData = {
        token: data.accessToken,
        accessToken: data.accessToken,
        id: data.id,
        name: data.name,
        username: data.username,
        email: data.email,
        crn: data.crn,
        cardNumber: data.cardNumber,
        role: data.role
      };
      setUser(userData);
      localStorage.setItem('bankBuddyUser', JSON.stringify(userData));
    }
    return data;
  };

  const verifyOtp = async (sessionToken, otp) => {
    const res = await fetch('/api/v1/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, otp })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'OTP verification failed');
    }

    const userData = {
      token: data.accessToken,
      accessToken: data.accessToken,
      id: data.id,
      name: data.name,
      username: data.username,
      email: data.email,
      crn: data.crn,
      cardNumber: data.cardNumber,
      role: data.role
    };

    setUser(userData);
    localStorage.setItem('bankBuddyUser', JSON.stringify(userData));
    return userData;
  };

  const signup = async (payload) => {
    const res = await fetch('/api/v1/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }
    return data;
  };

  const logout = async () => {
    const token = user?.token || user?.accessToken;
    if (token) {
      try {
        await fetch('/api/v1/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        });
      } catch (e) {
        console.warn('Logout notification error:', e);
      }
    }
    setUser(null);
    localStorage.removeItem('bankBuddyUser');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user?.token || !!user?.accessToken,
        loading,
        isHighContrast,
        toggleDisplayMode,
        login,
        verifyOtp,
        signup,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
