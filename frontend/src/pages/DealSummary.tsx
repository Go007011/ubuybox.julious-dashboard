import { useState, useEffect } from 'react';
import { resolveUser, type UserInfo } from '../api/deals';
import { getAuthEmail, isAuthenticated } from '../api/auth';

interface DealSummaryRow {
  Deal_ID: string;
  SPV_ID: string;
  Deal_Name: string;
  State: string;
  Capital_Stack_Display: string;
  Waterfall_Display: string;
  Risk_Summary: string;
}

interface DealSummaryResponse {
  dealSummary: DealSummaryRow[];
  count: number;
  spvId: string;
}

export default function DealSummary() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [rows, setRows] = useState<DealSummaryRow[]>([]);
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
        const res = await fetch(`/api/user/deal-summary?email=${encodeURIComponent(email)}`);
        if (res.status === 403) {
          setError('Deal Summary requires Level 3 access.');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('Unable to load Deal Summary.');
          setLoading(false);
          return;
        }
        const data: DealSummaryResponse = await res.json();
        setRows(Array.isArray(data.dealSummary) ? data.dealSummary : []);
      } catch {
        setError('Unable to load Deal Summary.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="deal-summary-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="deal-summary-page">
        <div className="glass-card p-8 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Deal Summary Unavailable</h2>
          <p className="text-slate-400 max-w-md mx-auto" data-testid="deal-summary-error">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="deal-summary-page">
      <div>
        <h1 className="text-2xl font-bold text-white">Deal Summary</h1>
        <p className="text-sm text-slate-400 mt-1">
          Structured summary of your assigned Business — capital stack, waterfall and risk posture.
        </p>
        {user && (
          <p className="text-xs text-slate-500 mt-1">
            Business: <span className="text-slate-300">{user.assignedSpvId}</span> · Access: <span className="text-slate-300">{user.licenseLevel}</span>
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="glass-card p-8 text-center" data-testid="deal-summary-empty">
          <p className="text-slate-400">No deal summary records available for this Business yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r, idx) => (
            <div key={`${r.Deal_ID}-${idx}`} className="glass-card p-6" data-testid={`deal-summary-card-${r.Deal_ID || idx}`}>
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">{r.Deal_Name || r.Deal_ID || 'Unnamed Deal'}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {r.Deal_ID && <span>Deal: <span className="text-slate-300">{r.Deal_ID}</span></span>}
                    {r.SPV_ID && <span className="ml-3">Business ID: <span className="text-slate-300">{r.SPV_ID}</span></span>}
                    {r.State && <span className="ml-3">State: <span className="text-slate-300">{r.State}</span></span>}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Capital Stack</p>
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {r.Capital_Stack_Display || '—'}
                  </pre>
                </div>
                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Waterfall</p>
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {r.Waterfall_Display || '—'}
                  </pre>
                </div>
              </div>

              {r.Risk_Summary && (
                <div className="mt-4 p-4 bg-slate-800/50 rounded-xl">
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Risk Summary</p>
                  <p className="text-sm text-slate-200 leading-relaxed">{r.Risk_Summary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
