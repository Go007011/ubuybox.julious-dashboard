import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import DealCard from '../components/DealCard';
import ActivityFeed from '../components/ActivityFeed';
import QuickActions from '../components/QuickActions';
import { deals, activities, stats } from '../data/mockData';

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

export default function Dashboard() {
  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Deals"
          value={stats.totalDeals.value}
          change={stats.totalDeals.change}
          changeType="positive"
          icon={<BuildingIcon />}
          iconBg="bg-blue-500/10"
        />
        <StatCard
          title="Active SPVs"
          value={stats.activeSPVs.value}
          change={stats.activeSPVs.change}
          changeType="neutral"
          icon={<DocumentIcon />}
          iconBg="bg-purple-500/10"
        />
        <StatCard
          title="Total Capital"
          value={stats.totalCapital.value}
          change={stats.totalCapital.change}
          changeType="positive"
          icon={<DollarIcon />}
          iconBg="bg-emerald-500/10"
        />
        <StatCard
          title="Avg. Monthly Payment"
          value={stats.avgPayment.value}
          change={stats.avgPayment.change}
          changeType="negative"
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
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
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
