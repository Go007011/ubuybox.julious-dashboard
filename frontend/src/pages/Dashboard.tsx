import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { fetchFullDashboard, formatCurrency, licenseToVisibility, submitRequestAction, type FullDashboardData, type VisibilityState } from '../api/deals';
import { isAuthenticated } from '../api/auth';

function BuildingIcon() {
  return <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function ChartIcon() {
  return <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
}
function UnitIcon() {
  return <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function CheckIcon() {
  return <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

export default function Dashboard() {
  const [data, setData] = useState<FullDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestMsg, setRequestMsg] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { setError('Not authenticated. Please log in via Bolt.'); setLoading(false); return; }
    fetchFullDashboard().then(d => { setData(d); setError(null); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-red-400">{error}</p></div>;

  const { user, stats, mainMaps, dealSummary, validation, caps } = data;
  const vis = licenseToVisibility(user.licenseLevel);
  const showFinancials = vis === 'preview' || vis === 'full';
  const deal = mainMaps[0] || {};
  const summary = dealSummary[0] || {};
  const valid = validation[0] || {};

  const handleRequest = async (action: string) => {
    try {
      const res = await submitRequestAction(action);
      setRequestMsg(res.message);
    } catch (e: any) { setRequestMsg(e.message); }
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Deals" value={stats.totalDeals} change={`${stats.activeSPVs} active SPV`} changeType="positive" icon={<BuildingIcon />} iconBg="bg-blue-500/10" />
        <StatCard title="Total Units" value={stats.totalUnits} change={`${stats.unitsSold} sold`} changeType="neutral" icon={<UnitIcon />} iconBg="bg-purple-500/10" />
        <StatCard title="Validation" value={valid.Overall_Status || 'N/A'} change={summary.Risk_Summary ? summary.Risk_Summary.slice(0, 30) : ''} changeType={valid.Overall_Status === 'VALID' ? 'positive' : 'neutral'} icon={<CheckIcon />} iconBg="bg-emerald-500/10" />
        <StatCard title="Business Use" value={deal.Property_Type || 'N/A'} change={`${deal.State || ''}, ${deal.County || ''}`} changeType="neutral" icon={<ChartIcon />} iconBg="bg-orange-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deal Info */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Deal Overview</h2>
          {mainMaps.map((m, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{m.Deal_ID}</h3>
                  <p className="text-sm text-slate-400">{m.SPV_ID} • {m.State}, {m.County}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${m.Status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{m.Status}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Property Type</p><p className="text-sm font-medium text-white mt-1">{m.Property_Type || 'N/A'}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Business Use</p><p className="text-sm font-medium text-white mt-1">{(m.Target_Business_Use || 'N/A').slice(0, 40)}</p></div>
                <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Units</p><p className="text-sm font-medium text-white mt-1">{m.UNITS_SOLD || 0} / {m.TOTAL_UNITS || 0}</p></div>
                {showFinancials && m.Purchase_Price && (
                  <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Purchase Price</p><p className="text-sm font-medium text-emerald-400 mt-1">{formatCurrency(parseFloat(m.Purchase_Price || '0'))}</p></div>
                )}
                {showFinancials && m.TOTAL_CAPITAL_REQUIRED && (
                  <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Total Capital</p><p className="text-sm font-medium text-blue-400 mt-1">{formatCurrency(parseFloat(m.TOTAL_CAPITAL_REQUIRED || '0'))}</p></div>
                )}
                {showFinancials && m.Monthly_Payment && (
                  <div className="p-3 bg-slate-800/50 rounded-xl"><p className="text-xs text-slate-500">Monthly Payment</p><p className="text-sm font-medium text-white mt-1">{formatCurrency(parseFloat(m.Monthly_Payment || '0'))}</p></div>
                )}
              </div>
              {m.Partner_Updates && (
                <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <p className="text-xs text-blue-400 font-medium">Partner Updates</p>
                  <p className="text-sm text-slate-300 mt-1">{m.Partner_Updates}</p>
                </div>
              )}
            </div>
          ))}

          {/* Deal Summary */}
          {summary.Deal_Name && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-3">Deal Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between"><span className="text-slate-400 text-sm">Deal Name</span><span className="text-white text-sm">{summary.Deal_Name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400 text-sm">State</span><span className="text-white text-sm">{summary.State}</span></div>
                {summary.Risk_Summary && <div className="flex justify-between"><span className="text-slate-400 text-sm">Risk</span><span className="text-white text-sm">{summary.Risk_Summary}</span></div>}
                {showFinancials && summary.Capital_Stack_Display && <div className="flex justify-between"><span className="text-slate-400 text-sm">Capital Stack</span><span className="text-white text-sm">{summary.Capital_Stack_Display}</span></div>}
                {vis === 'full' && summary.Waterfall_Display && <div className="flex justify-between"><span className="text-slate-400 text-sm">Waterfall</span><span className="text-white text-sm">{summary.Waterfall_Display}</span></div>}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Controlled Actions */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-white mb-4">Actions</h3>
            {caps.capReached ? (
              <p className="text-sm text-amber-400">Request limit reached ({caps.activeOrderCount}/{caps.maxActiveRequests})</p>
            ) : (
              <div className="space-y-2">
                <button onClick={() => handleRequest('request_review')} className="w-full px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-xl hover:bg-blue-500/20 transition-base" data-testid="request-review-btn">Request Review</button>
                {caps.canParticipate && (
                  <button onClick={() => handleRequest('request_participation')} className="w-full px-4 py-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-medium rounded-xl hover:bg-orange-500/20 transition-base" data-testid="request-participation-btn">Request Participation</button>
                )}
                <button onClick={() => handleRequest('request_access')} className="w-full px-4 py-2.5 bg-slate-700/50 border border-slate-600/30 text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-700 transition-base" data-testid="request-access-btn">Request Access</button>
              </div>
            )}
            {requestMsg && <p className="text-xs text-slate-400 mt-3">{requestMsg}</p>}
          </div>

          {/* Quick Links */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-white mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/capital" className="block text-sm text-slate-400 hover:text-white transition-base">Capital Stack →</Link>
              <Link to="/spv" className="block text-sm text-slate-400 hover:text-white transition-base">SPV Registry →</Link>
              <Link to="/waterfalls" className="block text-sm text-slate-400 hover:text-white transition-base">Waterfalls →</Link>
              <Link to="/holdco" className="block text-sm text-slate-400 hover:text-white transition-base">HoldCo Summary →</Link>
              <Link to="/documents" className="block text-sm text-slate-400 hover:text-white transition-base">Documents →</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
