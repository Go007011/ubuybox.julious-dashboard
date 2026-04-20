import { useState, useEffect } from 'react';
import { getAuthEmail, isAuthenticated } from '../api/auth';

const ADMIN_EMAIL = 'mrbraboy+007011@gmail.com';
const API = '/api';
const adminEmail = () => encodeURIComponent(getAuthEmail() || '');

async function apiFetch(path: string) {
  const res = await fetch(`${API}${path}?email=${adminEmail()}`);
  if (!res.ok) throw new Error('Access denied');
  return res.json();
}

async function apiPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: getAuthEmail(), ...body }),
  });
  return res.json();
}

type Tab = 'requests' | 'orders' | 'releases' | 'users' | 'notifications';

export default function AdminControl() {
  const currentEmail = getAuthEmail()?.toLowerCase() || '';
  const isAdmin = isAuthenticated() && currentEmail === ADMIN_EMAIL;

  const [tab, setTab] = useState<Tab>('requests');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const loadTab = async (t: Tab) => {
    setLoading(true); setMsg('');
    try {
      const d = await apiFetch(`/admin/${t}`);
      setData(d);
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadTab(tab); }, [tab]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const doAction = async (path: string, body: Record<string, unknown>) => {
    const res = await apiPost(path, body);
    setMsg(res.message || res.success ? 'Action completed' : 'Failed');
    loadTab(tab);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'requests', label: 'Requests Queue' },
    { key: 'orders', label: 'Orders Control' },
    { key: 'releases', label: 'Release Control' },
    { key: 'users', label: 'User Access' },
    { key: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-6" data-testid="admin-control-page">
      {/* Tab Nav */}
      <div className="flex gap-1 p-1 bg-slate-900 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-base ${tab === t.key ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            data-testid={`admin-tab-${t.key}`}
          >{t.label}</button>
        ))}
      </div>

      {msg && <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-400">{msg}</div>}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="glass-card overflow-hidden">
          {tab === 'requests' && <RequestsPanel data={data} onAction={doAction} />}
          {tab === 'orders' && <OrdersPanel data={data} onAction={doAction} />}
          {tab === 'releases' && <ReleasesPanel data={data} onAction={doAction} />}
          {tab === 'users' && <UsersPanel data={data} onAction={doAction} />}
          {tab === 'notifications' && <NotificationsPanel data={data} onAction={doAction} />}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
    slate: 'bg-slate-700/50 text-slate-300 border-slate-600/30 hover:bg-slate-700',
  };
  return <button onClick={onClick} className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-base ${colors[color] || colors.slate}`}>{label}</button>;
}

function RequestsPanel({ data, onAction }: { data: any; onAction: (p: string, b: any) => void }) {
  const requests = data?.requests || [];
  if (!requests.length) return <div className="p-8 text-center text-slate-400">No requests in queue</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-slate-700/50">
          {['ID','Email','Level','SPV','Type','Status','Time','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-700/50">
          {requests.map((r: any, i: number) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-4 py-3 text-xs text-slate-300 font-mono">{r.request_id}</td>
              <td className="px-4 py-3 text-xs text-white">{r.user_email}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{r.license_level}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{r.spv_id}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{r.request_type}</td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.request_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : r.request_status === 'denied' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>{r.request_status}</span></td>
              <td className="px-4 py-3 text-xs text-slate-500">{r.timestamp?.slice(0,16)}</td>
              <td className="px-4 py-3 flex gap-1">
                <ActionBtn label="Approve" color="green" onClick={() => onAction('/admin/requests/action', { requestId: r.request_id, action: 'approve' })} />
                <ActionBtn label="Deny" color="red" onClick={() => onAction('/admin/requests/action', { requestId: r.request_id, action: 'deny' })} />
                <ActionBtn label="Escalate" color="amber" onClick={() => onAction('/admin/requests/action', { requestId: r.request_id, action: 'escalate' })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersPanel({ data, onAction }: { data: any; onAction: (p: string, b: any) => void }) {
  const orders = data?.orders || [];
  if (!orders.length) return <div className="p-8 text-center text-slate-400">No orders found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-slate-700/50">
          {['Order ID','Partner','SPV','Units','Investment','Payment','Level','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-700/50">
          {orders.map((o: any, i: number) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-4 py-3 text-xs text-slate-300 font-mono">{o.Order_ID}</td>
              <td className="px-4 py-3 text-xs text-white">{o.Partner_Email || o.Partner_Name}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{o.SPV_ID}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{o.Units_Bought}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{o.Total_Investment}</td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${o.Payment_Status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{o.Payment_Status}</span></td>
              <td className="px-4 py-3 text-xs text-slate-300">{o.Buyer_Level}</td>
              <td className="px-4 py-3 flex gap-1">
                <ActionBtn label="Approve" color="green" onClick={() => onAction('/admin/orders/action', { orderId: o.Order_ID, action: 'approve' })} />
                <ActionBtn label="Hold" color="amber" onClick={() => onAction('/admin/orders/action', { orderId: o.Order_ID, action: 'hold' })} />
                <ActionBtn label="Reject" color="red" onClick={() => onAction('/admin/orders/action', { orderId: o.Order_ID, action: 'reject' })} />
                <ActionBtn label="Complete" color="blue" onClick={() => onAction('/admin/orders/action', { orderId: o.Order_ID, action: 'complete' })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReleasesPanel({ data, onAction }: { data: any; onAction: (p: string, b: any) => void }) {
  const releases = data?.releases || [];
  if (!releases.length) return <div className="p-8 text-center text-slate-400">No releases configured</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-slate-700/50">
          {['SPV','Deal','Status','Level','Visibility','Approval','Capacity','Max','Current','Access','Actions'].map(h => <th key={h} className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-700/50">
          {releases.map((r: any, i: number) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-3 py-3 text-xs text-white font-medium">{r.spv_id}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.deal_id}</td>
              <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.release_status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{r.release_status}</span></td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.release_to_level}</td>
              <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${r.visibility_mode === 'full' ? 'bg-emerald-500/10 text-emerald-400' : r.visibility_mode === 'preview' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>{r.visibility_mode}</span></td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.approval_required}</td>
              <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${r.capacity_status === 'Open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{r.capacity_status}</span></td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.max_orders_allowed}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.current_orders_count}</td>
              <td className="px-3 py-3 text-xs text-slate-300">{r.opportunity_access_state}</td>
              <td className="px-3 py-3 flex gap-1 flex-wrap">
                <ActionBtn label="Release" color="green" onClick={() => onAction('/admin/releases/action', { spvId: r.spv_id, action: 'release' })} />
                <ActionBtn label="Pause" color="amber" onClick={() => onAction('/admin/releases/action', { spvId: r.spv_id, action: 'pause' })} />
                <ActionBtn label="Close" color="red" onClick={() => onAction('/admin/releases/action', { spvId: r.spv_id, action: 'close' })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersPanel({ data, onAction }: { data: any; onAction: (p: string, b: any) => void }) {
  const users = data?.users || [];
  if (!users.length) return <div className="p-8 text-center text-slate-400">No users found</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-slate-700/50">
          {['Email','License ID','Level','Status','Assigned SPV','Access Type','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-700/50">
          {users.map((u: any, i: number) => (
            <tr key={i} className="hover:bg-slate-800/30">
              <td className="px-4 py-3 text-xs text-white">{u.email}</td>
              <td className="px-4 py-3 text-xs text-slate-300 font-mono">{u.license_id}</td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${u.license_level === 'LEVEL_3' ? 'bg-emerald-500/10 text-emerald-400' : u.license_level === 'LEVEL_2' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>{u.license_level}</span></td>
              <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${u.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{u.status}</span></td>
              <td className="px-4 py-3 text-xs text-slate-300">{u.assigned_spv_id}</td>
              <td className="px-4 py-3 text-xs text-slate-300">{u.access_type}</td>
              <td className="px-4 py-3 flex gap-1 flex-wrap">
                <ActionBtn label="Upgrade" color="green" onClick={() => onAction('/admin/users/action', { targetEmail: u.email, action: 'upgrade' })} />
                <ActionBtn label="Downgrade" color="amber" onClick={() => onAction('/admin/users/action', { targetEmail: u.email, action: 'downgrade' })} />
                <ActionBtn label="Suspend" color="red" onClick={() => onAction('/admin/users/action', { targetEmail: u.email, action: 'suspend' })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotificationsPanel({ data, onAction }: { data: any; onAction: (p: string, b: any) => void }) {
  const notifs = data?.notifications || [];
  const [form, setForm] = useState({ notificationType: 'general', targetLevel: '', targetUser: '', relatedSpvId: '', message: '' });

  return (
    <div className="p-6 space-y-6">
      {/* Send form */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Send Notification</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={form.notificationType} onChange={e => setForm({...form, notificationType: e.target.value})} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="general">General</option><option value="opportunity">Opportunity</option><option value="status_update">Status Update</option><option value="approval">Approval</option>
          </select>
          <select value={form.targetLevel} onChange={e => setForm({...form, targetLevel: e.target.value})} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white">
            <option value="">All Levels</option><option value="LEVEL_1">Level 1</option><option value="LEVEL_2">Level 2</option><option value="LEVEL_3">Level 3</option>
          </select>
          <input value={form.targetUser} onChange={e => setForm({...form, targetUser: e.target.value})} placeholder="Target email (optional)" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500" />
          <input value={form.relatedSpvId} onChange={e => setForm({...form, relatedSpvId: e.target.value})} placeholder="SPV ID (optional)" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500" />
        </div>
        <input value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="Notification message..." className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500" />
        <div className="flex gap-2">
          <ActionBtn label="Send" color="green" onClick={() => onAction('/admin/notifications/action', { action: 'send', ...form })} />
          <ActionBtn label="Draft" color="slate" onClick={() => onAction('/admin/notifications/action', { action: 'draft', ...form })} />
        </div>
      </div>

      {/* History */}
      {notifs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-700/50">
              {['ID','Type','Level','User','SPV','Status','Time','Actions'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {notifs.map((n: any, i: number) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-xs text-slate-300 font-mono">{n.notification_id}</td>
                  <td className="px-4 py-3 text-xs text-white">{n.notification_type}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.target_level || 'All'}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.target_user || 'All'}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{n.related_spv_id || '-'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${n.status === 'sent' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{n.status}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{n.sent_timestamp?.slice(0,16)}</td>
                  <td className="px-4 py-3 flex gap-1">
                    <ActionBtn label="Resend" color="blue" onClick={() => onAction('/admin/notifications/action', { action: 'resend', notificationType: n.notification_type, targetLevel: n.target_level, targetUser: n.target_user, relatedSpvId: n.related_spv_id, message: n.message })} />
                    <ActionBtn label="Archive" color="slate" onClick={() => onAction('/admin/notifications/action', { action: 'archive', notificationType: n.notification_type })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500 text-center py-4">No notifications sent yet</p>
      )}
    </div>
  );
}
