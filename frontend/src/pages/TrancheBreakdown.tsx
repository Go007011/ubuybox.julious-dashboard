import { useState, useEffect, useMemo } from 'react';
import { resolveUser, type UserInfo } from '../api/deals';
import { getAuthEmail, isAuthenticated } from '../api/auth';

interface TrancheRow {
  Deal_ID: string;
  SPV_ID: string;
  Tranche_Type: string;
  Amount: string;
  Return_Target: string;
  Priority: string;
  Risk_Level: string;
}

interface TrancheResponse {
  tranches: TrancheRow[];
  count: number;
  spvId: string;
}

function parseAmount(raw: string): number {
  if (!raw) return 0;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function riskTone(level: string): string {
  const l = (level || '').toLowerCase();
  if (l.includes('high')) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (l.includes('med')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (l.includes('low')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

function trancheTone(t: string): string {
  const x = (t || '').toLowerCase();
  if (x.includes('senior')) return 'text-blue-400';
  if (x.includes('mezz')) return 'text-purple-400';
  if (x.includes('equity')) return 'text-orange-400';
  return 'text-slate-300';
}

export default function TrancheBreakdown() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<TrancheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setError('Sign in required.');
        setLoading(false);
        return;
      }
      const info = await resolveUser();
      setUser(info);

      const email = getAuthEmail();
      if (!email) {
        setError('Sign in required.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/user/tranche-breakdown?email=${encodeURIComponent(email)}`);
        if (res.status === 403) {
          setError('Tranche Breakdown requires Level 3 access.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('Unable to load Tranche Breakdown.');
          setLoading(false);
          return;
        }
        const data: TrancheResponse = await res.json();
        setRows(Array.isArray(data.tranches) ? data.tranches : []);
      } catch {
        setError('Unable to load Tranche Breakdown.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TrancheRow[]>();
    for (const r of rows) {
      const key = r.Deal_ID || r.SPV_ID || 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const pa = Number(a.Priority) || 999;
        const pb = Number(b.Priority) || 999;
        return pa - pb;
      });
    }
    return Array.from(map.entries());
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="tranche-breakdown-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="tranche-breakdown-page">
        <div className="glass-card p-8 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Tranche Breakdown Unavailable</h2>
          <p className="text-slate-400 max-w-md mx-auto" data-testid="tranche-breakdown-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="tranche-breakdown-page">
      <div>
        <h1 className="text-2xl font-bold text-white">Tranche Breakdown</h1>
        <p className="text-sm text-slate-400 mt-1">
          Capital stack tranches with priority ordering, return targets and risk levels.
        </p>
        {user && (
          <p className="text-xs text-slate-500 mt-1">
            SPV: <span className="text-slate-300">{user.assignedSpvId}</span> · Access: <span className="text-slate-300">{user.licenseLevel}</span>
          </p>
        )}
      </div>

      {grouped.length === 0 ? (
        <div className="glass-card p-8 text-center" data-testid="tranche-breakdown-empty">
          <p className="text-slate-400">No tranche records available for this SPV yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dealId, list]) => {
            const total = list.reduce((sum, r) => sum + parseAmount(r.Amount), 0);
            return (
              <div key={dealId} className="glass-card p-6" data-testid={`tranche-group-${dealId}`}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{dealId}</h3>
                    <p className="text-xs text-slate-500 mt-1">{list.length} tranche{list.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                    <p className="text-lg font-semibold text-white">{formatAmount(total)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                        <th className="py-2 pr-4 font-medium">Priority</th>
                        <th className="py-2 pr-4 font-medium">Tranche</th>
                        <th className="py-2 pr-4 font-medium">Amount</th>
                        <th className="py-2 pr-4 font-medium">Return Target</th>
                        <th className="py-2 pr-4 font-medium">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, idx) => (
                        <tr
                          key={`${r.Deal_ID}-${r.Tranche_Type}-${idx}`}
                          className="border-b border-slate-800/60 last:border-0"
                          data-testid={`tranche-row-${r.Deal_ID}-${r.Tranche_Type || idx}`}
                        >
                          <td className="py-3 pr-4 text-slate-400">{r.Priority || '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${trancheTone(r.Tranche_Type)}`}>
                            {r.Tranche_Type || '—'}
                          </td>
                          <td className="py-3 pr-4 text-white">{formatAmount(parseAmount(r.Amount))}</td>
                          <td className="py-3 pr-4 text-slate-300">{r.Return_Target || '—'}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${riskTone(r.Risk_Level)}`}>
                              {r.Risk_Level || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
