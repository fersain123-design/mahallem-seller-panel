import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthQuotesPanel from '../components/auth/AuthQuotesPanel';
import AuthSplitLayout from '../components/auth/AuthSplitLayout';
import { authAPI } from '../services/api';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function ResetPasswordScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = useMemo(() => String(location.state?.phone || '').trim(), [location.state]);
  const resetToken = useMemo(() => String(location.state?.resetToken || '').trim(), [location.state]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalı');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      return;
    }

    setLoading(true);

    try {
      await authAPI.resetPassword(phone, resetToken, newPassword, confirmPassword);
      setIsSuccess(true);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Şifre güncellenemedi.'));
    } finally {
      setLoading(false);
    }
  };

  if (!phone || !resetToken) {
    return (
      <AuthSplitLayout left={<AuthQuotesPanel />}>
        <div className="min-h-[62vh] flex items-center">
          <div className="w-full max-w-md seller-surface p-6 sm:p-8">
            <p className="text-sm text-text-secondary">Şifre güncelleme oturumu bulunamadı.</p>
            <button className="seller-btn-primary mt-5 w-full py-2.5" onClick={() => navigate('/forgot-password')}>
              Tekrar Başlat
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout left={<AuthQuotesPanel />}>
      <div className="min-h-[62vh] flex items-center">
        <div className="w-full max-w-md">
          <div className="seller-surface p-6 sm:p-8">
            <button
              type="button"
              className="text-sm font-medium text-text-secondary hover:text-text-primary"
              onClick={() => navigate(-1)}
            >
              ← Geri
            </button>
            {isSuccess ? (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">Şifreniz başarıyla güncellendi</h1>
                <button className="seller-btn-primary mt-6 w-full py-2.5" onClick={() => navigate('/login')}>
                  Giriş Yap
                </button>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold tracking-tight text-text-primary">Yeni Şifre Oluştur</h1>
                <p className="text-sm text-text-secondary mt-1">Yeni şifrenizi belirleyin.</p>

                {error ? (
                  <div className="mt-5 rounded-xl border border-error/25 bg-error/5 p-4 text-error text-sm">{error}</div>
                ) : null}

                <form onSubmit={handleSubmit} className="space-y-5 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Yeni Şifre</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="seller-input"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Şifre Tekrar</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="seller-input"
                      required
                    />
                  </div>

                  <button type="submit" disabled={loading} className="seller-btn-primary w-full py-2.5">
                    {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
