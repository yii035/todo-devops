import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (element: HTMLElement, options: {
        theme: 'outline';
        size: 'large';
        width: number;
        text: 'continue_with';
      }) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: 'demo@fintrack.local', password: 'password123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let initialized = false;

    const initializeGoogleButton = (clientId: string) => {
      if (cancelled || initialized || !window.google || !googleButton.current) return;
      initialized = true;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setGoogleError(null);
          try {
            const response = await api.post('/auth/google/credential', { credential });
            localStorage.setItem('fintrack-token', response.data.data.token);
            navigate('/dashboard', { replace: true });
          } catch {
            setGoogleError('Đăng nhập Google thất bại. Vui lòng thử lại.');
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: 'outline',
        size: 'large',
        width: Math.min(320, googleButton.current.clientWidth || 320),
        text: 'continue_with',
      });
    };

    api.get('/auth/google/config').then(({ data }) => {
      if (cancelled) return;
      const clientId: string = data.data.clientId;
      if (window.google) {
        initializeGoogleButton(clientId);
        return;
      }

      let script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.dataset.googleIdentity = 'true';
        document.head.appendChild(script);
      }
      script.addEventListener('load', () => initializeGoogleButton(clientId), { once: true });
      script.addEventListener('error', () => {
        if (!cancelled) setGoogleError('Không tải được dịch vụ đăng nhập Google.');
      }, { once: true });
    }).catch(() => {
      if (!cancelled) setGoogleError('Đăng nhập Google chưa được cấu hình trên máy chủ.');
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = mode === 'login'
        ? await api.post('/auth/login', { email: form.email, password: form.password })
        : await api.post('/auth/register', form);
      const token = response.data.data.token;
      localStorage.setItem('fintrack-token', token);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xác thực tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold text-blue-700">FinTrack</div>
          <p className="mt-2 text-slate-500">{mode === 'login' ? 'Quản lý tài chính cá nhân' : 'Tạo tài khoản FinTrack'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && <div>
            <label className="mb-1 block text-sm text-slate-700">Họ tên</label>
            <input required minLength={2} autoComplete="name" className="w-full rounded-xl border px-3 py-2 outline-none focus:border-blue-600" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>}
          <div>
            <label className="mb-1 block text-sm text-slate-700">Địa chỉ email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full border rounded-xl px-3 py-2 outline-none focus:border-blue-600"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-700">Mật khẩu</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full border rounded-xl px-3 py-2 outline-none focus:border-blue-600"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-700 text-white font-semibold py-3 hover:bg-blue-800 disabled:opacity-70"
          >
            {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          <span>HOẶC</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <div ref={googleButton} className="flex min-h-10 justify-center" />
        {googleError && <p role="alert" className="mt-2 text-center text-sm text-red-600">{googleError}</p>}
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} className="mt-5 w-full text-sm font-medium text-blue-700">
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  );
}
