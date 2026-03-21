import DealCard from '../components/DealCard';
import { deals } from '../data/mockData';

// Extended deals for Capital Stack page
const allDeals = [
  ...deals,
  {
    id: '3',
    deal: 'Deal_023',
    spv: 'SPV_023',
    location: 'Miami, FL',
    price: 890000,
    senior: 750000,
    mezz: 80000,
    equity: 60000,
    payment: 2450,
    status: 'Active' as const,
  },
  {
    id: '4',
    deal: 'Deal_025',
    spv: 'SPV_025',
    location: 'Denver, CO',
    price: 550000,
    senior: 480000,
    mezz: 35000,
    equity: 35000,
    payment: 1580,
    status: 'Locked' as const,
  },
];

export default function CapitalStack() {
  const totalCapital = allDeals.reduce((sum, d) => sum + d.senior + d.mezz + d.equity, 0);
  const totalSenior = allDeals.reduce((sum, d) => sum + d.senior, 0);
  const totalMezz = allDeals.reduce((sum, d) => sum + d.mezz, 0);
  const totalEquity = allDeals.reduce((sum, d) => sum + d.equity, 0);

  return (
    <div className="space-y-6" data-testid="capital-stack-page">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Capital</p>
          <p className="text-2xl font-bold text-white mt-1">${(totalCapital / 1000000).toFixed(2)}M</p>
        </div>
        <div className="glass-card p-5 border-blue-500/20">
          <p className="text-sm text-slate-400">Senior Debt</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">${(totalSenior / 1000000).toFixed(2)}M</p>
          <p className="text-xs text-slate-500 mt-1">{((totalSenior / totalCapital) * 100).toFixed(1)}% of total</p>
        </div>
        <div className="glass-card p-5 border-purple-500/20">
          <p className="text-sm text-slate-400">Mezzanine</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">${(totalMezz / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500 mt-1">{((totalMezz / totalCapital) * 100).toFixed(1)}% of total</p>
        </div>
        <div className="glass-card p-5 border-orange-500/20">
          <p className="text-sm text-slate-400">Equity</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">${(totalEquity / 1000).toFixed(0)}K</p>
          <p className="text-xs text-slate-500 mt-1">{((totalEquity / totalCapital) * 100).toFixed(1)}% of total</p>
        </div>
      </div>

      {/* Portfolio Distribution */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Portfolio Capital Distribution</h2>
        <div className="flex h-8 rounded-xl overflow-hidden">
          <div 
            style={{ width: `${(totalSenior / totalCapital) * 100}%` }} 
            className="bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center"
          >
            <span className="text-xs font-medium text-white">Senior {((totalSenior / totalCapital) * 100).toFixed(0)}%</span>
          </div>
          <div 
            style={{ width: `${(totalMezz / totalCapital) * 100}%` }} 
            className="bg-gradient-to-r from-purple-600 to-purple-500 flex items-center justify-center"
          >
            <span className="text-xs font-medium text-white">Mezz {((totalMezz / totalCapital) * 100).toFixed(0)}%</span>
          </div>
          <div 
            style={{ width: `${(totalEquity / totalCapital) * 100}%` }} 
            className="bg-gradient-to-r from-orange-600 to-orange-500 flex items-center justify-center"
          >
            <span className="text-xs font-medium text-white">Equity {((totalEquity / totalCapital) * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">All Deals ({allDeals.length})</h2>
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
          {allDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </div>
    </div>
  );
}
