import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAuthEmail } from '../api/auth';

interface AccessResult {
  accessGranted: boolean;
  accessState: string;
  email?: string;
  ownerName?: string;
  licenseLevel?: string;
  assignedSpvId?: string;
  redirectTo?: string;
  isAdmin?: boolean;
  message?: string;
}

export default function EnterDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const email = searchParams.get('email') || searchParams.get('e');
    const token = searchParams.get('token') || searchParams.get('t');

    if (!email) {
      setStatus('error');
      setErrorMsg('No authentication context provided.');
      return;
    }

    const resolve = async () => {
      try {
        const params = new URLSearchParams({ email });
        if (token) params.set('state', token);

        const res = await fetch(`/api/access/enter?${params}`);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setStatus('error');
          setErrorMsg(err.detail?.message || 'Access not granted.');
          return;
        }

        const data: AccessResult = await res.json();

        if (!data.accessGranted) {
          if (data.redirectTo) {
            navigate(data.redirectTo, { replace: true });
          } else {
            setStatus('error');
            setErrorMsg(data.message || 'Access pending.');
          }
          return;
        }

        // Access granted — set session and enter dashboard
        setAuthEmail(email);
        navigate('/', { replace: true });
      } catch {
        setStatus('error');
        setErrorMsg('Failed to verify access. Please try again.');
      }
    };

    resolve();
  }, [searchParams, navigate]);

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="enter-dashboard-error">
        <div className="text-center max-w-md">
          <svg className="w-16 h-16 text-red-500/60 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">Access Issue</h2>
          <p className="text-slate-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]" data-testid="enter-dashboard-loading">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Verifying access...</p>
      </div>
    </div>
  );
}
