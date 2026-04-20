import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DealCard from '../components/DealCard';
import ActivityFeed from '../components/ActivityFeed';
import QuickActions from '../components/QuickActions';
import { fetchUserDashboard, formatCurrency, licenseToVisibility, type Deal, type UserDashboardData, type VisibilityState, type UserInfo } from '../api/deals';
import { isAuthenticated } from '../api/auth';

// Icon components for stat cards
const BuildingIcon = () => (
  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const DollarIcon = () => (
  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Activity type based on deal status changes
const generateActivities = (deals: Deal[]) => {
  return deals.slice(0, 4).map((deal, idx) => ({
    id: String(idx),
    action: `${deal.deal} - ${deal.location}`,
    time: deal.status === 'Active' ? 'Recently active' : 'Pending review',
    type: deal.status === 'Active' ? 'success' as const : deal.status === 'Locked' ? 'warning' as const : 'info' as const,
  }));
};

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState<UserDashboardData | null>(null);
  const [visibility, setVisibility] = useState<VisibilityState>('teaser');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await fetchUserDashboard();
        setDashboardData(data);
        setUserInfo(data.user || null);
        if (data.user) {
          setVisibility(licenseToVisibility(data.user.licenseLevel));
        }
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to load dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated()) {
      loadDashboard();
    } else {
      setError('Not authenticated. Please log in via Bolt.');
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Failed to load data'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { totalDeals, activeSPVs, totalCapital, avgMonthlyPayment, statusCounts, recentDeals } = dashboardData;
  const activities = generateActivities(recentDeals);
  const showFinancials = visibility === 'preview' || visibility === 'full';

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Deals"
          value={totalDeals}
          change={`${statusCounts.Active} active`}
          changeType="positive"
          icon={<BuildingIcon />}
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Active SPVs"
          value={activeSPVs}
          change={`${statusCounts.Pending} pending`}
          changeType="neutral"
          icon={<DocumentIcon />}
          iconBg="bg-purple-500/10"
        />
        <StatCard
          title="Total Capital"
          value={showFinancials ? formatCurrency(totalCapital) : 'Restricted'}
          change={showFinancials ? 'From Google Sheets' : `Requires ${visibility === 'teaser' ? 'Level 2+' : 'upgrade'}`}
          changeType={showFinancials ? 'positive' : 'neutral'}
          icon={<DollarIcon />}
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Avg. Monthly Payment"
          value={showFinancials ? `$${avgMonthlyPayment.toLocaleString()}` : 'Restricted'}
          change={showFinancials ? 'Across all deals' : `Requires ${visibility === 'teaser' ? 'Level 2+' : 'upgrade'}`}
          changeType={showFinancials ? 'neutral' : 'neutral'}
          icon={<ChartIcon />}
          iconBg="bg-orange-500/10"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Deals - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Deals</h2>
            <Link 
              to="/capital" 
              className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-base"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-4">
            {recentDeals.slice(0, 3).map((deal) => (
              <DealCard key={deal.id} deal={deal} visibility={visibility} />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <ActivityFeed activities={activities} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
