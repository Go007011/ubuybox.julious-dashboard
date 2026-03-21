import { Link } from 'react-router-dom';

export default function QuickActions() {
  return (
    <div className="glass-card p-5" data-testid="quick-actions">
      <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
      <div className="space-y-3">
        <Link
          to="/intake"
          className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-orange-500/30 hover:bg-slate-800/80 transition-base group"
        >
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:bg-orange-500/20 transition-base">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-base">
            New Opportunity
          </span>
        </Link>

        <Link
          to="/documents"
          className="flex items-center gap-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-blue-500/30 hover:bg-slate-800/80 transition-base group"
        >
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-base">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-base">
            Upload Document
          </span>
        </Link>
      </div>
    </div>
  );
}
