import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthQuotesPanel from '../components/auth/AuthQuotesPanel';
import AuthSplitLayout from '../components/auth/AuthSplitLayout';
import { authAPI } from '../services/api';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.forgotPassword(phone);
      navigate('/verify-otp', { state: { phone } });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Doğrulama kodu gönderilemedi.'));
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Şifremi Unuttum</h1>
            <p className="text-sm text-text-secondary mt-1">Telefon numaranızı girin, doğrulama kodunu SMS ile gönderelim.</p>

            {error ? (
              <div className="mt-5 rounded-xl border border-error/25 bg-error/5 p-4 text-error text-sm">{error}</div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5 mt-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Telefon Numarası</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="seller-input"
                  placeholder="05XXXXXXXXX"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="seller-btn-primary w-full py-2.5">
                {loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}
              </button>

              <button
                type="button"
                className="w-full text-sm font-medium text-text-secondary hover:text-text-primary"
                onClick={() => navigate('/login')}
              >
                Girişe dön
              </button>
            </form>
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
