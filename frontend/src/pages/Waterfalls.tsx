import { useState, useEffect } from 'react';
import { fetchDeals, fetchSPVVisibility, formatCurrency, getVisibility, type Deal, type VisibilityMap } from '../api/deals';

export default function Waterfalls() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [visibilityMap, setVisibilityMap] = useState<VisibilityMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [dealsData, vis] = await Promise.all([
          fetchDeals(),
          fetchSPVVisibility()
        ]);
        setDeals(dealsData);
        setVisibilityMap(vis);
        setError(null);
      } catch (err) {
        setError('Failed to load waterfall data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
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

  // Separate into visible and gated
  const visibleSPVs: string[] = [];
  const gatedSPVs: string[] = [];
  for (const spvId of Object.keys(spvGroups)) {
    const vis = getVisibility(visibilityMap, spvId);
    if (vis.waterfallVisible) {
      visibleSPVs.push(spvId);
    } else {
      gatedSPVs.push(spvId);
    }
  }

  const visibleDeals = visibleSPVs.flatMap(id => spvGroups[id]);
  const totalDistributed = visibleDeals.reduce((sum, d) => sum + d.netToSeller, 0);
  const totalCapital = visibleDeals.reduce((sum, d) => sum + d.totalCapital, 0);

  return (
    <div className="space-y-6" data-testid="waterfalls-page">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">SPVs with Waterfall Access</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1" data-testid="waterfall-visible-count">{visibleSPVs.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">SPVs Gated</p>
          <p className="text-2xl font-bold text-amber-400 mt-1" data-testid="waterfall-gated-count">{gatedSPVs.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Net Distributions</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalDistributed)}</p>
        </div>
      </div>

      {/* Visible Waterfalls */}
      {visibleSPVs.length > 0 ? (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-6">Distribution Waterfall</h2>
          <div className="space-y-4">
            {visibleSPVs.map(spvId => {
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
      ) : (
        <div className="glass-card p-8 text-center" data-testid="no-waterfalls-visible">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">No Waterfalls Available</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Waterfall distribution data is gated by the orchestration layer. Waterfalls become visible when an SPV's disclosure is set to "full", all required fields are complete, and waterfall permission is granted.
          </p>
        </div>
      )}

      {/* Gated SPVs */}
      {gatedSPVs.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Gated SPVs ({gatedSPVs.length})</h2>
          <div className="space-y-2">
            {gatedSPVs.map(spvId => {
              const vis = getVisibility(visibilityMap, spvId);
              return (
                <div key={spvId} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/30" data-testid={`gated-spv-${spvId}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      vis.visibilityState === 'blocked' ? 'bg-red-500' :
                      vis.visibilityState === 'teaser' ? 'bg-amber-500' :
                      vis.visibilityState === 'preview' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`} />
                    <span className="text-sm text-white">{spvId}</span>
                  </div>
                  <span className="text-xs text-slate-500 capitalize">{vis.visibilityState} — waterfall not available</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
