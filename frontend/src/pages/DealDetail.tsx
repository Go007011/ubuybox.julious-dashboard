import { useParams, useLocation, useNavigate } from 'react-router-dom';
import type { Deal } from '../data/mockData';

export default function DealDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const deal = location.state as Deal | undefined;

  if (!deal) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="deal-not-found">
        <div className="text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Deal Not Found</h2>
          <p className="text-slate-400 mb-4">The deal you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/capital')}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-base"
          >
            Back to Capital Stack
          </button>
        </div>
      </div>
    );
  }

  const total = deal.senior + deal.mezz + deal.equity;
  const seniorPct = (deal.senior / total) * 100;
  const mezzPct = (deal.mezz / total) * 100;
  const equityPct = (deal.equity / total) * 100;

  return (
    <div className="space-y-6" data-testid="deal-detail-page">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-base"
        data-testid="back-button"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Deal Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-white">{deal.deal}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                deal.status === 'Active' ? 'bg-emerald-500' : 
                deal.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                {deal.status}
              </span>
            </div>
            <p className="text-slate-400">{deal.spv} • Seller Carryback Structure</p>
            <p className="text-slate-500 mt-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {deal.location}
            </p>
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-slate-500">Purchase Price</p>
            <p className="text-3xl font-bold text-white">${deal.price.toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-1">Total Capital: ${total.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capital Stack */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Capital Stack</h2>
          
          {/* Visual Stack */}
          <div className="flex flex-col-reverse h-48 rounded-xl overflow-hidden border border-slate-700/50 mb-4">
            <div style={{ height: `${seniorPct}%` }} className="bg-gradient-to-t from-blue-600 to-blue-500 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Senior</span>
            </div>
            <div style={{ height: `${mezzPct}%` }} className="bg-gradient-to-t from-purple-600 to-purple-500 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Mezz</span>
            </div>
            <div style={{ height: `${equityPct}%` }} className="bg-gradient-to-t from-orange-600 to-orange-500 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Equity</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm text-slate-300">Senior Debt</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">${deal.senior.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{seniorPct.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-sm text-slate-300">Mezzanine</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">${deal.mezz.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{mezzPct.toFixed(1)}%</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm text-slate-300">Equity</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">${deal.equity.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{equityPct.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics & Documents */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly Payment</p>
                <p className="text-xl font-semibold text-white mt-1">${deal.payment.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">LTV Ratio</p>
                <p className="text-xl font-semibold text-blue-400 mt-1">{((deal.senior / deal.price) * 100).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Equity %</p>
                <p className="text-xl font-semibold text-orange-400 mt-1">{equityPct.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Annual Yield</p>
                <p className="text-xl font-semibold text-emerald-400 mt-1">8.5%</p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Documents</h2>
            <div className="text-center py-8 text-slate-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p>No documents available for this deal.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
