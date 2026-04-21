export default function AccessDenied() {
  return (
    <div className="flex items-center justify-center min-h-[400px]" data-testid="access-denied-page">
      <div className="text-center max-w-md">
        <svg className="w-16 h-16 text-red-500/60 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">Your account does not have access to this dashboard. If you believe this is an error, please contact support.</p>
      </div>
    </div>
  );
}
