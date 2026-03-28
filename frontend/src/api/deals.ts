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
