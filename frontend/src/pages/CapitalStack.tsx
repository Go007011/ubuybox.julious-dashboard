import { useState, useEffect } from 'react';
import { fetchFullDashboard, formatCurrency, licenseToVisibility, type FullDashboardData, type VisibilityState } from '../api/deals';
import { isAuthenticated } from '../api/auth';

export default function CapitalStack() {
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
  const showFinancials = vis === 'preview' || vis === 'full';
  const showReturns = vis === 'full';
  const stack = data.capitalStack;

  return (
    <div className="space-y-6" data-testid="capital-stack-page">
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Capital Stack — {data.user.assignedSpvId}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
            vis === 'full' ? 'bg-emerald-500/10 text-emerald-400' :
            vis === 'preview' ? 'bg-blue-500/10 text-blue-400' :
            'bg-amber-500/10 text-amber-400'
          }`}>{vis} access</span>
        </div>

        {stack.map((cs, i) => (
          <div key={i} className="p-6 space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase">Total Capital</p>
                <p className="text-xl font-bold text-white mt-1">{showFinancials ? formatCurrency(parseFloat(cs.Total_Capital || '0')) : cs.Total_Capital}</p>
              </div>
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-slate-500 uppercase">Senior</p>
                <p className="text-xl font-bold text-blue-400 mt-1">{showFinancials ? formatCurrency(parseFloat(cs.Senior_Amount || '0')) : cs.Senior_Amount}</p>
                {showReturns && cs.Senior_Return && <p className="text-xs text-slate-500 mt-1">Return: {cs.Senior_Return} • Priority: {cs.Senior_Priority}</p>}
              </div>
              <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                <p className="text-xs text-slate-500 uppercase">Mezzanine</p>
                <p className="text-xl font-bold text-purple-400 mt-1">{showFinancials ? formatCurrency(parseFloat(cs.Mezz_Amount || '0')) : cs.Mezz_Amount}</p>
                {showReturns && cs.Mezz_Return && <p className="text-xs text-slate-500 mt-1">Return: {cs.Mezz_Return} • Priority: {cs.Mezz_Priority}</p>}
              </div>
              <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="text-xs text-slate-500 uppercase">Equity</p>
                <p className="text-xl font-bold text-orange-400 mt-1">{showFinancials ? formatCurrency(parseFloat(cs.Equity_Amount || '0')) : cs.Equity_Amount}</p>
                {showReturns && cs.Equity_Return && <p className="text-xs text-slate-500 mt-1">Return: {cs.Equity_Return} • Priority: {cs.Equity_Priority}</p>}
              </div>
            </div>

            {/* Visual Stack Bar */}
            {showFinancials && (() => {
              const s = parseFloat(cs.Senior_Amount || '0');
              const m = parseFloat(cs.Mezz_Amount || '0');
              const e = parseFloat(cs.Equity_Amount || '0');
              const t = s + m + e;
              if (t <= 0) return null;
              return (
                <div className="flex h-8 rounded-xl overflow-hidden">
                  <div style={{ width: `${(s/t)*100}%` }} className="bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">Senior {((s/t)*100).toFixed(0)}%</span>
                  </div>
                  {m > 0 && <div style={{ width: `${(m/t)*100}%` }} className="bg-gradient-to-r from-purple-600 to-purple-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">Mezz {((m/t)*100).toFixed(0)}%</span>
                  </div>}
                  <div style={{ width: `${(e/t)*100}%` }} className="bg-gradient-to-r from-orange-600 to-orange-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">Equity {((e/t)*100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })()}

            {/* Risk Profile */}
            {showFinancials && cs.Risk_Profile && cs.Risk_Profile !== 'Restricted' && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <p className="text-xs text-amber-400 font-medium">Risk Profile</p>
                <p className="text-sm text-slate-300 mt-1">{cs.Risk_Profile}</p>
              </div>
            )}
          </div>
        ))}

        {!showFinancials && (
          <div className="p-8 text-center">
            <p className="text-slate-400">Capital stack details require Level 2+ access.</p>
          </div>
        )}
      </div>
    </div>
  );
}
