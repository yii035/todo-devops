import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, LogOut, Moon, Sun, UserRound, X } from 'lucide-react';
import api from '../services/api';
import './ProfileMenu.css';

interface ProfileSummary {
  name: string;
  email: string;
  avatarUrl?: string | null;
}

const defaultAvatarUrl = '/avatar-default.png';

export default function ProfileMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('fintrack-theme') === 'dark');

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setProfile(data.data))
      .catch(() => setProfile(null));
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setSwitchDialogOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const toggleTheme = () => {
    const nextIsDark = !isDark;
    localStorage.setItem('fintrack-theme', nextIsDark ? 'dark' : 'light');
    setIsDark(nextIsDark);
    setMenuOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('fintrack-token');
    navigate('/login', { replace: true });
  };

  const openProfile = () => {
    setMenuOpen(false);
    navigate('/profile', { state: { from: location.pathname } });
  };

  const displayName = profile?.name || profile?.email || 'Tài khoản';

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-label={`Tài khoản ${displayName}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={displayName}
          onClick={() => setMenuOpen((open) => !open)}
          className="fintrack-avatar-button"
        >
          <img
            className="fintrack-avatar-image"
            src={profile?.avatarUrl || defaultAvatarUrl}
            alt=""
            onError={(event) => {
              if (event.currentTarget.src !== new URL(defaultAvatarUrl, window.location.origin).href) {
                event.currentTarget.src = defaultAvatarUrl;
              }
            }}
          />
        </button>

        {menuOpen && (
          <div className="fintrack-profile-menu" role="menu" aria-label="Menu tài khoản">
            <div className="fintrack-profile-menu-heading">
              <strong>{displayName}</strong>
              {profile?.email && <span>{profile.email}</span>}
            </div>
            <button type="button" role="menuitem" onClick={openProfile}>
              <UserRound size={17} />
              <span>Thông tin cá nhân</span>
            </button>
            <button type="button" role="menuitem" onClick={toggleTheme}>
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
              <span>Giao diện {isDark ? 'sáng' : 'tối'}</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setSwitchDialogOpen(true); }}>
              <ArrowLeftRight size={17} />
              <span>Chuyển tài khoản</span>
            </button>
            <button type="button" role="menuitem" className="fintrack-profile-logout" onClick={logout}>
              <LogOut size={17} />
              <span>Đăng xuất</span>
            </button>
          </div>
        )}
      </div>

      {switchDialogOpen && (
        <div className="fintrack-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSwitchDialogOpen(false);
        }}>
          <section className="fintrack-switch-dialog" role="dialog" aria-modal="true" aria-labelledby="switch-account-title">
            <div className="fintrack-dialog-heading">
              <div>
                <h2 id="switch-account-title">Chuyển tài khoản</h2>
                <p>Hiện chưa có tài khoản nào được liên kết để chuyển nhanh.</p>
              </div>
              <button type="button" aria-label="Đóng" onClick={() => setSwitchDialogOpen(false)}><X size={19} /></button>
            </div>
            <p className="fintrack-dialog-copy">Bạn có thể đăng nhập bằng một tài khoản khác. Phiên hiện tại sẽ kết thúc trên thiết bị này.</p>
            <div className="fintrack-dialog-actions">
              <button type="button" className="fintrack-button-secondary" onClick={() => setSwitchDialogOpen(false)}>Hủy</button>
              <button type="button" className="fintrack-button-primary" onClick={logout}>Đăng nhập tài khoản khác</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
