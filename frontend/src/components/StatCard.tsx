interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  iconBg: string;
}

export default function StatCard({ title, value, change, changeType, icon, iconBg }: StatCardProps) {
  const changeColors = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-slate-400'
  };

  const changePrefix = {
    positive: '↑ ',
    negative: '↓ ',
    neutral: ''
  };

  return (
    <div className="glass-card p-5 hover:border-slate-600/50 transition-base" data-testid="stat-card">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl lg:text-3xl font-bold text-white">{value}</p>
          <p className={`text-sm ${changeColors[changeType]}`}>
            {changePrefix[changeType]}{change}
          </p>
        </div>
        <div className={`p-3 rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
