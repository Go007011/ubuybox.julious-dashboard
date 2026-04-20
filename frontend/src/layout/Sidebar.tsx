import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ubuyboxLogo from '../assets/ubuybox-logo.png';
import { resolveUser, type UserInfo } from '../api/deals';
import { getAuthEmail, setAuthEmail, isAuthenticated } from '../api/auth';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Opportunity Intake', path: '/intake', icon: 'M12 4v16m8-8H4' },
  { name: 'Capital Stack', path: '/capital', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { name: 'SPV Registry', path: '/spv', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { name: 'Waterfalls', path: '/waterfalls', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
  { name: 'HoldCo Summary', path: '/holdco', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { name: 'Documents', path: '/documents', icon: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { name: 'Notifications', path: '/notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      if (isAuthenticated()) {
        const info = await resolveUser();
        setUserInfo(info);
        // Check admin status via backend
        const email = getAuthEmail();
        if (email) {
          try {
            const res = await fetch(`/api/admin/check?email=${encodeURIComponent(email)}`);
            if (res.ok) {
              const data = await res.json();
              setIsAdmin(data.isAdmin === true);
            }
          } catch {}
        }
      }
    };
    loadUser();
  }, []);

  const handleLogin = async () => {
    if (!loginEmail.trim()) return;
    setLoginError('');
    setAuthEmail(loginEmail.trim());
    const info = await resolveUser();
    if (info) {
      setUserInfo(info);
      setLoginEmail('');
      window.location.reload();
    } else {
      setLoginError('Email not found or inactive');
      localStorage.removeItem('ubuybox_user_email');
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-slate-950 border-r border-slate-800 z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link" onClick={onClose}>
            <img 
              src="/logo.png" 
              alt="UBUYBOX" 
              className="w-10 h-10 rounded-xl object-contain"
            />
            <img 
              src={ubuyboxLogo}
              alt="UBUYBOX" 
              className="h-6 object-contain"
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            // Hide Opportunity Intake for LEVEL_1
            if (item.path === '/intake' && userInfo && userInfo.licenseLevel === 'LEVEL_1') return null;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-base group
                  ${isActive
                    ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }
                `}
                data-testid={`nav-${item.path.replace('/', '') || 'dashboard'}`}
              >
                <svg
                  className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-500 group-hover:text-slate-300'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}

          {/* Admin Control — only for verified admin */}
          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-base mt-4
                ${location.pathname === '/admin'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5 border border-transparent'}
              `}
              data-testid="nav-admin-control"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">Admin Control</span>
            </Link>
          )}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-950">
          {userInfo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white text-sm font-semibold">{userInfo.ownerName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userInfo.ownerName}</p>
                  <p className="text-xs text-slate-500">{userInfo.assignedSpvId} • {userInfo.licenseLevel}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('ubuybox_user_email');
                  sessionStorage.clear();
                  window.location.replace(window.location.origin + '/');
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-lg transition-base"
                data-testid="sign-out-button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          ) : (
            <div className="px-3 py-2 space-y-2">
              <p className="text-xs text-slate-500">Sign in with Bolt email</p>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="email@example.com"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                data-testid="login-email-input"
              />
              {loginError && <p className="text-xs text-red-400">{loginError}</p>}
              <button
                onClick={handleLogin}
                className="w-full px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-base"
                data-testid="login-submit-button"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
