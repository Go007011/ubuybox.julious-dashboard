import { useState, useEffect } from 'react';
import { fetchUserDeals, resolveUser, formatCurrency, licenseToVisibility, licenseAllowsWaterfall, type Deal, type VisibilityState } from '../api/deals';
import { isAuthenticated } from '../api/auth';

export default function Waterfalls() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [visibility, setVisibility] = useState<VisibilityState>('teaser');
  const [waterfallAllowed, setWaterfallAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [dealsData, user] = await Promise.all([
          fetchUserDeals(),
          resolveUser()
        ]);
        setDeals(dealsData);
        if (user) {
          setVisibility(licenseToVisibility(user.licenseLevel));
          setWaterfallAllowed(licenseAllowsWaterfall(user.licenseLevel));
        }
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load waterfall data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated()) {
      loadData();
    } else {
      setError('Not authenticated. Please log in via Bolt.');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading waterfalls...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Retry</button>
        </div>
      </div>
    );
  }

  // Group deals by SPV
  const spvGroups: Record<string, Deal[]> = {};
  for (const deal of deals) {
    const spvId = deal.spv || 'Unknown';
    if (!spvGroups[spvId]) spvGroups[spvId] = [];
    spvGroups[spvId].push(deal);
  }

  const allSpvIds = Object.keys(spvGroups);
  const totalDistributed = waterfallAllowed ? deals.reduce((sum, d) => sum + d.netToSeller, 0) : 0;
  const totalCapital = waterfallAllowed ? deals.reduce((sum, d) => sum + d.totalCapital, 0) : 0;

  return (
    <div className="space-y-6" data-testid="waterfalls-page">
      {waterfallAllowed ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-5">
              <p className="text-sm text-slate-400">SPVs with Waterfall Access</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1" data-testid="waterfall-visible-count">{allSpvIds.length}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-sm text-slate-400">Total Capital</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalCapital)}</p>
            </div>
            <div className="glass-card p-5">
              <p className="text-sm text-slate-400">Total Net Distributions</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totalDistributed)}</p>
            </div>
          </div>

          {/* Waterfall Data */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Distribution Waterfall</h2>
            <div className="space-y-4">
              {allSpvIds.map(spvId => {
                const spvDeals = spvGroups[spvId];
                const spvCapital = spvDeals.reduce((s, d) => s + d.totalCapital, 0);
                const spvSenior = spvDeals.reduce((s, d) => s + d.senior, 0);
                const spvEquity = spvDeals.reduce((s, d) => s + d.equity, 0);
                const spvNet = spvDeals.reduce((s, d) => s + d.netToSeller, 0);
                
                return (
                  <div key={spvId} className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/30" data-testid={`waterfall-spv-${spvId}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{spvId}</h3>
                        <p className="text-sm text-slate-400">{spvDeals.length} deal(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-400">{formatCurrency(spvNet)}</p>
                        <p className="text-xs text-slate-500">Net Distribution</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 text-center">
                        <p className="text-xs text-slate-400">Senior</p>
                        <p className="text-sm font-medium text-blue-400">{formatCurrency(spvSenior)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-orange-500/10 text-center">
                        <p className="text-xs text-slate-400">Equity</p>
                        <p className="text-sm font-medium text-orange-400">{formatCurrency(spvEquity)}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-700/30 text-center">
                        <p className="text-xs text-slate-400">Total Capital</p>
                        <p className="text-sm font-medium text-white">{formatCurrency(spvCapital)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-8 text-center" data-testid="no-waterfalls-visible">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Waterfall Access Restricted</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Waterfall distribution data requires Level 3 operator access. Your current license level does not include waterfall visibility.
          </p>
        </div>
      )}
    </div>
  );
}
