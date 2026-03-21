import type { Activity } from '../data/mockData';

interface ActivityFeedProps {
  activities: Activity[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const dotColors = {
    success: 'bg-emerald-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500'
  };

  return (
    <div className="glass-card p-5" data-testid="activity-feed">
      <h3 className="text-base font-semibold text-white mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${dotColors[activity.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 leading-relaxed">{activity.action}</p>
              <p className="text-xs text-slate-500 mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
