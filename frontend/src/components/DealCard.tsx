import { useNavigate } from 'react-router-dom';
import type { Deal, VisibilityState } from '../api/deals';
import { isFieldVisible } from '../api/deals';

interface DealCardProps {
  deal: Deal;
  visibility?: VisibilityState;
}

function MaskedValue({ label }: { label?: string }) {
  return (
    <span className="inline-block bg-slate-700/60 text-slate-500 rounded px-2 py-0.5 text-xs italic select-none" data-testid="masked-value">
      {label || 'Restricted'}
    </span>
  );
}

export default function DealCard({ deal, visibility = 'full' }: DealCardProps) {
  const navigate = useNavigate();

  // Blocked: show minimal info
  if (visibility === 'blocked') {
    return (
      <div className="glass-card p-6 opacity-60" data-testid={`deal-card-${deal.deal}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{deal.deal}</h3>
            <p className="text-sm text-slate-500 mt-1">{deal.spv}</p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-slate-600" data-testid="blocked-badge">
            Blocked
          </span>
        </div>
        <p className="text-sm text-slate-500" data-testid="blocked-message">
          This SPV is currently blocked from display.
        </p>
      </div>
    );
  }

  const show = (field: string) => isFieldVisible(visibility, field);

  const total = deal.senior + deal.mezz + deal.equity;
  const seniorPct = total > 0 ? (deal.senior / total) * 100 : 0;
  const mezzPct = total > 0 ? (deal.mezz / total) * 100 : 0;
  const equityPct = total > 0 ? (deal.equity / total) * 100 : 0;

  const statusColors = {
    Active: 'bg-emerald-500',
    Pending: 'bg-amber-500',
    Locked: 'bg-red-500'
  };

  return (
    <div className="glass-card p-6 hover:border-slate-600/50 transition-base" data-testid={`deal-card-${deal.deal}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{deal.deal}</h3>
          <p className="text-sm text-slate-500 mt-1">
            {deal.spv} • Seller Carryback Structure
          </p>
          <p className="text-sm text-slate-400 mt-1 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {show('location') ? deal.location : <MaskedValue />}
          </p>
        </div>
        {show('status') ? (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${statusColors[deal.status]}`}>
            {deal.status}
          </span>
        ) : (
          <MaskedValue />
        )}
      </div>

      {/* Price Info */}
      <div className="mb-5">
        <p className="text-sm text-slate-500">Purchase Price</p>
        {show('price') ? (
          <>
            <p className="text-2xl font-bold text-white">${deal.price.toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-1">Total Capital: ${deal.totalCapital.toLocaleString()}</p>
          </>
        ) : (
          <MaskedValue label="Price restricted" />
        )}
      </div>

      {/* Capital Stack Cards */}
      {show('senior') ? (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-800/60 border border-blue-500/20">
            <p className="text-xs text-slate-400 mb-1">Senior</p>
            <p className="text-sm font-semibold text-blue-400">${deal.senior.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{seniorPct.toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-purple-500/20">
            <p className="text-xs text-slate-400 mb-1">Mezz</p>
            <p className="text-sm font-semibold text-purple-400">${deal.mezz.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{mezzPct.toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/60 border border-orange-500/20">
            <p className="text-xs text-slate-400 mb-1">Equity</p>
            <p className="text-sm font-semibold text-orange-400">${deal.equity.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{equityPct.toFixed(1)}%</p>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/30 text-center">
          <MaskedValue label="Capital stack restricted" />
        </div>
      )}

      {/* Progress Bar */}
      {show('senior') && total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden mb-5">
          <div style={{ width: `${seniorPct}%` }} className="bg-blue-500" />
          {mezzPct > 0 && <div style={{ width: `${mezzPct}%` }} className="bg-purple-500" />}
          <div style={{ width: `${equityPct}%` }} className="bg-orange-500" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
        <div>
          <p className="text-xs text-slate-500">Monthly Payment</p>
          {show('payment') ? (
            <p className="text-lg font-semibold text-white">
              ${deal.payment.toLocaleString()}<span className="text-sm text-slate-400 font-normal">/mo</span>
            </p>
          ) : (
            <MaskedValue label="Restricted" />
          )}
        </div>
        {visibility !== 'teaser' && (
          <button
            onClick={() => navigate(`/deal/${deal.deal}`)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-base"
            data-testid={`enter-deal-${deal.deal}`}
          >
            Enter Deal
          </button>
        )}
      </div>

      {/* Visibility indicator */}
      {visibility !== 'full' && (
        <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center gap-2" data-testid="visibility-indicator">
          <div className={`w-2 h-2 rounded-full ${
            visibility === 'teaser' ? 'bg-amber-500' : 'bg-blue-500'
          }`} />
          <span className="text-xs text-slate-500 capitalize">{visibility} view</span>
        </div>
      )}
    </div>
  );
}
