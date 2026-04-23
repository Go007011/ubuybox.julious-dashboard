import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { isAuthenticated, getAuthEmail } from '../api/auth';

interface HoldingSummary {
  Holding_ID: string;
  Holding_Name: string;
  Holding_Status: string;
  Total_Businesses: number | null;
  Total_Assets: number | null;
  Net_Income: number | null;
  Yield: number | null;
}

interface HoldingDetailRow {
  Holding_ID: string;
  Holding_Name: string;
  Business_ID: string;
  Business_Name: string;
  Business_Status: string;
  Asset_Value: number | null;
  Net_Income: number | null;
  Yield: number | null;
  Capital_Stack_Ref: string;
  Waterfall_Ref: string;
  Registry_Ref: string;
}

interface DetailResponse {
  holding: HoldingSummary;
  details: HoldingDetailRow[];
  count: number;
  accessSource: string;
}

type ErrorKind = 'access_restricted' | 'holding_not_found' | 'network' | null;

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

export default function HoldCoDetail() {
  const { holdingId = '' } = useParams();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setErrorKind('network');
        setLoading(false);
        return;
      }
      const email = getAuthEmail();
      if (!email || !holdingId) {
        setErrorKind('holding_not_found');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/user/holdco-detail?email=${encodeURIComponent(email)}&holdingId=${encodeURIComponent(holdingId)}`,
        );
        if (res.status === 403) {
          // Hard access failure — do not leak any partial data
          setData(null);
          setErrorKind('access_restricted');
          setLoading(false);
          return;
        }
        if (res.status === 404) {
          setData(null);
          setErrorKind('holding_not_found');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setErrorKind('network');
          setLoading(false);
          return;
        }
        const payload: DetailResponse = await res.json();
        setData(payload);
        setErrorKind(null);
      } catch {
        setErrorKind('network');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [holdingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="holdco-detail-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorKind === 'access_restricted') {
    return (
      <div className="space-y-6" data-testid="holdco-detail-page">
        <BackLink />
        <div className="glass-card p-10 text-center" data-testid="holdco-detail-restricted">
          <svg className="w-16 h-16 text-red-400/80 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Access Restricted.</h2>
          <p className="text-slate-400 max-w-md mx-auto">
            You are not authorized to view the detail page for this holding.
          </p>
        </div>
      </div>
    );
  }

  if (errorKind === 'holding_not_found') {
    return (
      <div className="space-y-6" data-testid="holdco-detail-page">
        <BackLink />
        <div className="glass-card p-10 text-center" data-testid="holdco-detail-not-found">
          <h2 className="text-xl font-semibold text-white mb-2">Holding company not available.</h2>
          <p className="text-slate-400">The holding you requested does not exist in the source records.</p>
        </div>
      </div>
    );
  }

  if (errorKind === 'network' || !data) {
    return (
      <div className="space-y-6" data-testid="holdco-detail-page">
        <BackLink />
        <div className="glass-card p-10 text-center">
          <p className="text-slate-400">Unable to load holding company details.</p>
        </div>
      </div>
    );
  }

  const h = data.holding;

  return (
    <div className="space-y-6" data-testid="holdco-detail-page">
      <BackLink />

      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500">Holding Company</p>
        <h1 className="text-2xl font-bold text-white mt-1">{h.Holding_Name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {h.Holding_ID} · Status: <span className="text-slate-300">{h.Holding_Status}</span>
        </p>
      </div>

      {/* Holding KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="holdco-detail-kpis">
        <Kpi label="Total Businesses" value={h.Total_Businesses ?? '—'} />
        <Kpi label="Total Assets" value={formatMoney(h.Total_Assets)} />
        <Kpi label="Net Income" value={formatMoney(h.Net_Income)} />
        <Kpi label="Yield" value={formatPercent(h.Yield)} />
      </div>

      {/* Detail rows */}
      <div className="glass-card p-6" data-testid="holdco-detail-table">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Businesses under this Holding</h2>
          <span className="text-xs text-slate-500">{data.count} record{data.count === 1 ? '' : 's'}</span>
        </div>
        {data.details.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No business records found for this holding.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="py-2 pr-4 font-medium">Business ID (UBIDS)</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Asset Value</th>
                  <th className="py-2 pr-4 font-medium">Net Income</th>
                  <th className="py-2 pr-4 font-medium">Yield</th>
                  <th className="py-2 pr-4 font-medium">Capital Stack</th>
                  <th className="py-2 pr-4 font-medium">Waterfall</th>
                  <th className="py-2 pr-4 font-medium">Registry</th>
                </tr>
              </thead>
              <tbody>
                {data.details.map((r, idx) => (
                  <tr
                    key={`${r.Business_ID || 'row'}-${idx}`}
                    className="border-b border-slate-800/60 last:border-0"
                    data-testid={`holdco-detail-row-${r.Business_ID || idx}`}
                  >
                    <td className="py-3 pr-4 text-white font-medium">{r.Business_ID || '—'}</td>
                    <td className="py-3 pr-4 text-slate-300">{r.Business_Name}</td>
                    <td className="py-3 pr-4 text-slate-300">{r.Business_Status}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatMoney(r.Asset_Value)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatMoney(r.Net_Income)}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatPercent(r.Yield)}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{r.Capital_Stack_Ref}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{r.Waterfall_Ref}</td>
                    <td className="py-3 pr-4 text-slate-400 text-xs">{r.Registry_Ref}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/holdco"
      className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-base"
      data-testid="holdco-detail-back"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to HoldCo Summary
    </Link>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold text-white mt-2">{value}</p>
    </div>
  );
}
