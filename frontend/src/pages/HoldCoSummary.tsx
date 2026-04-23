import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { isAuthenticated, getAuthEmail } from '../api/auth';

interface HoldCoCard {
  Holding_ID: string;
  Holding_Name: string;
  Holding_Status: string;
  Total_Businesses: number | null;
  Total_Assets: number | null;
  Net_Income: number | null;
  Yield: number | null;
  can_view_details: boolean;
  access_source: string;
}

interface HoldcoListResponse {
  holdings: HoldCoCard[];
  count: number;
  accessSource: string;
  accessSheetOk: boolean;
}

function formatMoney(n: number | null): string {
  if (n === null || n === undefined) return '—';
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPercent(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(1)}%`;
}

function statusTone(s: string): string {
  const v = (s || '').toLowerCase();
  if (v.includes('active')) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (v.includes('pending')) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  if (v.includes('closed') || v.includes('inactive')) return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
  return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
}

export default function HoldCoSummary() {
  const [data, setData] = useState<HoldcoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setError('Sign in required.');
        setLoading(false);
        return;
      }
      const email = getAuthEmail();
      if (!email) {
        setError('Sign in required.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/user/holdcos?email=${encodeURIComponent(email)}`);
        if (!res.ok) {
          setError('Unable to load HoldCo Summary.');
          setLoading(false);
          return;
        }
        const payload: HoldcoListResponse = await res.json();
        setData(payload);
      } catch {
        setError('Unable to load HoldCo Summary.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="holdco-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center" data-testid="holdco-error">
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  const holdings = data?.holdings || [];

  return (
    <div className="space-y-6" data-testid="holdco-summary-page">
      <div>
        <h1 className="text-2xl font-bold text-white">HoldCo Summary</h1>
        <p className="text-sm text-slate-400 mt-1">
          Parent holdings you are authorized to view. Each card is permission-scoped to your account.
        </p>
      </div>

      {holdings.length === 0 ? (
        <div className="glass-card p-12 text-center" data-testid="holdco-empty">
          <svg className="w-14 h-14 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="text-lg font-semibold text-white">No holding companies assigned.</h2>
          <p className="text-sm text-slate-500 mt-1">Contact an administrator if you believe this is incorrect.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {holdings.map((h) => (
            <div
              key={h.Holding_ID}
              className="glass-card p-6 flex flex-col"
              data-testid={`holdco-card-${h.Holding_ID}`}
            >
              <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Holding Company</p>
                  <h3 className="text-lg font-semibold text-white truncate">{h.Holding_Name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{h.Holding_ID}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium ${statusTone(h.Holding_Status)}`}
                  data-testid={`holdco-card-${h.Holding_ID}-status`}
                >
                  {h.Holding_Status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="p-3 bg-slate-800/40 rounded-lg">
                  <p className="text-xs text-slate-500">Businesses</p>
                  <p className="text-white font-semibold">{h.Total_Businesses ?? '—'}</p>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg">
                  <p className="text-xs text-slate-500">Total Assets</p>
                  <p className="text-white font-semibold">{formatMoney(h.Total_Assets)}</p>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg">
                  <p className="text-xs text-slate-500">Net Income</p>
                  <p className="text-white font-semibold">{formatMoney(h.Net_Income)}</p>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg">
                  <p className="text-xs text-slate-500">Yield</p>
                  <p className="text-white font-semibold">{formatPercent(h.Yield)}</p>
                </div>
              </div>

              <div className="mt-auto">
                {h.can_view_details ? (
                  <Link
                    to={`/holdco/${encodeURIComponent(h.Holding_ID)}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-base"
                    data-testid={`holdco-card-${h.Holding_ID}-view-details`}
                  >
                    View Details
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                ) : (
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-500 text-sm font-medium rounded-lg cursor-not-allowed border border-slate-700"
                    data-testid={`holdco-card-${h.Holding_ID}-restricted`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Details Restricted
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
