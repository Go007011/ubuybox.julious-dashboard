import { useState, useEffect } from 'react';
import { fetchSPVs, formatCurrency, type SPV } from '../api/deals';

export default function SPVRegistry() {
  const [spvs, setSPVs] = useState<SPV[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSPVs = async () => {
      try {
        setLoading(true);
        const data = await fetchSPVs();
        setSPVs(data);
        setError(null);
      } catch (err) {
        setError('Failed to load SPVs');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadSPVs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading SPVs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalCapital = spvs.reduce((sum, spv) => sum + spv.totalCapital, 0);
  const activeSPVs = spvs.filter(spv => spv.status === 'Active').length;

  return (
    <div className="space-y-6" data-testid="spv-registry-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total SPVs</p>
          <p className="text-2xl font-bold text-white mt-1">{spvs.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Active SPVs</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeSPVs || spvs.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Capital Managed</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(totalCapital)}</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">SPV Registry</h2>
          <button className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-base">
            + New SPV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">SPV Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Deals</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Total Capital</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Deal Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {spvs.map((spv) => (
                <tr key={spv.id} className="hover:bg-slate-800/30 transition-base">
                  <td className="px-6 py-4 text-sm text-white font-medium">{spv.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.deals.join(', ')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      spv.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {spv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">{formatCurrency(spv.totalCapital)}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.dealCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
