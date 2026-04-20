import { useState, useEffect } from 'react';
import { fetchFullDashboard, licenseToVisibility, licenseAllowsWaterfall, type FullDashboardData } from '../api/deals';
import { isAuthenticated } from '../api/auth';

export default function Waterfalls() {
  const [data, setData] = useState<FullDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { setError('Not authenticated. Please log in via Bolt.'); setLoading(false); return; }
    fetchFullDashboard().then(d => { setData(d); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-red-400">{error}</p></div>;

  const vis = licenseToVisibility(data.user.licenseLevel);
  const allowed = licenseAllowsWaterfall(data.user.licenseLevel);
  const wf = data.personalContext.waterfall;
  const summary = data.personalContext.dealSummary[0] || {};

  if (!allowed) {
    return (
      <div className="space-y-6" data-testid="waterfalls-page">
        <div className="glass-card p-8 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Waterfall Access Restricted</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Waterfall distribution data requires Level 3 access. Your current license level ({data.user.licenseLevel}) does not include step-by-step waterfall visibility.
          </p>
          {vis === 'preview' && wf.length > 0 && wf[0].summary && (
            <div className="mt-6 p-4 bg-slate-800/50 rounded-xl max-w-sm mx-auto">
              <p className="text-xs text-slate-500">Summary</p>
              <p className="text-sm text-slate-300 mt-1">{wf[0].summary}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="waterfalls-page">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Waterfall Engine — {data.user.assignedSpvId}</h2>
          {summary.Waterfall_Display && (
            <span className="text-sm text-slate-400">{summary.Waterfall_Display}</span>
          )}
        </div>
        {wf.length > 0 ? (
          <div className="space-y-3">
            {wf.map((step, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl border bg-slate-800/30 border-slate-700/30" data-testid={`waterfall-step-${i}`}>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-blue-400">{step.Step_Order}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      step.Tranche === 'Senior' ? 'bg-blue-500/10 text-blue-400' :
                      step.Tranche === 'Mezzanine' ? 'bg-purple-500/10 text-purple-400' :
                      'bg-orange-500/10 text-orange-400'
                    }`}>{step.Tranche}</span>
                  </div>
                  <p className="text-sm text-slate-300">{step.Description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400 text-center py-4">No waterfall steps configured.</p>
        )}
      </div>
    </div>
  );
}
