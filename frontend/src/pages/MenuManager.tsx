import { useState, useEffect, useMemo } from 'react';
import {
  fetchAdminMenu,
  fetchMenuDiagnostics,
  updateMenuItem,
  createMenuItem,
  deleteMenuItem,
  reorderMenu,
  resetMenuDefaults,
  MENU_ICON_PATHS,
  type MenuItem,
  type MenuDiagnostic,
} from '../api/menu';
import { getAuthEmail, isAuthenticated } from '../api/auth';

type TabKey = 'items' | 'diagnostics' | 'preview';

const LEVEL_OPTIONS = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'];

export default function MenuManager() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<MenuItem[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<MenuItem>>>({});
  const [diagnostics, setDiagnostics] = useState<MenuDiagnostic[]>([]);
  const [tab, setTab] = useState<TabKey>('items');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    id: '',
    menu_label: '',
    path: '',
    source_sheet_name: '—',
    icon_name: 'doc',
    enabled: true,
    allowed_levels: ['LEVEL_3'],
    admin_only: false,
    hidden_but_queryable: false,
    sort_order: 999,
  });

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated()) {
        setError('Sign in required.');
        setLoading(false);
        return;
      }
      const email = getAuthEmail();
      try {
        const [list, diag, adminCheck] = await Promise.all([
          fetchAdminMenu(),
          fetchMenuDiagnostics(),
          fetch(`/api/admin/check?email=${encodeURIComponent(email || '')}`).then((r) => r.json()),
        ]);
        if (!adminCheck.isAdmin) {
          setError('Admin access required.');
          setLoading(false);
          return;
        }
        setItems(list);
        setDiagnostics(diag);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load menu config.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const dirtyIds = useMemo(() => Object.keys(draft).filter((id) => Object.keys(draft[id] || {}).length > 0), [draft]);

  const mergedItems = useMemo(
    () => items.map((it) => ({ ...it, ...(draft[it.id] || {}) })) as MenuItem[],
    [items, draft],
  );

  function stageChange(id: string, patch: Partial<MenuItem>) {
    setDraft((d) => ({ ...d, [id]: { ...(d[id] || {}), ...patch } }));
  }

  async function handleSaveAll() {
    if (dirtyIds.length === 0) {
      setMessage({ kind: 'ok', text: 'No pending changes.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      for (const id of dirtyIds) {
        await updateMenuItem(id, draft[id]);
      }
      const fresh = await fetchAdminMenu();
      setItems(fresh);
      setDraft({});
      setMessage({ kind: 'ok', text: `Saved ${dirtyIds.length} change${dirtyIds.length === 1 ? '' : 's'}.` });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(id: string, dir: -1 | 1) {
    const ordered = [...mergedItems].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= ordered.length) return;
    const arr = [...ordered];
    const [m] = arr.splice(idx, 1);
    arr.splice(target, 0, m);
    try {
      const fresh = await reorderMenu(arr.map((x) => x.id));
      setItems(fresh);
      setDraft({});
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Reorder failed.' });
    }
  }

  async function handleCreate() {
    if (!newItem.menu_label || !newItem.path) {
      setMessage({ kind: 'err', text: 'Label and path are required.' });
      return;
    }
    try {
      await createMenuItem(newItem);
      const fresh = await fetchAdminMenu();
      setItems(fresh);
      setShowAdd(false);
      setNewItem({
        id: '',
        menu_label: '',
        path: '',
        source_sheet_name: '—',
        icon_name: 'doc',
        enabled: true,
        allowed_levels: ['LEVEL_3'],
        admin_only: false,
        hidden_but_queryable: false,
        sort_order: 999,
      });
      setMessage({ kind: 'ok', text: 'Item added.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Create failed.' });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete menu item "${id}"? This cannot be undone.`)) return;
    try {
      await deleteMenuItem(id);
      setItems((arr) => arr.filter((x) => x.id !== id));
      setDraft((d) => {
        const n = { ...d };
        delete n[id];
        return n;
      });
      setMessage({ kind: 'ok', text: `Deleted "${id}".` });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Delete failed.' });
    }
  }

  async function handleResetDefaults() {
    if (!confirm('Reset ALL menu items to defaults? This deletes any custom items.')) return;
    try {
      const fresh = await resetMenuDefaults();
      setItems(fresh);
      setDraft({});
      setMessage({ kind: 'ok', text: 'Menu reset to defaults.' });
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : 'Reset failed.' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center" data-testid="menu-manager-error">
        <h2 className="text-xl font-semibold text-white mb-2">Menu Manager Unavailable</h2>
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  const sortedItems = [...mergedItems].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6" data-testid="menu-manager-page">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="menu-manager-title">Menu Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure dashboard navigation, visibility, and level access
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyIds.length > 0 && (
            <span className="text-xs text-amber-400 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              {dirtyIds.length} unsaved
            </span>
          )}
          <button
            onClick={handleResetDefaults}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-base"
            data-testid="menu-manager-reset-defaults"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving || dirtyIds.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-base"
            data-testid="menu-manager-save-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            message.kind === 'ok'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              : 'bg-red-500/10 text-red-300 border-red-500/20'
          }`}
          data-testid="menu-manager-message"
        >
          {message.text}
        </div>
      )}

      {/* Tab bar */}
      <div className="inline-flex items-center gap-1 p-1 bg-slate-900/70 border border-slate-800 rounded-xl" data-testid="menu-manager-tabs">
        {([
          { key: 'items', label: 'Menu Items', count: items.length },
          { key: 'diagnostics', label: 'Diagnostics', count: diagnostics.length },
          { key: 'preview', label: 'Live Preview', count: sortedItems.filter((i) => i.enabled && !i.hidden_but_queryable).length },
        ] as { key: TabKey; label: string; count: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-base ${
              tab === t.key ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'text-slate-400 hover:text-white border border-transparent'
            }`}
            data-testid={`menu-manager-tab-${t.key}`}
          >
            {t.label} <span className="text-xs text-slate-500 ml-1">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <div className="space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Menu Items</h2>
                <p className="text-xs text-slate-500 mt-1">Toggle, rename, assign levels, or reorder the sidebar.</p>
              </div>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="text-sm font-medium text-orange-400 hover:text-orange-300 transition-base"
                data-testid="menu-manager-add-toggle"
              >
                {showAdd ? '× Cancel' : '+ Add Item'}
              </button>
            </div>

            {showAdd && (
              <div className="mb-6 p-4 bg-slate-800/40 rounded-xl border border-slate-700/60" data-testid="menu-manager-add-form">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LabeledInput label="ID (slug)" value={newItem.id || ''} onChange={(v) => setNewItem({ ...newItem, id: v })} placeholder="e.g. custom-reports" />
                  <LabeledInput label="Menu Label" value={newItem.menu_label || ''} onChange={(v) => setNewItem({ ...newItem, menu_label: v })} placeholder="Custom Reports" />
                  <LabeledInput label="Path" value={newItem.path || ''} onChange={(v) => setNewItem({ ...newItem, path: v })} placeholder="/custom-reports" />
                  <LabeledInput label="Source Sheet" value={newItem.source_sheet_name || ''} onChange={(v) => setNewItem({ ...newItem, source_sheet_name: v })} placeholder="—" />
                  <IconSelect value={newItem.icon_name || 'doc'} onChange={(v) => setNewItem({ ...newItem, icon_name: v })} />
                  <LabeledInput label="Sort Order" type="number" value={String(newItem.sort_order ?? 999)} onChange={(v) => setNewItem({ ...newItem, sort_order: Number(v) || 999 })} />
                </div>
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <LevelPills value={newItem.allowed_levels || []} onChange={(v) => setNewItem({ ...newItem, allowed_levels: v })} />
                  <InlineToggle label="Admin only" value={!!newItem.admin_only} onChange={(v) => setNewItem({ ...newItem, admin_only: v })} />
                  <InlineToggle label="Hidden but queryable" value={!!newItem.hidden_but_queryable} onChange={(v) => setNewItem({ ...newItem, hidden_but_queryable: v })} />
                  <button
                    onClick={handleCreate}
                    className="ml-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-base"
                    data-testid="menu-manager-add-submit"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-800">
              {sortedItems.map((item, idx) => {
                const isDirty = !!draft[item.id] && Object.keys(draft[item.id]).length > 0;
                return (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0" data-testid={`menu-item-row-${item.id}`}>
                    <div className="flex items-start gap-3 flex-wrap">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleMove(item.id, -1)}
                          disabled={idx === 0}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                          data-testid={`menu-item-${item.id}-up`}
                          aria-label="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                        </button>
                        <button
                          onClick={() => handleMove(item.id, 1)}
                          disabled={idx === sortedItems.length - 1}
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300"
                          data-testid={`menu-item-${item.id}-down`}
                          aria-label="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                      </div>

                      {/* Enabled toggle */}
                      <div className="pt-1">
                        <Toggle
                          checked={item.enabled}
                          onChange={(v) => stageChange(item.id, { enabled: v })}
                          testid={`menu-item-${item.id}-enabled`}
                        />
                      </div>

                      {/* Main fields */}
                      <div className="flex-1 min-w-[260px] space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={item.menu_label}
                            onChange={(e) => stageChange(item.id, { menu_label: e.target.value })}
                            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-white font-medium w-56 focus:outline-none focus:border-orange-500"
                            data-testid={`menu-item-${item.id}-label`}
                          />
                          <code className="text-xs px-2 py-1 bg-slate-800/60 border border-slate-800 rounded-md text-slate-400">{item.path}</code>
                          <span
                            className="text-xs px-2 py-1 rounded-md border border-slate-700 bg-slate-800/40 text-slate-300"
                            data-testid={`menu-item-${item.id}-sheet`}
                          >
                            {item.source_sheet_name || '—'}
                          </span>
                          {isDirty && <span className="text-[10px] uppercase tracking-wide text-amber-400">Modified</span>}
                        </div>

                        <div className="flex items-center gap-4 flex-wrap text-xs">
                          <LevelPills
                            value={item.allowed_levels}
                            onChange={(v) => stageChange(item.id, { allowed_levels: v })}
                            testidPrefix={`menu-item-${item.id}`}
                          />
                          <InlineToggle
                            label="Admin only"
                            value={item.admin_only}
                            onChange={(v) => stageChange(item.id, { admin_only: v })}
                            testid={`menu-item-${item.id}-admin-only`}
                          />
                          <InlineToggle
                            label="Hidden but queryable"
                            value={item.hidden_but_queryable}
                            onChange={(v) => stageChange(item.id, { hidden_but_queryable: v })}
                            testid={`menu-item-${item.id}-hidden`}
                          />
                          <IconSelect
                            value={item.icon_name}
                            onChange={(v) => stageChange(item.id, { icon_name: v })}
                            testid={`menu-item-${item.id}-icon`}
                            compact
                          />
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs text-slate-500 hover:text-red-400 transition-base"
                        data-testid={`menu-item-${item.id}-delete`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics tab */}
      {tab === 'diagnostics' && (
        <div className="glass-card p-6" data-testid="menu-manager-diagnostics">
          <h2 className="text-lg font-semibold text-white">Admin-Only Diagnostics</h2>
          <p className="text-xs text-slate-500 mt-1">
            Source-sheet health signals. Never shown to regular users.
          </p>
          <div className="mt-4 space-y-3">
            {diagnostics.length === 0 ? (
              <p className="text-sm text-slate-400">No diagnostic warnings.</p>
            ) : (
              diagnostics.map((d, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
                  data-testid={`diagnostic-${d.source_sheet_name.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.73 4a2 2 0 00-3.46 0L3.33 16a2 2 0 001.74 3z" />
                      </svg>
                      {d.severity}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{d.source_sheet_name}</p>
                      <p className="text-sm text-amber-200/80 mt-0.5">{d.title}</p>
                      <p className="text-xs text-slate-400 mt-2">{d.message}</p>
                      <code className="inline-block mt-2 text-[11px] text-slate-500">code: {d.code}</code>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Live preview tab */}
      {tab === 'preview' && (
        <div className="glass-card p-6" data-testid="menu-manager-preview">
          <h2 className="text-lg font-semibold text-white">Live Sidebar Preview</h2>
          <p className="text-xs text-slate-500 mt-1">
            This reflects items currently visible in the sidebar (enabled and not hidden). Filtered by each user's level at render time.
          </p>
          <div className="mt-4 max-w-sm p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div className="space-y-1">
              {sortedItems
                .filter((i) => i.enabled && !i.hidden_but_queryable)
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300"
                    data-testid={`preview-item-${i.id}`}
                  >
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={MENU_ICON_PATHS[i.icon_name] || MENU_ICON_PATHS.doc} />
                    </svg>
                    <span>{i.menu_label}</span>
                    <span className="ml-auto text-[10px] text-slate-600">
                      {i.admin_only ? 'ADMIN' : i.allowed_levels.map((l) => l.replace('LEVEL_', 'L')).join('·')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- small inline components ----

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
      />
    </label>
  );
}

function Toggle({ checked, onChange, testid }: { checked: boolean; onChange: (v: boolean) => void; testid?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-base ${
        checked ? 'bg-orange-500' : 'bg-slate-700'
      }`}
      data-testid={testid}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function InlineToggle({
  label,
  value,
  onChange,
  testid,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testid?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <Toggle checked={value} onChange={onChange} testid={testid} />
      <span className="text-xs text-slate-400">{label}</span>
    </label>
  );
}

function LevelPills({
  value,
  onChange,
  testidPrefix,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  testidPrefix?: string;
}) {
  const toggle = (lvl: string) => {
    if (value.includes(lvl)) onChange(value.filter((x) => x !== lvl));
    else onChange([...value, lvl]);
  };
  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-xs text-slate-500 mr-1">Levels:</span>
      {LEVEL_OPTIONS.map((lvl) => {
        const active = value.includes(lvl);
        return (
          <button
            key={lvl}
            type="button"
            onClick={() => toggle(lvl)}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-base ${
              active
                ? 'bg-orange-500/15 text-orange-300 border-orange-500/40'
                : 'bg-slate-800/40 text-slate-500 border-slate-700 hover:text-slate-300'
            }`}
            data-testid={testidPrefix ? `${testidPrefix}-level-${lvl}` : undefined}
          >
            {lvl.replace('LEVEL_', 'L')}
          </button>
        );
      })}
    </div>
  );
}

function IconSelect({
  value,
  onChange,
  testid,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  testid?: string;
  compact?: boolean;
}) {
  const iconKeys = Object.keys(MENU_ICON_PATHS);
  if (compact) {
    return (
      <label className="inline-flex items-center gap-2">
        <span className="text-xs text-slate-500">Icon:</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-white focus:outline-none focus:border-orange-500"
          data-testid={testid}
        >
          {iconKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">Icon</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-white focus:outline-none focus:border-orange-500"
        data-testid={testid}
      >
        {iconKeys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  );
}
