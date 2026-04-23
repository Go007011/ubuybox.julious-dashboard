import { useState, useEffect, useMemo } from 'react';
import { isAuthenticated, getAuthEmail } from '../api/auth';

interface Tranche {
  step: number;
  name: string;
  kind: 'senior' | 'mezz' | 'equity' | 'other';
  amount: number;
  percent: number;
  return_target: string;
  priority: number | null;
  risk: string;
  description: string;
}

interface WaterfallResponse {
  business_id: string;
  total_capital: number;
  tranches: Tranche[];
  chart_data: { name: string; kind: string; amount: number; percent: number }[];
  summary: {
    senior: { amount: number; percent: number; count: number };
    mezz: { amount: number; percent: number; count: number };
    equity: { amount: number; percent: number; count: number };
    total_capital: number;
    tranche_count: number;
  };
  has_waterfall_rows: boolean;
  has_tranche_rows: boolean;
}

const TRANCHE_PALETTE: Record<string, { bar: string; text: string; ring: string; bg: string; dot: string }> = {
  senior: { bar: '#3b82f6', text: 'text-blue-300',   ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500' },
  mezz:   { bar: '#a855f7', text: 'text-purple-300', ring: 'ring-purple-500/30', bg: 'bg-purple-500/10', dot: 'bg-purple-500' },
  equity: { bar: '#f97316', text: 'text-orange-300', ring: 'ring-orange-500/30', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  other:  { bar: '#64748b', text: 'text-slate-300',  ring: 'ring-slate-500/30',  bg: 'bg-slate-500/10',  dot: 'bg-slate-500' },
};

function formatMoney(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function riskBadge(risk: string): string {
  const r = (risk || '').toLowerCase();
  if (r.includes('high')) return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (r.includes('med'))  return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (r.includes('low'))  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
}

export default function Waterfalls() {
  const [businesses, setBusinesses] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<WaterfallResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap: load available businesses
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
        const res = await fetch(`/api/user/available-businesses?email=${encodeURIComponent(email)}`);
        if (res.status === 403) {
          setError('Waterfall view requires Level 3 access.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('Unable to load Business list.');
          setLoading(false);
          return;
        }
        const payload = await res.json();
        const list: string[] = payload.businesses || [];
        setBusinesses(list);
        setIsAdmin(!!payload.isAdmin);
        setSelected(list[0] || '');
      } catch {
        setError('Unable to load Business list.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Fetch waterfall view when selection changes
  useEffect(() => {
    if (!selected) return;
    const email = getAuthEmail();
    if (!email) return;
    setLoadingData(true);
    fetch(`/api/user/waterfall-view?email=${encodeURIComponent(email)}&businessId=${encodeURIComponent(selected)}`)
      .then(async (res) => {
        if (res.status === 403) {
          setError('Waterfall view requires Level 3 access.');
          setData(null);
          return;
        }
        if (!res.ok) {
          setError('Unable to load waterfall data.');
          setData(null);
          return;
        }
        const payload: WaterfallResponse = await res.json();
        setData(payload);
        setError(null);
      })
      .catch(() => setError('Unable to load waterfall data.'))
      .finally(() => setLoadingData(false));
  }, [selected]);

  const stackedSegments = useMemo(() => {
    if (!data || data.total_capital === 0) return [];
    return data.chart_data.map((c) => ({
      ...c,
      widthPct: (c.amount / data.total_capital) * 100,
      color: TRANCHE_PALETTE[c.kind]?.bar || TRANCHE_PALETTE.other.bar,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="waterfalls-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="waterfalls-page">
        <div className="glass-card p-8 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Waterfall Engine Unavailable</h2>
          <p className="text-slate-400 max-w-md mx-auto" data-testid="waterfalls-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="waterfalls-page">
      {/* 1. Title block + Business ID selector */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="waterfalls-title">
            Waterfall Engine — <span className="text-orange-400">{selected || '—'}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Capital flow order, tranche structure and return targets for the selected Business.
          </p>
        </div>
        <div className="flex items-center gap-2" data-testid="waterfalls-selector">
          <label className="text-xs text-slate-500 uppercase tracking-wide">Business</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!isAdmin && businesses.length <= 1}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-60"
            data-testid="waterfalls-business-select"
          >
            {businesses.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {loadingData && (
        <div className="flex items-center justify-center py-6" data-testid="waterfalls-data-loading">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {data && !loadingData && (
        <>
          {/* 2. Capital Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="waterfalls-kpi-strip">
            <KpiCard label="Total Capital" value={formatMoney(data.total_capital)} subvalue={`${data.summary.tranche_count} tranche${data.summary.tranche_count === 1 ? '' : 's'}`} tone="default" testid="kpi-total" />
            <KpiCard label="Senior" value={formatMoney(data.summary.senior.amount)} subvalue={`${data.summary.senior.percent.toFixed(1)}% of capital`} tone="senior" testid="kpi-senior" />
            <KpiCard label="Mezz" value={formatMoney(data.summary.mezz.amount)} subvalue={`${data.summary.mezz.percent.toFixed(1)}% of capital`} tone="mezz" testid="kpi-mezz" />
            <KpiCard label="Equity" value={formatMoney(data.summary.equity.amount)} subvalue={`${data.summary.equity.percent.toFixed(1)}% of capital`} tone="equity" testid="kpi-equity" />
          </div>

          {/* 5. Stacked bar chart + donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="glass-card p-6 lg:col-span-2" data-testid="waterfalls-stacked-chart">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Capital Waterfall by Tranche — {selected}</h2>
              </div>
              {stackedSegments.length > 0 ? (
                <>
                  <div className="h-10 rounded-lg overflow-hidden flex bg-slate-900 border border-slate-800">
                    {stackedSegments.map((s) => (
                      <div
                        key={s.name}
                        style={{ width: `${s.widthPct}%`, background: s.color }}
                        className="flex items-center justify-center text-[11px] text-white/90 font-medium"
                        data-testid={`stacked-segment-${s.kind}`}
                        title={`${s.name}: ${formatMoney(s.amount)} (${s.percent}%)`}
                      >
                        {s.widthPct >= 8 ? `${s.name} · ${s.percent}%` : ''}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs">
                    {stackedSegments.map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                        <span className="text-slate-300">{s.name}</span>
                        <span className="text-slate-500">{formatMoney(s.amount)} · {s.percent}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500 py-8 text-center">Chart unavailable — no tranche amounts.</p>
              )}
            </div>

            <div className="glass-card p-6 flex flex-col items-center justify-center" data-testid="waterfalls-donut">
              <Donut segments={stackedSegments} total={data.total_capital} />
              <p className="text-xs text-slate-500 mt-3">Allocation share</p>
            </div>
          </div>

          {/* 3. Tranche Breakdown Table */}
          <div className="glass-card p-6" data-testid="waterfalls-tranche-table">
            <h2 className="text-lg font-semibold text-white mb-4">Tranche Breakdown</h2>
            {data.tranches.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Data unavailable — no tranches configured for this Business.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-800">
                      <th className="py-2 pr-4 font-medium">Step</th>
                      <th className="py-2 pr-4 font-medium">Tranche</th>
                      <th className="py-2 pr-4 font-medium">Amount</th>
                      <th className="py-2 pr-4 font-medium">% of Total</th>
                      <th className="py-2 pr-4 font-medium">Return Target</th>
                      <th className="py-2 pr-4 font-medium">Priority</th>
                      <th className="py-2 pr-4 font-medium">Risk</th>
                      <th className="py-2 pr-4 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tranches.map((t, idx) => {
                      const palette = TRANCHE_PALETTE[t.kind] || TRANCHE_PALETTE.other;
                      return (
                        <tr key={`${t.name}-${idx}`} className="border-b border-slate-800/60 last:border-0" data-testid={`tranche-row-${t.kind}`}>
                          <td className="py-3 pr-4 text-slate-400">{t.step || '—'}</td>
                          <td className={`py-3 pr-4 font-medium ${palette.text}`}>
                            <div className="inline-flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${palette.dot}`} />
                              {t.name}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-white">{formatMoney(t.amount)}</td>
                          <td className="py-3 pr-4 text-slate-300">{t.percent.toFixed(1)}%</td>
                          <td className="py-3 pr-4 text-slate-300">{t.return_target}</td>
                          <td className="py-3 pr-4 text-slate-400">{t.priority ?? '—'}</td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${riskBadge(t.risk)}`}>
                              {t.risk}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-slate-400 max-w-xs">{t.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 4. Waterfall Step Cards */}
          <div className="glass-card p-6" data-testid="waterfalls-step-cards">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Distribution Order</h2>
              <span className="text-xs text-slate-500">Capital flows top → bottom</span>
            </div>
            {data.tranches.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">Data unavailable.</p>
            ) : (
              <div className="space-y-3">
                {data.tranches.map((t, idx) => {
                  const palette = TRANCHE_PALETTE[t.kind] || TRANCHE_PALETTE.other;
                  return (
                    <div
                      key={`${t.name}-${idx}`}
                      className={`p-4 rounded-xl border border-slate-800 ${palette.bg} ring-1 ${palette.ring}`}
                      data-testid={`step-card-${t.kind}`}
                    >
                      <div className="flex items-start gap-4 flex-wrap">
                        <div className={`w-10 h-10 rounded-xl ${palette.bg} ring-1 ${palette.ring} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-base font-bold ${palette.text}`}>{t.step || idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <span className={`text-sm font-semibold ${palette.text}`}>Step {t.step || idx + 1}: {t.name}</span>
                            <span className="text-xs text-slate-400">{formatMoney(t.amount)} · {t.percent.toFixed(1)}%</span>
                            <span className="text-xs text-slate-500">target {t.return_target}</span>
                          </div>
                          <p className="text-sm text-slate-300">{t.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label, value, subvalue, tone, testid,
}: { label: string; value: string; subvalue: string; tone: 'senior' | 'mezz' | 'equity' | 'default'; testid?: string }) {
  const tones: Record<string, string> = {
    senior: 'text-blue-400',
    mezz: 'text-purple-400',
    equity: 'text-orange-400',
    default: 'text-white',
  };
  return (
    <div className="glass-card p-5" data-testid={testid}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${tones[tone]}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subvalue}</p>
    </div>
  );
}

function Donut({
  segments, total,
}: { segments: { kind: string; percent: number; amount: number; name: string }[]; total: number }) {
  const size = 180;
  const radius = 72;
  const stroke = 22;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  if (!total || segments.length === 0) {
    return (
      <div className="w-[180px] h-[180px] flex items-center justify-center">
        <p className="text-xs text-slate-500">No allocation data</p>
      </div>
    );
  }

  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius} stroke="#1e293b" strokeWidth={stroke} fill="none" />
      {segments.map((s) => {
        const color = TRANCHE_PALETTE[s.kind]?.bar || TRANCHE_PALETTE.other.bar;
        const dash = (s.percent / 100) * circumference;
        const el = (
          <circle
            key={s.name}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            data-testid={`donut-${s.kind}`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" className="fill-white text-sm font-semibold">
        {formatMoney(total)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500 text-[10px] uppercase tracking-wide">
        Total Capital
      </text>
    </svg>
  );
}
