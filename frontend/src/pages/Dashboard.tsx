import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { fetchFullDashboard, formatCurrency, submitRequestAction, type FullDashboardData, type ReleasedOpportunity } from '../api/deals';
import { isAuthenticated } from '../api/auth';

function BuildingIcon() {
  return <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>;
}
function UnitIcon() {
  return <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
}
function OppsIcon() {
  return <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}
function ChartIcon() {
  return <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
}

function CtaBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    'Available': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Approval Required': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Restricted': 'bg-red-500/10 text-red-400 border-red-500/30',
    'Full': 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[state] || styles['Restricted']}`} data-testid="cta-badge">{state}</span>;
}

function VisBadge({ mode }: { mode: string }) {
  const styles: Record<string, string> = {
    'teaser': 'bg-amber-500/10 text-amber-400',
    'preview': 'bg-blue-500/10 text-blue-400',
    'full': 'bg-emerald-500/10 text-emerald-400',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[mode] || 'bg-slate-500/10 text-slate-400'}`}>{mode}</span>;
}

function OpportunityCard({ opp, onRequest }: { opp: ReleasedOpportunity; onRequest: (spvId: string, action: string) => void }) {
  const d = opp.deal;
  const ds = opp.dealSummary;
  const cs = opp.capitalStack;
  const showFinancials = opp.visibilityMode === 'preview' || opp.visibilityMode === 'full';

  return (
    <div className="glass-card p-5 hover:border-slate-600/50 transition-base" data-testid={`opp-card-${opp.spvId}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{opp.dealId}</h3>
            <VisBadge mode={opp.visibilityMode} />
          </div>
          <p className="text-sm text-slate-400">{opp.spvId} • {d.State || ''}{d.County ? `, ${d.County}` : ''}</p>
        </div>
        <CtaBadge state={opp.ctaState} />
      </div>

      {/* Deal Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
        {d.Property_Type && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Type</p>
            <p className="text-sm text-white">{d.Property_Type}</p>
          </div>
        )}
        {d.TOTAL_UNITS && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Units</p>
            <p className="text-sm text-white">{d.UNITS_SOLD || 0} / {d.TOTAL_UNITS}</p>
          </div>
        )}
        {d.Status && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Status</p>
            <p className={`text-sm font-medium ${d.Status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}`}>{d.Status}</p>
          </div>
        )}
        {showFinancials && d.Purchase_Price && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Price</p>
            <p className="text-sm text-emerald-400">{formatCurrency(parseFloat(d.Purchase_Price || '0'))}</p>
          </div>
        )}
        {showFinancials && d.TOTAL_CAPITAL_REQUIRED && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Capital</p>
            <p className="text-sm text-blue-400">{formatCurrency(parseFloat(d.TOTAL_CAPITAL_REQUIRED || '0'))}</p>
          </div>
        )}
        {showFinancials && cs.Total_Capital && cs.Total_Capital !== 'Restricted' && (
          <div className="p-2 bg-slate-800/40 rounded-lg">
            <p className="text-xs text-slate-500">Risk</p>
            <p className="text-sm text-white">{cs.Risk_Profile || 'N/A'}</p>
          </div>
        )}
      </div>

      {/* Deal Summary */}
      {ds.Deal_Name && (
        <p className="text-xs text-slate-500 mb-2">{ds.Deal_Name}{ds.Risk_Summary ? ` • ${ds.Risk_Summary}` : ''}</p>
      )}

      {/* Capacity bar */}
      {opp.maxOrders > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Capacity</span>
            <span>{opp.currentOrders}/{opp.maxOrders}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${opp.currentOrders >= opp.maxOrders ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((opp.currentOrders / opp.maxOrders) * 100, 100)}%` }} />
          </div>
        </div>
      )}

      {/* CTA — uses per-viewer-level label and state */}
      {(opp.ctaState === 'Available' || opp.ctaState === 'Approval Required') && opp.ctaLabel && (
        <button
          onClick={() => onRequest(opp.spvId, opp.ctaLabel.toLowerCase().includes('participation') ? 'request_participation' : opp.ctaLabel.toLowerCase().includes('manage') ? 'request_access' : 'request_review')}
          className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-base ${
            opp.ctaState === 'Available'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
          }`}
          data-testid={`opp-request-${opp.spvId}`}
        >
          {opp.ctaLabel}
        </button>
      )}
      {opp.ctaState === 'Full' && (
        <p className="text-center text-xs text-slate-500 py-2">This opportunity is at capacity</p>
      )}
      {opp.ctaState === 'Restricted' && (
        <p className="text-center text-xs text-slate-500 py-2">Access restricted</p>
      )}
    </div>
  );
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

  if (loading) return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  if (error || !data) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-red-400">{error}</p></div>;

  const { user, personalContext, opportunities, caps } = data;
  const pc = personalContext;
  const personalDeal = pc.mainMaps[0] || {};
  const personalSummary = pc.dealSummary[0] || {};
  const personalValid = pc.validation[0] || {};

  const handleRequest = async (spvId: string, action: string) => {
    try {
      const res = await submitRequestAction(action);
      setRequestMsg(`${spvId}: ${res.message}`);
    } catch (e: any) { setRequestMsg(e.message); }
  };

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My SPV" value={user.assignedSpvId} change={`${pc.stats.totalDeals} deal(s)`} changeType="positive" icon={<BuildingIcon />} iconBg="bg-blue-500/10" />
        <StatCard title="My Units" value={pc.stats.totalUnits} change={`${pc.stats.unitsSold} sold`} changeType="neutral" icon={<UnitIcon />} iconBg="bg-purple-500/10" />
        <StatCard title="Active Opportunities" value={opportunities.length} change={`Released to ${user.licenseLevel}`} changeType="positive" icon={<OppsIcon />} iconBg="bg-emerald-500/10" />
        <StatCard title="Requests" value={`${caps.activeOrderCount}/${caps.maxActiveRequests}`} change={caps.capReached ? 'Limit reached' : 'Available'} changeType={caps.capReached ? 'neutral' : 'positive'} icon={<ChartIcon />} iconBg="bg-orange-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Opportunities */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white">Active Opportunities</h2>
          {opportunities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map(opp => (
                <OpportunityCard key={`${opp.spvId}-${opp.dealId}`} opp={opp} onRequest={handleRequest} />
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-slate-400">No opportunities currently released for your access level.</p>
            </div>
          )}
          {requestMsg && (
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
              <p className="text-sm text-blue-400">{requestMsg}</p>
            </div>
          )}
        </div>

        {/* Right: Personal Context */}
        <div className="space-y-4">
          {/* Personal SPV */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-white mb-3">My Position</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">SPV</span><span className="text-white">{user.assignedSpvId}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Level</span><span className="text-white">{user.licenseLevel}</span></div>
              {personalDeal.Property_Type && <div className="flex justify-between"><span className="text-slate-400">Type</span><span className="text-white">{personalDeal.Property_Type}</span></div>}
              {personalDeal.Status && <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={personalDeal.Status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}>{personalDeal.Status}</span></div>}
              {personalValid.Overall_Status && <div className="flex justify-between"><span className="text-slate-400">Validation</span><span className={personalValid.Overall_Status === 'VALID' ? 'text-emerald-400' : 'text-amber-400'}>{personalValid.Overall_Status}</span></div>}
            </div>
          </div>

          {/* Deal Summary */}
          {personalSummary.Deal_Name && (
            <div className="glass-card p-5">
              <h3 className="font-semibold text-white mb-3">Deal Summary</h3>
              <p className="text-sm text-slate-300">{personalSummary.Deal_Name}</p>
              {personalSummary.Risk_Summary && <p className="text-xs text-slate-500 mt-1">{personalSummary.Risk_Summary}</p>}
            </div>
          )}

          {/* Quick Links */}
          <div className="glass-card p-5">
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
