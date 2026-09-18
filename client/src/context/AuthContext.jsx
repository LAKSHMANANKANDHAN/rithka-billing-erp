import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('rithka_token');
    const savedUser = localStorage.getItem('rithka_user');

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        // Verify with backend
        api.get('/auth/me')
          .then(res => {
            if (res.data?.user) {
              setUser(res.data.user);
              localStorage.setItem('rithka_user', JSON.stringify(res.data.user));
            }
          })
          .catch(() => {
            setUser(null);
            localStorage.removeItem('rithka_token');
            localStorage.removeItem('rithka_user');
          })
          .finally(() => setLoading(false));
      } catch (e) {
        setUser(null);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      localStorage.setItem('rithka_token', res.data.token);
      localStorage.setItem('rithka_user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.message || 'Login failed');
  };

  const logout = () => {
    localStorage.removeItem('rithka_token');
    localStorage.removeItem('rithka_user');
    setUser(null);
  };

  const isOwner = user?.role === 'owner';
  const isWorker = user?.role === 'worker';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOwner, isWorker }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
