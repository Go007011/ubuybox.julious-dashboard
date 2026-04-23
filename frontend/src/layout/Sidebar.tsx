import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ubuyboxLogo from '../assets/ubuybox-logo.png';
import { resolveUser, type UserInfo } from '../api/deals';
import { getAuthEmail, setAuthEmail, isAuthenticated } from '../api/auth';
import { fetchUserMenu, MENU_ICON_PATHS, type MenuItem } from '../api/menu';

// Safe fallback menu — used only if /api/menu fails or returns nothing.
// Mirrors backend DEFAULT_MENU_ITEMS but omits admin-only items.
const FALLBACK_MENU: MenuItem[] = [
  { id: 'dashboard',    menu_label: 'Dashboard',          path: '/',              source_sheet_name: '—', icon_name: 'home',     enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 1 },
  { id: 'intake',       menu_label: 'Opportunity Intake', path: '/intake',        source_sheet_name: '—', icon_name: 'plus',     enabled: true, allowed_levels: ['LEVEL_2','LEVEL_3'],           admin_only: false, hidden_but_queryable: false, sort_order: 2 },
  { id: 'capital',      menu_label: 'Capital Stack',      path: '/capital',       source_sheet_name: '—', icon_name: 'stack',    enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 3 },
  { id: 'spv',          menu_label: 'SPV Registry',       path: '/spv',           source_sheet_name: '—', icon_name: 'building', enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 4 },
  { id: 'waterfalls',   menu_label: 'Waterfalls',         path: '/waterfalls',    source_sheet_name: '—', icon_name: 'chart',    enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 5 },
  { id: 'holdco',       menu_label: 'HoldCo Summary',     path: '/holdco',        source_sheet_name: '—', icon_name: 'doc',      enabled: true, allowed_levels: ['LEVEL_2','LEVEL_3'],           admin_only: false, hidden_but_queryable: false, sort_order: 6 },
  { id: 'documents',    menu_label: 'Documents',          path: '/documents',     source_sheet_name: '—', icon_name: 'file',     enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 7 },
  { id: 'notifications', menu_label: 'Notifications',     path: '/notifications', source_sheet_name: '—', icon_name: 'bell',     enabled: true, allowed_levels: ['LEVEL_1','LEVEL_2','LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 8 },
  { id: 'deal-summary', menu_label: 'Deal Summary',       path: '/deal-summary',  source_sheet_name: '—', icon_name: 'doc-text', enabled: true, allowed_levels: ['LEVEL_3'],                     admin_only: false, hidden_but_queryable: false, sort_order: 9 },
  { id: 'tranche-breakdown', menu_label: 'Tranche Breakdown', path: '/tranche-breakdown', source_sheet_name: '—', icon_name: 'bars', enabled: true, allowed_levels: ['LEVEL_3'], admin_only: false, hidden_but_queryable: false, sort_order: 10 },
];

function filterFallback(items: MenuItem[], level: string, isAdmin: boolean): MenuItem[] {
  return items
    .filter((i) => i.enabled && !i.hidden_but_queryable)
    .filter((i) => (i.admin_only ? isAdmin : isAdmin || i.allowed_levels.includes(level)))
    .sort((a, b) => a.sort_order - b.sort_order);
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      if (isAuthenticated()) {
        const info = await resolveUser();
        setUserInfo(info);
        const email = getAuthEmail();
        let adminFlag = false;
        if (email) {
          try {
            const res = await fetch(`/api/admin/check?email=${encodeURIComponent(email)}`);
            if (res.ok) {
              const data = await res.json();
              adminFlag = data.isAdmin === true;
              setIsAdmin(adminFlag);
            }
          } catch { /* noop */ }
        }

        // Load dynamic menu — fallback safely if unavailable
        const items = await fetchUserMenu();
        if (items && items.length > 0) {
          setMenu(items);
        } else {
          const level = info?.licenseLevel || 'LEVEL_1';
          setMenu(filterFallback(FALLBACK_MENU, level, adminFlag));
        }
      }
    };
    loadAll();
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

  // Split admin-only items so they render in the bottom admin section with red styling.
  const normalItems = menu.filter((i) => !i.admin_only);
  const adminItems = menu.filter((i) => i.admin_only);

  return (
    <>
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 bg-slate-950 border-r border-slate-800 z-50
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        data-testid="sidebar"
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <Link to="/" className="flex items-center gap-3" data-testid="logo-link" onClick={onClose}>
            <img src="/logo.png" alt="UBUYBOX" className="w-10 h-10 rounded-xl object-contain" />
            <img src={ubuyboxLogo} alt="UBUYBOX" className="h-6 object-contain" />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden" data-testid="sidebar-nav">
          {normalItems.map((item) => {
            const isActive = location.pathname === item.path;
            const iconPath = MENU_ICON_PATHS[item.icon_name] || MENU_ICON_PATHS.doc;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-base group
                  ${isActive
                    ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}
                `}
                data-testid={`nav-${item.id}`}
              >
                <svg
                  className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-orange-500' : 'text-slate-500 group-hover:text-slate-300'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                </svg>
                <span className="truncate">{item.menu_label}</span>
              </Link>
            );
          })}

          {/* Admin utility items */}
          {adminItems.length > 0 && (
            <>
              <div className="pt-4 pb-1 px-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Admin</p>
              </div>
              {adminItems.map((item) => {
                const isActive = location.pathname === item.path;
                const iconPath = MENU_ICON_PATHS[item.icon_name] || MENU_ICON_PATHS.cog;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-base
                      ${isActive
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'text-red-400/60 hover:text-red-400 hover:bg-red-500/5 border border-transparent'}
                    `}
                    data-testid={`nav-${item.id}`}
                  >
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                    </svg>
                    <span className="truncate">{item.menu_label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Profile */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-950">
          {userInfo ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <span className="text-white text-sm font-semibold">{userInfo.ownerName.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{userInfo.ownerName}</p>
                  <p className="text-xs text-slate-500">{userInfo.assignedSpvId} • {userInfo.licenseLevel}{isAdmin ? ' • ADMIN' : ''}</p>
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
