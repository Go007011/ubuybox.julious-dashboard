const spvData = [
  { name: 'SPV_017', deal: 'Deal_017', status: 'Active', formed: '2024-01-15', totalCapital: 515000, investors: 3 },
  { name: 'SPV_021', deal: 'Deal_021', status: 'Pending', formed: '2024-02-20', totalCapital: 720000, investors: 5 },
  { name: 'SPV_023', deal: 'Deal_023', status: 'Active', formed: '2024-03-10', totalCapital: 890000, investors: 4 },
  { name: 'SPV_025', deal: 'Deal_025', status: 'Closed', formed: '2023-11-05', totalCapital: 550000, investors: 2 },
];

export default function SPVRegistry() {
  const totalCapital = spvData.reduce((sum, spv) => sum + spv.totalCapital, 0);
  const activeSPVs = spvData.filter(spv => spv.status === 'Active').length;

  return (
    <div className="space-y-6" data-testid="spv-registry-page">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total SPVs</p>
          <p className="text-2xl font-bold text-white mt-1">{spvData.length}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Active SPVs</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeSPVs}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-sm text-slate-400">Total Capital Managed</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">${(totalCapital / 1000000).toFixed(2)}M</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">SPV Registry</h2>
          <button className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-base">
            + New SPV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">SPV Name</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Deal</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Date Formed</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Total Capital</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase">Investors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {spvData.map((spv) => (
                <tr key={spv.name} className="hover:bg-slate-800/30 transition-base">
                  <td className="px-6 py-4 text-sm text-white font-medium">{spv.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.deal}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      spv.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' :
                      spv.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      {spv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.formed}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">${spv.totalCapital.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{spv.investors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
