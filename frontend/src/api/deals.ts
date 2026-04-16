// API service for fetching data from the backend
const API_BASE = '/api';

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
