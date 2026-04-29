import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getTurkishErrorMessage = (err) => {
    const data = err?.response?.data;
    const serverMessage =
      data?.detail ||
      data?.message ||
      (Array.isArray(data?.errors) ? data.errors.join(' ') : undefined) ||
      (typeof data === 'string' ? data : undefined);
    if (serverMessage) return serverMessage;

    const message = err?.message;
    if (!message) return 'Giriş başarısız oldu';
    if (message === 'Network Error') return 'Sunucuya bağlanılamadı. Backend çalışıyor mu?';
    if (/timeout/i.test(message)) return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
    if (/unauthorized/i.test(message)) return 'Yetkisiz işlem. Lütfen tekrar giriş yapın.';
    return message;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(getTurkishErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="bg-white p-2 rounded-xl shadow-md border border-primary/15">
              <img src="/logo.png" alt="MAHALLEM Logo" className="h-16 w-auto" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">Satıcı Paneli</h1>
          <p className="text-text-secondary">Hesabınıza giriş yapın</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error/10 border-2 border-error text-error rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-primary/30 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-primary/30 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="text-right">
            <a href="mailto:destek@mahallem.com" className="text-sm text-primary hover:text-primary-600 font-medium">
              Şifremi Unuttum?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3.5 rounded-xl hover:bg-primary-600 disabled:bg-gray disabled:cursor-not-allowed transition-all font-semibold text-lg shadow-md hover:shadow-lg"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/register')}
            className="w-full bg-transparent border-2 border-primary text-primary py-3.5 rounded-xl hover:bg-primary/5 transition-all font-semibold text-lg"
          >
            Kayıt Ol
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
