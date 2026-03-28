import { useState, useEffect } from 'react';
import DealCard from '../components/DealCard';
import { fetchDeals, formatCurrency, type Deal } from '../api/deals';

export default function CapitalStack() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        setLoading(true);
        const data = await fetchDeals();
        setDeals(data);
        setError(null);
      } catch (err) {
        setError('Failed to load deals');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadDeals();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading deals...</p>
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

  const totalCapital = deals.reduce((sum, d) => sum + d.totalCapital, 0);
  const totalSenior = deals.reduce((sum, d) => sum + d.senior, 0);
  const totalMezz = deals.reduce((sum, d) => sum + d.mezz, 0);
  const totalEquity = deals.reduce((sum, d) => sum + d.equity, 0);
  const stackTotal = totalSenior + totalMezz + totalEquity;

  return (
    <div className="space-y-6" data-testid="capital-stack-page">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Capital</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalCapital)}</p>
        </div>
        <div className="glass-card p-5 border-blue-500/20">
          <p className="text-sm text-slate-400">Senior Debt</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(totalSenior)}</p>
          <p className="text-xs text-slate-500 mt-1">{stackTotal > 0 ? ((totalSenior / stackTotal) * 100).toFixed(1) : 0}% of stack</p>
        </div>
        <div className="glass-card p-5 border-purple-500/20">
          <p className="text-sm text-slate-400">Mezzanine</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{formatCurrency(totalMezz)}</p>
          <p className="text-xs text-slate-500 mt-1">{stackTotal > 0 ? ((totalMezz / stackTotal) * 100).toFixed(1) : 0}% of stack</p>
        </div>
        <div className="glass-card p-5 border-orange-500/20">
          <p className="text-sm text-slate-400">Equity</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(totalEquity)}</p>
          <p className="text-xs text-slate-500 mt-1">{stackTotal > 0 ? ((totalEquity / stackTotal) * 100).toFixed(1) : 0}% of stack</p>
        </div>
      </div>

      {/* Portfolio Distribution */}
      {stackTotal > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Portfolio Capital Distribution</h2>
          <div className="flex h-8 rounded-xl overflow-hidden">
            <div 
              style={{ width: `${(totalSenior / stackTotal) * 100}%` }} 
              className="bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center"
            >
              <span className="text-xs font-medium text-white">Senior {((totalSenior / stackTotal) * 100).toFixed(0)}%</span>
            </div>
            {totalMezz > 0 && (
              <div 
                style={{ width: `${(totalMezz / stackTotal) * 100}%` }} 
                className="bg-gradient-to-r from-purple-600 to-purple-500 flex items-center justify-center"
              >
                <span className="text-xs font-medium text-white">Mezz {((totalMezz / stackTotal) * 100).toFixed(0)}%</span>
              </div>
            )}
            <div 
              style={{ width: `${(totalEquity / stackTotal) * 100}%` }} 
              className="bg-gradient-to-r from-orange-600 to-orange-500 flex items-center justify-center"
            >
              <span className="text-xs font-medium text-white">Equity {((totalEquity / stackTotal) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Deals Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">All Deals ({deals.length})</h2>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-base">
              Filter
            </button>
            <button className="px-4 py-2 text-sm bg-slate-800/60 border border-slate-700/50 rounded-lg text-slate-400 hover:text-white hover:border-slate-600 transition-base">
              Sort
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </div>
  );
}
