/**
 * Event Habitat Dashboard — additive route.
 *
 * Reuses the existing Dashboard component verbatim. The only difference from
 * /dashboard is the access guard and the page heading. Operator-scoped
 * filtering is enforced server-side by /api/user/dashboard.
 *
 * Access guard:
 *   user.operatorId === "EVENT_HABITAT" + status Active  → allow
 *   user.operatorId === "UBUYBOX_CORE"                  → redirect to /
 *   missing / invalid / inactive                         → deny
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { resolveUser, type UserInfo } from '../api/deals';
import { isAuthenticated } from '../api/auth';
import Dashboard from './Dashboard';

type GuardState =
  | { kind: 'loading' }
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string }
  | { kind: 'deny'; message: string };

export default function EventHabitatDashboard() {
  const [state, setState] = useState<GuardState>({ kind: 'loading' });

  useEffect(() => {
    const run = async () => {
      if (!isAuthenticated()) {
        setState({ kind: 'deny', message: 'Sign in required.' });
        return;
      }
      let user: UserInfo | null = null;
      try {
        user = await resolveUser();
      } catch {
        setState({ kind: 'deny', message: 'Unable to verify operator context.' });
        return;
      }
      if (!user) {
        setState({ kind: 'deny', message: 'No valid operator context. Access denied.' });
        return;
      }
      const op = (user.operatorId || '').trim();
      const active = (user.status || '').toLowerCase() === 'active' || user.status === '';
      if (op === 'UBUYBOX_CORE') {
        setState({ kind: 'redirect', to: '/' });
        return;
      }
      if (op === 'EVENT_HABITAT' && active) {
        setState({ kind: 'allow' });
        return;
      }
      setState({ kind: 'deny', message: 'No valid operator context. Access denied.' });
    };
    run();
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="event-habitat-loading">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.kind === 'redirect') {
    return <Navigate to={state.to} replace />;
  }

  if (state.kind === 'deny') {
    return (
      <div className="glass-card p-10 text-center" data-testid="event-habitat-denied">
        <svg className="w-16 h-16 text-red-400/80 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Access Restricted.</h2>
        <p className="text-slate-400 max-w-md mx-auto">{state.message}</p>
      </div>
    );
  }

  return <Dashboard />;
}
