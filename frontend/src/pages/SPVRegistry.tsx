import { useState, useEffect } from 'react';
import { fetchFullDashboard, formatCurrency, licenseToVisibility, type FullDashboardData } from '../api/deals';
import { isAuthenticated } from '../api/auth';

export default function SPVRegistry() {
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
  const spvs = data.spvRegistry;
  const valid = data.validation[0] || {};

  return (
    <div className="space-y-6" data-testid="spv-registry-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">SPV</p>
          <p className="text-2xl font-bold text-white mt-1">{data.user.assignedSpvId}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Deals</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{data.stats.totalDeals}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Validation</p>
          <p className={`text-2xl font-bold mt-1 ${valid.Overall_Status === 'VALID' ? 'text-emerald-400' : 'text-amber-400'}`}>{valid.Overall_Status || 'N/A'}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">SPV Registry</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Deal ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">SPV ID</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">State</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">County</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Business Use</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                {showFinancials && <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Purchase Price</th>}
                {showFinancials && <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Total Capital</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {spvs.map((spv, i) => (
                <tr key={i} className="hover:bg-slate-800/30 transition-base" data-testid={`spv-row-${spv.SPV_ID}`}>
                  <td className="px-6 py-4 text-sm text-white font-medium">{spv.Deal_ID}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.SPV_ID}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.State}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.County}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.Target_Business_Use}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      spv.Status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{spv.Status}</span>
                  </td>
                  {showFinancials && <td className="px-6 py-4 text-sm text-slate-300">{formatCurrency(parseFloat(spv.Purchase_Price || '0'))}</td>}
                  {showFinancials && <td className="px-6 py-4 text-sm text-slate-300">{formatCurrency(parseFloat(spv.TOTAL_CAPITAL_REQUIRED || '0'))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Validation Details */}
      {data.validation.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Validation Engine</h2>
          {data.validation.map((v, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Overall</p>
                <p className={`text-sm font-semibold mt-1 ${v.Overall_Status === 'VALID' ? 'text-emerald-400' : 'text-amber-400'}`}>{v.Overall_Status}</p>
              </div>
              {v.Tranche_Count_Check && <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Tranche Count</p><p className="text-sm font-medium text-white mt-1">{v.Tranche_Count_Check}</p></div>}
              {v.Capital_Match_Check && <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Capital Match</p><p className="text-sm font-medium text-white mt-1">{v.Capital_Match_Check}</p></div>}
              {v.Waterfall_Check && <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Waterfall</p><p className="text-sm font-medium text-white mt-1">{v.Waterfall_Check}</p></div>}
              {v.Capital_Presence_Check && <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Capital Presence</p><p className="text-sm font-medium text-white mt-1">{v.Capital_Presence_Check}</p></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
