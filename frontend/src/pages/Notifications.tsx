import { useState, useEffect } from 'react';
import { getAuthEmail, isAuthenticated } from '../api/auth';

const API = '/api';

interface Notification {
  notification_id: string;
  notification_type: string;
  message_body: string;
  target_level: string | null;
  target_user: string | null;
  related_spv_id: string | null;
  related_deal_id: string | null;
  notification_status: string;
  sent_timestamp: string;
}

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  'Deal Approved': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  'Deal Closed': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  'Request Approved': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  'Participation Approved': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  'Review Required': { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  'Capital Call Reminder': { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  'Participation Pending': { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  'Document Uploaded': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
  'Opportunity Released': { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
  'Request Denied': { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
  'Capacity Full': { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400' },
};

function getStyle(type: string) {
  return typeStyles[type] || { bg: 'bg-slate-700/30', border: 'border-slate-600/30', icon: 'text-slate-400' };
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { setError('Not authenticated. Please log in via Bolt.'); setLoading(false); return; }
    const email = getAuthEmail();
    fetch(`${API}/user/notifications?email=${encodeURIComponent(email || '')}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(d => { setNotifications(d.notifications || []); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  if (error) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-red-400">{error}</p></div>;

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="notifications-empty">
        <div className="text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-slate-400">No notifications at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <span className="text-sm text-slate-400">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => {
          const s = getStyle(n.notification_type);
          return (
            <div key={n.notification_id}
              className={`p-4 rounded-2xl border transition-base ${s.bg} ${s.border}`}
              data-testid={`notification-${n.notification_id}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${s.bg} ${s.icon} flex-shrink-0`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-white">{n.notification_type}</h3>
                    <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo(n.sent_timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1">{n.message_body}</p>
                  {(n.related_spv_id || n.related_deal_id) && (
                    <div className="flex gap-3 mt-2">
                      {n.related_spv_id && <span className="text-xs text-slate-500">SPV: {n.related_spv_id}</span>}
                      {n.related_deal_id && <span className="text-xs text-slate-500">Deal: {n.related_deal_id}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
