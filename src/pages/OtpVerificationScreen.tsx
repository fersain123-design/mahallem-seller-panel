import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthQuotesPanel from '../components/auth/AuthQuotesPanel';
import AuthSplitLayout from '../components/auth/AuthSplitLayout';
import { authAPI } from '../services/api';
import { getAuthErrorMessage } from '../lib/authErrorMessage';

export default function OtpVerificationScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = useMemo(() => String(location.state?.email || '').trim().toLowerCase(), [location.state]);

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.verifyOtp(email, otpCode);
      const resetToken = response?.data?.data?.resetToken;

      if (!resetToken) {
        throw new Error('Reset oturumu oluşturulamadı');
      }

      navigate('/reset-password', {
        state: {
          email,
          resetToken,
        },
      });
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Doğrulama başarısız oldu.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendLoading(true);

    try {
      await authAPI.forgotPassword(email);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, 'Kod tekrar gönderilemedi.'));
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return (
      <AuthSplitLayout left={<AuthQuotesPanel />}>
        <div className="min-h-[62vh] flex items-center">
          <div className="w-full max-w-md seller-surface p-6 sm:p-8">
            <p className="text-sm text-text-secondary">E-posta bilgisi bulunamadı.</p>
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
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">Kod Doğrulama</h1>
            <p className="text-sm text-text-secondary mt-1">E-postanıza gelen 6 haneli doğrulama kodunu girin.</p>

            {error ? (
              <div className="mt-5 rounded-xl border border-error/25 bg-error/5 p-4 text-error text-sm">{error}</div>
            ) : null}

            <form onSubmit={handleVerify} className="space-y-5 mt-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">6 Haneli Doğrulama Kodu</label>
                <input
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="seller-input tracking-[0.35em]"
                  placeholder="000000"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="seller-btn-primary w-full py-2.5">
                {loading ? 'Doğrulanıyor...' : 'Doğrula'}
              </button>
            </form>

            <button
              type="button"
              disabled={resendLoading}
              className="w-full mt-4 text-sm font-medium text-primary hover:underline"
              onClick={handleResend}
            >
              {resendLoading ? 'Gönderiliyor...' : 'Kodu tekrar gönder'}
            </button>
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
