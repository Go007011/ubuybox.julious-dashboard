import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchDealById, resolveUser, formatCurrency, licenseToVisibility, licenseAllowsWaterfall, isFieldVisible, type Deal, type VisibilityState } from '../api/deals';
import { isAuthenticated } from '../api/auth';

function MaskedField({ label }: { label?: string }) {
  return (
    <span className="inline-block bg-slate-700/60 text-slate-500 rounded px-2 py-0.5 text-xs italic select-none" data-testid="masked-value">
      {label || 'Restricted'}
    </span>
  );
}

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState>('teaser');
  const [waterfallVisible, setWaterfallVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDeal = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [data, user] = await Promise.all([
          fetchDealById(id),
          resolveUser()
        ]);
        setDeal(data);
        if (user) {
          setVisibility(licenseToVisibility(user.licenseLevel));
          setWaterfallVisible(licenseAllowsWaterfall(user.licenseLevel));
        }
        setError(null);
      } catch (err) {
        setError(`Deal ${id} not found`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated()) {
      loadDeal();
    } else {
      setError('Not authenticated. Please log in via Bolt.');
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="deal-not-found">
        <div className="text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Deal Not Found</h2>
          <p className="text-slate-400 mb-4">{error}</p>
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

  // Blocked: minimal display
  if (visibility === 'blocked') {
    return (
      <div className="space-y-6" data-testid="deal-detail-page">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-base" data-testid="back-button">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="glass-card p-8 text-center" data-testid="deal-blocked">
          <h1 className="text-2xl font-bold text-white mb-2">{deal.deal}</h1>
          <p className="text-slate-400">{deal.spv}</p>
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-700/50 text-slate-400">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm">This Business is currently blocked from display</span>
          </div>
        </div>
      </div>
    );
  }

  const show = (field: string) => isFieldVisible(visibility, field);

  const total = deal.senior + deal.mezz + deal.equity;
  const seniorPct = total > 0 ? (deal.senior / total) * 100 : 0;
  const mezzPct = total > 0 ? (deal.mezz / total) * 100 : 0;
  const equityPct = total > 0 ? (deal.equity / total) * 100 : 0;

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

      {/* Visibility Badge */}
      {visibility !== 'full' && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 w-fit" data-testid="visibility-badge">
          <div className={`w-2 h-2 rounded-full ${
            visibility === 'teaser' ? 'bg-amber-500' : 'bg-blue-500'
          }`} />
          <span className="text-xs text-slate-400 capitalize">{visibility} view — some fields are restricted</span>
        </div>
      )}

      {/* Deal Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-white">{deal.deal}</h1>
              {show('status') && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${
                  deal.status === 'Active' ? 'bg-emerald-500' : 
                  deal.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                  {deal.status}
                </span>
              )}
            </div>
            <p className="text-slate-400">{deal.spv} • Seller Carryback Structure</p>
            {show('address') ? (
              <p className="text-slate-500 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {deal.address}, {deal.location}
              </p>
            ) : show('location') ? (
              <p className="text-slate-500 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {deal.location}
              </p>
            ) : null}
          </div>
          <div className="text-left lg:text-right">
            <p className="text-sm text-slate-500">Purchase Price</p>
            {show('price') ? (
              <>
                <p className="text-3xl font-bold text-white">${deal.price.toLocaleString()}</p>
                <p className="text-sm text-slate-400 mt-1">Total Capital: {formatCurrency(deal.totalCapital)}</p>
              </>
            ) : (
              <MaskedField label="Price restricted" />
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capital Stack */}
        {show('senior') ? (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Capital Stack</h2>
            
            {total > 0 && (
              <div className="flex flex-col-reverse h-48 rounded-xl overflow-hidden border border-slate-700/50 mb-4">
                <div style={{ height: `${seniorPct}%` }} className="bg-gradient-to-t from-blue-600 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Senior</span>
                </div>
                {mezzPct > 0 && (
                  <div style={{ height: `${mezzPct}%` }} className="bg-gradient-to-t from-purple-600 to-purple-500 flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Mezz</span>
                  </div>
                )}
                <div style={{ height: `${equityPct}%` }} className="bg-gradient-to-t from-orange-600 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Equity</span>
                </div>
              </div>
            )}

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
              {deal.mezz > 0 && (
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
              )}
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
        ) : (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Capital Stack</h2>
            <div className="flex items-center justify-center h-48 rounded-xl border border-slate-700/30 bg-slate-800/30">
              <div className="text-center">
                <svg className="w-10 h-10 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm text-slate-500">Capital stack restricted</p>
              </div>
            </div>
          </div>
        )}

        {/* Metrics & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Metrics */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Key Metrics</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Monthly Payment</p>
                {show('payment') ? (
                  <p className="text-xl font-semibold text-white mt-1">${deal.payment.toLocaleString()}</p>
                ) : (
                  <MaskedField />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">LTV Ratio</p>
                {show('senior') ? (
                  <p className="text-xl font-semibold text-blue-400 mt-1">{deal.price > 0 ? ((deal.senior / deal.price) * 100).toFixed(1) : 0}%</p>
                ) : (
                  <MaskedField />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Equity %</p>
                {show('equity') ? (
                  <p className="text-xl font-semibold text-orange-400 mt-1">{equityPct.toFixed(1)}%</p>
                ) : (
                  <MaskedField />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Net to Seller</p>
                {show('netToSeller') ? (
                  <p className="text-xl font-semibold text-emerald-400 mt-1">${deal.netToSeller.toLocaleString()}</p>
                ) : (
                  <MaskedField />
                )}
              </div>
            </div>
          </div>

          {/* Deal Info */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Deal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Seller</p>
                {show('sellerName') ? (
                  <p className="text-sm font-medium text-white mt-1">{deal.sellerName || 'N/A'}</p>
                ) : (
                  <MaskedField label="Seller identity restricted" />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Property Type</p>
                {show('propertyType') ? (
                  <p className="text-sm font-medium text-white mt-1">{deal.propertyType}</p>
                ) : (
                  <MaskedField />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total Units</p>
                {show('units') ? (
                  <p className="text-sm font-medium text-white mt-1">{deal.units}</p>
                ) : (
                  <MaskedField />
                )}
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500 uppercase tracking-wide">Units Sold</p>
                {show('unitsSold') ? (
                  <p className="text-sm font-medium text-white mt-1">{deal.unitsSold}</p>
                ) : (
                  <MaskedField />
                )}
              </div>
            </div>
          </div>

          {/* Waterfall Section - only shown if waterfallVisible */}
          {waterfallVisible && (
            <div className="glass-card p-6" data-testid="deal-waterfall-section">
              <h2 className="text-lg font-semibold text-white mb-4">Waterfall Distribution</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                  <p className="text-xs text-slate-500">Net to Seller</p>
                  <p className="text-lg font-semibold text-emerald-400">${deal.netToSeller.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-slate-500">Senior Debt</p>
                  <p className="text-lg font-semibold text-blue-400">${deal.senior.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                  <p className="text-xs text-slate-500">Equity Position</p>
                  <p className="text-lg font-semibold text-orange-400">${deal.equity.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
