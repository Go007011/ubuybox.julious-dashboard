import { getAuthEmail } from './auth';

export interface MenuItem {
  id: string;
  menu_label: string;
  path: string;
  source_sheet_name: string;
  icon_name: string;
  enabled: boolean;
  allowed_levels: string[];
  admin_only: boolean;
  hidden_but_queryable: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface MenuDiagnostic {
  source_sheet_name: string;
  severity: string;
  code: string;
  title: string;
  message: string;
}

export async function fetchUserMenu(): Promise<MenuItem[] | null> {
  const email = getAuthEmail();
  if (!email) return null;
  try {
    const res = await fetch(`/api/menu?email=${encodeURIComponent(email)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : null;
  } catch {
    return null;
  }
}

export async function fetchAdminMenu(): Promise<MenuItem[]> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error('Failed to load menu config');
  const data = await res.json();
  return data.items || [];
}

export async function fetchMenuDiagnostics(): Promise<MenuDiagnostic[]> {
  const email = getAuthEmail();
  if (!email) return [];
  try {
    const res = await fetch(`/api/admin/menu/diagnostics?email=${encodeURIComponent(email)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.diagnostics || [];
  } catch {
    return [];
  }
}

export async function updateMenuItem(id: string, patch: Partial<MenuItem>): Promise<MenuItem> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update failed');
  }
  const data = await res.json();
  return data.item;
}

export async function createMenuItem(item: Partial<MenuItem>): Promise<MenuItem> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu?email=${encodeURIComponent(email)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Create failed');
  }
  const data = await res.json();
  return data.item;
}

export async function deleteMenuItem(id: string): Promise<void> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Delete failed');
  }
}

export async function reorderMenu(order: string[]): Promise<MenuItem[]> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, order }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Reorder failed');
  }
  const data = await res.json();
  return data.items || [];
}

export async function resetMenuDefaults(): Promise<MenuItem[]> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const res = await fetch(`/api/admin/menu/reset-defaults?email=${encodeURIComponent(email)}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Reset failed');
  const data = await res.json();
  return data.items || [];
}

// Small icon library used across the app. Values are SVG path `d` strings.
export const MENU_ICON_PATHS: Record<string, string> = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  plus: 'M12 4v16m8-8H4',
  stack: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  chart: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  'doc-text': 'M9 17v-2a4 4 0 014-4h4m-4-4V5a2 2 0 012-2h2a2 2 0 012 2v4m-6 4h6m-6 4h6M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2h-3l-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  file: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  bars: 'M4 6h16M4 12h10M4 18h6',
  cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  sliders: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
  shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
};

export function getIconPath(name: string): string {
  return MENU_ICON_PATHS[name] || MENU_ICON_PATHS.doc;
}
