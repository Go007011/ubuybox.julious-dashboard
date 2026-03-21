// Mock data for the dashboard
export interface Deal {
  id: string;
  deal: string;
  spv: string;
  location: string;
  price: number;
  senior: number;
  mezz: number;
  equity: number;
  payment: number;
  status: 'Active' | 'Pending' | 'Locked';
}

export interface Activity {
  id: string;
  action: string;
  time: string;
  type: 'success' | 'info' | 'warning';
}

export const deals: Deal[] = [
  {
    id: '1',
    deal: 'Deal_017',
    spv: 'SPV_017',
    location: 'Bexar County, TX',
    price: 495000,
    senior: 465300,
    mezz: 20000,
    equity: 29700,
    payment: 1292,
    status: 'Active',
  },
  {
    id: '2',
    deal: 'Deal_021',
    spv: 'SPV_021',
    location: 'Atlanta, GA',
    price: 720000,
    senior: 650000,
    mezz: 40000,
    equity: 30000,
    payment: 2100,
    status: 'Pending',
  },
];

export const activities: Activity[] = [
  { id: '1', action: 'Deal_017 approved', time: '2 hours ago', type: 'success' },
  { id: '2', action: 'New document uploaded to SPV_021', time: '4 hours ago', type: 'info' },
  { id: '3', action: 'Capital call scheduled for Deal_015', time: '1 day ago', type: 'warning' },
  { id: '4', action: 'Deal_019 closed successfully', time: '2 days ago', type: 'success' },
];

export const stats = {
  totalDeals: { value: 24, change: '+3 this month', positive: true },
  activeSPVs: { value: 18, change: '2 pending', neutral: true },
  totalCapital: { value: '$12.4M', change: '+8.2% vs last quarter', positive: true },
  avgPayment: { value: '$1,696', change: '-2.1% vs last month', positive: false },
};
