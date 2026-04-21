export default function AccessPending() {
  return (
    <div className="flex items-center justify-center min-h-[400px]" data-testid="access-pending-page">
      <div className="text-center max-w-md">
        <svg className="w-16 h-16 text-amber-500/60 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Access Pending</h2>
        <p className="text-slate-400">Your access is currently being reviewed. You will receive a notification once your account has been activated.</p>
      </div>
    </div>
  );
}
