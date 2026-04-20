// API service for fetching data from the backend
const API_BASE = '/api';

import { getAuthEmail } from './auth';

export interface Deal {
  id: string;
  deal: string;
  spv: string;
  sellerName: string;
  address: string;
  state: string;
  county: string;
  location: string;
  price: number;
  payment: number;
  senior: number;
  mezz: number;
  equity: number;
  agentCommission: number;
  netToSeller: number;
  status: 'Active' | 'Pending' | 'Locked';
  totalCapital: number;
  unitSize: number;
  units: number;
  unitsSold: number;
  propertyType: string;
  businessUse: string;
}

export interface DashboardData {
  totalDeals: number;
  activeSPVs: number;
  totalCapital: number;
  avgMonthlyPayment: number;
  statusCounts: {
    Active: number;
    Pending: number;
    Locked: number;
  };
  recentDeals: Deal[];
}

export interface SPV {
  id: string;
  name: string;
  deals: string[];
  totalCapital: number;
  dealCount: number;
  status: string;
}

export interface UserInfo {
  email: string;
  ownerName: string;
  licenseLevel: string;
  assignedSpvId: string;
  licenseId?: string;
}

export interface CapsInfo {
  maxActiveRequests: number;
  canParticipate: boolean;
  activeOrderCount: number;
  capReached: boolean;
}

export interface ReleasedOpportunity {
  spvId: string;
  dealId: string;
  releaseToLevel: string;
  visibilityMode: string;
  ctaLabel: string;
  ctaState: string;
  accessState: string;
  approvalRequired: boolean;
  capacityStatus: string;
  maxOrders: number;
  currentOrders: number;
  notes: string;
  deal: Record<string, string>;
  capitalStack: Record<string, string>;
  dealSummary: Record<string, string>;
  validation: Record<string, string>;
}

export interface FullDashboardData {
  user: UserInfo;
  personalContext: {
    stats: { totalDeals: number; activeSPVs: number; totalUnits: number; unitsSold: number };
    mainMaps: Record<string, string>[];
    spvRegistry: Record<string, string>[];
    capitalStack: Record<string, string>[];
    waterfall: Record<string, string>[];
    dealSummary: Record<string, string>[];
    validation: Record<string, string>[];
    orders: Record<string, string>[];
  };
  opportunities: ReleasedOpportunity[];
  caps: CapsInfo;
}

// Map license_level from Licensed Users sheet to visibility state
// LEVEL_1 = teaser (restricted), LEVEL_2 = preview (expanded), LEVEL_3 = full (operator)
export function licenseToVisibility(licenseLevel: string): VisibilityState {
  switch (licenseLevel) {
    case 'LEVEL_3': return 'full';
    case 'LEVEL_2': return 'preview';
    case 'LEVEL_1':
    default: return 'teaser';
  }
}

// Whether waterfall data is visible for a given license level
export function licenseAllowsWaterfall(licenseLevel: string): boolean {
  return licenseLevel === 'LEVEL_3';
}

export interface UserDashboardData extends DashboardData {
  user: UserInfo;
}

// Fetch the full multi-sheet dashboard (new primary endpoint)
export async function fetchFullDashboard(): Promise<FullDashboardData> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/user/dashboard?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    if (response.status === 403) throw new Error('Access denied');
    if (response.status === 404) throw new Error('User not found');
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

// Submit a controlled request action
export async function submitRequestAction(action: string): Promise<{ success: boolean; message: string }> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  const response = await fetch(`${API_BASE}/user/request-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || err.detail?.message || 'Request failed');
  }
  return response.json();
}

// Resolve authenticated user from Bolt session email
export async function resolveUser(): Promise<UserInfo | null> {
  const email = getAuthEmail();
  if (!email) return null;
  
  const response = await fetch(`${API_BASE}/user/resolve?email=${encodeURIComponent(email)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return {
    email: data.email,
    ownerName: data.ownerName,
    licenseLevel: data.licenseLevel,
    assignedSpvId: data.assignedSpvId,
  };
}

// Fetch dashboard scoped to authenticated user's SPV
export async function fetchUserDashboard(): Promise<UserDashboardData> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_BASE}/user/dashboard?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    if (response.status === 403) throw new Error('Access denied — user not licensed');
    if (response.status === 404) throw new Error('User not found');
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

// Fetch deals scoped to authenticated user's SPV
export async function fetchUserDeals(): Promise<Deal[]> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_BASE}/user/deals?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Failed to fetch deals');
  const data = await response.json();
  return data.deals;
}

// Fetch SPVs scoped to authenticated user
export async function fetchUserSPVs(): Promise<SPV[]> {
  const email = getAuthEmail();
  if (!email) throw new Error('Not authenticated');
  
  const response = await fetch(`${API_BASE}/user/spvs?email=${encodeURIComponent(email)}`);
  if (!response.ok) throw new Error('Failed to fetch SPVs');
  const data = await response.json();
  return data.spvs;
}

// Fetch all deals
export async function fetchDeals(): Promise<Deal[]> {
  const response = await fetch(`${API_BASE}/deals`);
  if (!response.ok) {
    throw new Error('Failed to fetch deals');
  }
  const data = await response.json();
  return data.deals;
}

// Fetch single deal by ID
export async function fetchDealById(dealId: string): Promise<Deal> {
  const response = await fetch(`${API_BASE}/deals/${dealId}`);
  if (!response.ok) {
    throw new Error(`Deal ${dealId} not found`);
  }
  return response.json();
}

// Fetch dashboard metrics
export async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE}/dashboard`);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }
  return response.json();
}

// Fetch SPVs
export async function fetchSPVs(): Promise<SPV[]> {
  const response = await fetch(`${API_BASE}/spvs`);
  if (!response.ok) {
    throw new Error('Failed to fetch SPVs');
  }
  const data = await response.json();
  return data.spvs;
}

// Visibility types from orchestration layer
export type VisibilityState = 'blocked' | 'teaser' | 'preview' | 'full';

export interface SPVVisibility {
  visibilityState: VisibilityState;
  waterfallVisible: boolean;
  disclosureLevel: string;
}

export interface VisibilityMap {
  [spvId: string]: SPVVisibility;
}

// Fetch visibility states for all SPVs
export async function fetchSPVVisibility(): Promise<VisibilityMap> {
  const response = await fetch(`${API_BASE}/spv-visibility`);
  if (!response.ok) {
    throw new Error('Failed to fetch visibility data');
  }
  const data = await response.json();
  return data.visibility;
}

// Get visibility for a specific SPV (defaults to teaser if not found)
export function getVisibility(map: VisibilityMap, spvId: string): SPVVisibility {
  return map[spvId] || { visibilityState: 'teaser', waterfallVisible: false, disclosureLevel: 'teaser' };
}

// Check if a field should be visible at the given visibility state
export function isFieldVisible(visibility: VisibilityState, field: string): boolean {
  const rules: Record<string, VisibilityState[]> = {
    // Always visible (teaser+)
    spvId: ['teaser', 'preview', 'full'],
    county: ['teaser', 'preview', 'full'],
    state: ['teaser', 'preview', 'full'],
    location: ['teaser', 'preview', 'full'],
    status: ['teaser', 'preview', 'full'],
    propertyType: ['teaser', 'preview', 'full'],
    dealCount: ['teaser', 'preview', 'full'],
    // Preview+
    price: ['preview', 'full'],
    payment: ['preview', 'full'],
    senior: ['preview', 'full'],
    mezz: ['preview', 'full'],
    equity: ['preview', 'full'],
    totalCapital: ['preview', 'full'],
    units: ['preview', 'full'],
    unitsSold: ['preview', 'full'],
    // Full only
    address: ['full'],
    sellerName: ['full'],
    netToSeller: ['full'],
    agentCommission: ['full'],
    businessUse: ['full'],
    unitSize: ['full'],
  };
  const allowed = rules[field];
  if (!allowed) return visibility === 'full';
  return allowed.includes(visibility);
}

// Format currency
export function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}
