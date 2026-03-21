const documents = [
  { name: 'Operating Agreement', type: 'PDF', deal: 'Deal_017', uploadedAt: '2024-01-15', size: '2.4 MB' },
  { name: 'Capital Stack Breakdown', type: 'PDF', deal: 'Deal_017', uploadedAt: '2024-01-15', size: '1.1 MB' },
  { name: 'Subscription Agreement', type: 'PDF', deal: 'Deal_017', uploadedAt: '2024-01-16', size: '3.2 MB' },
  { name: 'Property Appraisal', type: 'PDF', deal: 'Deal_021', uploadedAt: '2024-02-20', size: '5.6 MB' },
  { name: 'Title Report', type: 'PDF', deal: 'Deal_021', uploadedAt: '2024-02-21', size: '1.8 MB' },
  { name: 'Insurance Certificate', type: 'PDF', deal: 'Deal_023', uploadedAt: '2024-03-10', size: '450 KB' },
];

export default function Documents() {
  return (
    <div className="space-y-6" data-testid="documents-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <p className="text-slate-400">{documents.length} documents across all deals</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              className="bg-transparent border-none outline-none text-sm text-slate-300 placeholder-slate-500 w-40"
            />
          </div>
          <button className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-base flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc, idx) => (
          <div key={idx} className="glass-card p-5 hover:border-blue-500/30 transition-base cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:bg-blue-500/20 transition-base">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate group-hover:text-blue-400 transition-base">{doc.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{doc.deal}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-slate-800 rounded">{doc.type}</span>
                  <span>{doc.size}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
              <span className="text-xs text-slate-500">Uploaded {doc.uploadedAt}</span>
              <button className="text-slate-400 hover:text-white transition-base">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
