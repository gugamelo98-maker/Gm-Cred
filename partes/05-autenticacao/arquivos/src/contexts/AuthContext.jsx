
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authenticateUser } from '@/services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error("Failed to parse auth user", e);
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (identifier, password) => {
    return new Promise((resolve, reject) => {
      // Simulate network delay for realistic feel
      setTimeout(() => {
        try {
          const userData = authenticateUser(identifier, password);
          
          const sessionUser = {
            ...userData,
            loginTime: new Date().toISOString()
          };
          
          setUser(sessionUser);
          localStorage.setItem('auth_user', JSON.stringify(sessionUser));
          resolve(sessionUser);
        } catch (error) {
          reject(error);
        }
      }, 800);
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
  };

  const isAuthenticated = !!user;

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
