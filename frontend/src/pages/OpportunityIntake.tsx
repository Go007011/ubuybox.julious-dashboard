export default function OpportunityIntake() {
  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="opportunity-intake-page">
      <p className="text-slate-400">Submit a new investment opportunity for review</p>

      <form className="space-y-6">
        <div className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Property Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Property Address</label>
            <input
              type="text"
              placeholder="123 Main Street"
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">City</label>
              <input
                type="text"
                placeholder="Austin"
                className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">State</label>
              <input
                type="text"
                placeholder="TX"
                className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Property Type</label>
            <select className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-orange-500/50 transition-base">
              <option>Single Family</option>
              <option>Multi Family</option>
              <option>Commercial</option>
              <option>Land</option>
            </select>
          </div>
        </div>

        <div className="glass-card p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Financial Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  placeholder="500,000"
                  className="w-full pl-8 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Estimated Value</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  placeholder="600,000"
                  className="w-full pl-8 pr-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Additional Notes</label>
            <textarea
              rows={4}
              placeholder="Any additional information about the opportunity..."
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50 transition-base resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button type="button" className="px-6 py-3 text-slate-400 hover:text-white transition-base">
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-base"
          >
            Submit Opportunity
          </button>
        </div>
      </form>
    </div>
  );
}
