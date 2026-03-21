import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/intake': 'Opportunity Intake',
  '/capital': 'Capital Stack',
  '/spv': 'SPV Registry',
  '/waterfalls': 'Waterfalls',
  '/holdco': 'HoldCo Summary',
  '/documents': 'Documents',
  '/notifications': 'Notifications',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const isDealDetail = location.pathname.startsWith('/deal/');
  const title = isDealDetail ? 'Deal Details' : (pageTitles[location.pathname] || 'Dashboard');

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50">
      <div className="flex items-center justify-between px-4 lg:px-8 py-4">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white transition-base"
            data-testid="mobile-menu-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-white" data-testid="page-title">
              {title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{today}</p>
          </div>
        </div>

        {/* Right: Search + Notifications */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search deals..."
              className="bg-transparent border-none outline-none text-sm text-slate-300 placeholder-slate-500 w-32 lg:w-40"
              data-testid="search-input"
            />
          </div>

          {/* Notifications */}
          <button 
            className="relative p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-base"
            data-testid="notifications-btn"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-slate-900"></span>
          </button>
        </div>
      </div>
    </header>
  );
}
