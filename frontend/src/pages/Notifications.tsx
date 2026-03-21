const notifications = [
  { id: '1', title: 'Deal Approved', message: 'Deal_017 has been approved and is ready for funding.', type: 'success', time: '2 hours ago', read: false },
  { id: '2', title: 'Document Uploaded', message: 'New document added to SPV_021 - Property Appraisal.', type: 'info', time: '4 hours ago', read: false },
  { id: '3', title: 'Capital Call Reminder', message: 'Capital call for Deal_015 is scheduled for next week.', type: 'warning', time: '1 day ago', read: true },
  { id: '4', title: 'Deal Closed', message: 'Deal_019 has been successfully closed. View final documents.', type: 'success', time: '2 days ago', read: true },
  { id: '5', title: 'Review Required', message: 'Deal_025 requires your review before proceeding.', type: 'error', time: '3 days ago', read: true },
];

const typeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-400' },
};

const typeIcons: Record<string, string> = {
  success: 'M5 13l4 4L19 7',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export default function Notifications() {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <p className="text-slate-400">
          {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
        </p>
        <button className="text-sm text-orange-500 hover:text-orange-400 font-medium transition-base">
          Mark all as read
        </button>
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => {
          const styles = typeStyles[notification.type];
          const iconPath = typeIcons[notification.type];
          
          return (
            <div 
              key={notification.id}
              className={`p-5 rounded-2xl border transition-base cursor-pointer ${
                notification.read 
                  ? 'bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50' 
                  : `${styles.bg} ${styles.border} hover:opacity-90`
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-xl ${styles.bg} ${styles.icon} flex-shrink-0`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={`font-medium ${notification.read ? 'text-slate-300' : 'text-white'}`}>
                        {notification.title}
                      </h3>
                      <p className={`text-sm mt-1 ${notification.read ? 'text-slate-500' : 'text-slate-400'}`}>
                        {notification.message}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{notification.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
