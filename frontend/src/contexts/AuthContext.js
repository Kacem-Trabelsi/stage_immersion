// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/apiService';

const AuthContext = createContext();

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('[AuthContext] checkAuthStatus: token in localStorage:', token);
      if (token) {
        const response = await authAPI.verifyToken();
        if (response.data.success) {
          setUser(response.data.data.user);
          setIsAuthenticated(true);
          console.log('[AuthContext] checkAuthStatus: user authenticated');
        } else {
          localStorage.removeItem('token');
          setUser(null);
          setIsAuthenticated(false);
          console.log('[AuthContext] checkAuthStatus: token invalid, set unauthenticated');
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        console.log('[AuthContext] checkAuthStatus: no token, set unauthenticated');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setUser(null);
      setIsAuthenticated(false);
      console.log('[AuthContext] checkAuthStatus: error, set unauthenticated');
    } finally {
      setLoading(false);
    }
  };

  const signin = async (credentials) => {
    try {
      const response = await authAPI.signin(credentials);
      if (response.data.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        setUser(user);
        setIsAuthenticated(true);
        
        // Check if STARTUP user needs to complete company profile
        if (user.role === 'STARTUP') {
          try {
            const profileResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/company-profile/check/${user.id}`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const profileData = await profileResponse.json();
            if (profileData.success && !profileData.data.isProfileComplete) {
              // Profile is incomplete, but we'll let the dashboard handle the modal
              console.log('STARTUP user profile incomplete');
            }
          } catch (profileError) {
            console.error('Error checking profile completion:', profileError);
          }
        }
        
        return { success: true, user };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erreur de connexion' 
      };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await authAPI.signup(userData);
      if (response.data.success) {
        const { token, user } = response.data.data;
        localStorage.setItem('token', token);
        setUser(user);
        setIsAuthenticated(true);
        return { success: true, user };
      }
      return { success: false, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Erreur lors de l\'inscription' 
      };
    }
  };

  const clearAuthState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('selectedChatUser');
    setUser(null);
    setIsAuthenticated(false);
  };

  const signout = async () => {
    try {
      // Call backend signout first while token is still available
      await authAPI.signout();
    } catch (error) {
      console.error('[AuthContext] signout API failed:', error);
    } finally {
      // Always clear client auth state, even if API fails
      clearAuthState();
      console.log('[AuthContext] signout: auth state cleared');
    }
  };

  // Add updateUser function to update user data in context
  const updateUser = (userData) => {
    setUser(prevUser => ({
      ...prevUser,
      ...userData
    }));
    console.log('[AuthContext] updateUser: user data updated', userData);
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    signin,
    signup,
    signout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
