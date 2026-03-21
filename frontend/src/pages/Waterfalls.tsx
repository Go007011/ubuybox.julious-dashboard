export default function Waterfalls() {
  const tiers = [
    { tier: 'Return of Capital', description: 'Initial investment return', rate: '100%', amount: 500000, status: 'paid' },
    { tier: 'Preferred Return', description: '8% preferred return to LPs', rate: '8%', amount: 40000, status: 'paid' },
    { tier: 'Catch-Up', description: 'GP catch-up to 20%', rate: '20%', amount: 10000, status: 'pending' },
    { tier: 'Carried Interest', description: '80/20 split after catch-up', rate: '80/20', amount: 25000, status: 'projected' },
  ];

  const totalDistributed = tiers.filter(t => t.status === 'paid').reduce((sum, t) => sum + t.amount, 0);
  const totalPending = tiers.filter(t => t.status !== 'paid').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6" data-testid="waterfalls-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Distributed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">${totalDistributed.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Pending Distribution</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">${totalPending.toLocaleString()}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Current Tier</p>
          <p className="text-2xl font-bold text-white mt-1">Catch-Up</p>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Distribution Waterfall</h2>
        <div className="space-y-4">
          {tiers.map((tier, idx) => (
            <div key={idx} className="relative">
              {idx < tiers.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-6 bg-slate-700" />
              )}
              <div className={`flex items-start gap-4 p-4 rounded-xl border ${
                tier.status === 'paid' ? 'bg-emerald-500/5 border-emerald-500/30' :
                tier.status === 'pending' ? 'bg-amber-500/5 border-amber-500/30' :
                'bg-slate-800/50 border-slate-700/50'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tier.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                  tier.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-slate-700 text-slate-500'
                }`}>
                  {tier.status === 'paid' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{tier.tier}</h3>
                      <p className="text-sm text-slate-400 mt-0.5">{tier.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">${tier.amount.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">{tier.rate}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        tier.status === 'paid' ? 'bg-emerald-500' :
                        tier.status === 'pending' ? 'bg-amber-500' : 'bg-slate-600'
                      }`}
                      style={{ width: tier.status === 'paid' ? '100%' : tier.status === 'pending' ? '50%' : '0%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
