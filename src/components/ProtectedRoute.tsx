import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-text-secondary">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is vendor
  if (user && user.role !== 'vendor') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-error/20 rounded-full mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-primary mb-3">Erişim Reddedildi</h2>
          <p className="text-text-secondary text-lg mb-6">
            Bu panele sadece satıcılar erişebilir.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-600 transition-all font-semibold"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  // Check if vendor status is approved
  if (user && user.status && user.status !== 'approved') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-warning/20 rounded-full mb-6">
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-2xl font-bold text-primary mb-3">Hesabınız İnceleniyor</h2>
          <p className="text-text-secondary text-lg mb-6">
            Hesabınız şu anda inceleme aşamasında. Onaylandığında size email ile bildirilecektir.
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-600 transition-all font-semibold"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
