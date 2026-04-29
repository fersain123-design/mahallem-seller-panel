import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api.js';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await authAPI.getMe();
      const responseData = response.data.data || response.data;
      const vendorData = responseData.vendor || responseData;
      
      const userData = {
        id: vendorData.id,
        email: vendorData.email,
        full_name: vendorData.owner_name || vendorData.store_name,
        store_name: vendorData.store_name,
        role: 'vendor',
        status: vendorData.status,
        ...vendorData
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login(email, password);
    
    const responseData = response.data.data || response.data;
    const { access_token, vendor } = responseData;
    
    if (!access_token || !vendor) {
      throw new Error('Geçersiz yanıt formatı');
    }
    
    if (vendor.status !== 'approved') {
      throw new Error('Hesabınız henüz onaylanmamış. Lütfen onay sürecinin tamamlanmasını bekleyin.');
    }
    
    const userData = {
      id: vendor.id,
      email: vendor.email,
      full_name: vendor.owner_name || vendor.store_name,
      store_name: vendor.store_name,
      role: 'vendor',
      status: vendor.status,
      ...vendor
    };
    
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const refreshVendor = async () => {
    await checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        vendor: user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth,
        refreshVendor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
