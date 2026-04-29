import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api.ts';

interface User {
  id: string;
  email: string;
  full_name?: string;
  store_name?: string;
  role: string;
  status?: string;
  [key: string]: any;
}

const normalizeVendorStatus = (status?: string | null) => {
  if (!status) return undefined;
  return String(status).toLowerCase();
};

const toVendorUser = (apiUser: any): User => {
  const vendorProfile = apiUser?.vendorProfile || apiUser?.vendor_profile;
  const createdAtRaw =
    apiUser?.created_at ||
    apiUser?.createdAt ||
    vendorProfile?.created_at ||
    vendorProfile?.createdAt ||
    null;

  return {
    ...apiUser,
    id: apiUser?.id,
    email: apiUser?.email,
    full_name: apiUser?.name,
    store_name: vendorProfile?.shopName || vendorProfile?.storeName || apiUser?.store_name,
    owner_name: apiUser?.name,
    role: 'vendor',
    status: normalizeVendorStatus(vendorProfile?.status),
    created_at: createdAtRaw,
    createdAt: createdAtRaw,
    vendorProfile,
  };
};

const resolveAuthPayload = (raw: any) => {
  const responseData = raw?.data || raw || {};
  const accessToken =
    responseData.accessToken ||
    responseData.access_token ||
    responseData.token ||
    responseData.accessToken?.token;
  const apiUser = responseData.user || responseData.vendor || responseData.account || responseData;
  return { accessToken, apiUser };
};

interface AuthContextType {
  user: User | null;
  vendor: User | null; // alias for user
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshVendor: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
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
      const responseData = response.data?.data || response.data;
      const apiUser = responseData?.user || responseData?.vendor || responseData;
      const role = String(apiUser?.role || '').toLowerCase();
      const hasVendorProfile = Boolean(apiUser?.vendorProfile || apiUser?.vendor_profile);

      if (!apiUser || (!hasVendorProfile && role !== 'vendor')) {
        throw new Error('Bu panele sadece satıcılar erişebilir.');
      }

      const userData = toVendorUser(apiUser);
      
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

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password);
    const { accessToken, apiUser } = resolveAuthPayload(response.data?.data || response.data);

    if (!accessToken || !apiUser) {
      throw new Error('Geçersiz yanıt formatı');
    }

    const role = String(apiUser?.role || '').toLowerCase();
    const hasVendorProfile = Boolean(apiUser?.vendorProfile || apiUser?.vendor_profile);
    if (!hasVendorProfile && role !== 'vendor') {
      throw new Error('Bu panele sadece satıcılar giriş yapabilir.');
    }

    const userData = toVendorUser(apiUser);

    // Check if vendor is approved
    if (userData.status && userData.status !== 'approved') {
      throw new Error('Hesabınız henüz onaylanmamış. Lütfen onay sürecinin tamamlanmasını bekleyin.');
    }

    localStorage.setItem('access_token', accessToken);
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
        vendor: user, // alias for backward compatibility
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
