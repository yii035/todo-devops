import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: 'demo@fintrack.local', password: 'password123' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} className="mt-5 w-full text-sm font-medium text-blue-700">
          {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
        </button>
      </div>
    </div>
  );
}
