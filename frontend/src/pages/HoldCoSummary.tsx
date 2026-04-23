import { useState, useEffect } from 'react';
import { resolveUser, licenseToVisibility, type VisibilityState } from '../api/deals';
import { isAuthenticated } from '../api/auth';

export default function HoldCoSummary() {
  const [visibility, setVisibility] = useState<VisibilityState>('teaser');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (isAuthenticated()) {
        const user = await resolveUser();
        if (user) setVisibility(licenseToVisibility(user.licenseLevel));
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  const showFinancials = visibility === 'preview' || visibility === 'full';

  if (!showFinancials) {
    return (
      <div className="space-y-6" data-testid="holdco-summary-page">
        <div className="glass-card p-8 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">HoldCo Summary Restricted</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Holding company summary data requires Level 2 or higher access. Your current license level does not include HoldCo visibility.
          </p>
        </div>
      </div>
    );
  }

  const holdCoData = [
    { name: 'UBUYBOX Holdings I', spvCount: 8, totalAssets: 4500000, netIncome: 320000, status: 'active' },
    { name: 'UBUYBOX Holdings II', spvCount: 5, totalAssets: 2800000, netIncome: 180000, status: 'active' },
    { name: 'UBUYBOX Properties', spvCount: 3, totalAssets: 1200000, netIncome: 85000, status: 'inactive' },
  ];

  const totalAssets = holdCoData.reduce((sum, h) => sum + h.totalAssets, 0);
  const totalIncome = holdCoData.reduce((sum, h) => sum + h.netIncome, 0);
  const totalSPVs = holdCoData.reduce((sum, h) => sum + h.spvCount, 0);

  return (
    <div className="space-y-6" data-testid="holdco-summary-page">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total HoldCos</p>
          <p className="text-2xl font-bold text-white mt-1">{holdCoData.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Businesses</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{totalSPVs}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Assets</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">${(totalAssets / 1000000).toFixed(1)}M</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Net Income</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">${(totalIncome / 1000).toFixed(0)}K</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Holding Companies</h2>
        {holdCoData.map((holdCo, idx) => (
          <div key={idx} className="glass-card p-6 hover:border-slate-600/50 transition-base">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-white">{holdCo.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    holdCo.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                  }`}>
                    {holdCo.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{holdCo.spvCount} Businesses under management</p>
              </div>
              <button className="text-orange-500 hover:text-orange-400 transition-base text-sm font-medium">
                View Details →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Businesses</p>
                <p className="text-lg font-semibold text-white">{holdCo.spvCount}</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Total Assets</p>
                <p className="text-lg font-semibold text-blue-400">${(holdCo.totalAssets / 1000000).toFixed(2)}M</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Net Income</p>
                <p className="text-lg font-semibold text-emerald-400">${(holdCo.netIncome / 1000).toFixed(0)}K</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Yield</p>
                <p className="text-lg font-semibold text-orange-400">{((holdCo.netIncome / holdCo.totalAssets) * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
