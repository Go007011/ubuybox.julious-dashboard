# UBUYBOX Dashboard - Product Requirements Document

## Project Overview
**Name:** UBUYBOX Investment Dashboard  
**Type:** Full-Stack Fintech SaaS Dashboard  
**Tech Stack:** 
- Backend: FastAPI (Python) + Google Sheets API
- Frontend: Vite + React 18 + TypeScript + Tailwind CSS  
**Updated:** March 28, 2026

## Architecture

```
Google Sheets (Source of Truth)
       ↓
  Backend API (FastAPI :8001)
       ↓
  Frontend (Vite :3000 with proxy)
       ↓
  UBUYBOX Dashboard UI
```

## Data Source
**Google Sheet:** `1N8-PD3654Qcd65r9Etc2Z1ayZbHB0X5m__URQYFYVeY`

### Sheet Fields:
- Deal_ID, SPV_ID, Seller Name, Property Address
- State, County, Purchase Price, Monthly Payment To Seller
- Seller Carryback, Agent's Commission, Cash At Closing To Seller
- Net Cash To Seller, Status, TOTAL_CAPITAL_REQUIRED
- UNIT_SIZE, TOTAL_UNITS, UNITS_SOLD, Property_Type

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/deals` | GET | All deals from Google Sheets |
| `/api/deals/:id` | GET | Single deal by Deal_ID |
| `/api/spvs` | GET | Deals grouped by SPV_ID |
| `/api/dashboard` | GET | Aggregated metrics |

## Data Transformation

```typescript
{
  deal: Deal_ID,
  spv: SPV_ID,
  location: `${County}, ${State}`,
  price: Purchase_Price,
  payment: Monthly_Payment_To_Seller,
  senior: Seller_Carryback,
  equity: Cash_At_Closing_To_Seller,
  mezz: totalCapital - senior - equity,  // Computed
  status: Status,
  totalCapital: TOTAL_CAPITAL_REQUIRED
}
```

## What's Been Implemented ✅

### Backend (FastAPI)
- ✅ Google Sheets CSV export integration
- ✅ GET /api/deals - Returns 20 deals
- ✅ GET /api/deals/:id - Single deal lookup
- ✅ GET /api/spvs - Grouped SPV data
- ✅ GET /api/dashboard - Aggregated metrics
- ✅ Data transformation and number parsing
- ✅ Status normalization (Active/Pending/Locked)

### Frontend (React + TypeScript)
- ✅ API service layer (`/src/api/deals.ts`)
- ✅ Dashboard with live stats from Google Sheets
- ✅ Capital Stack page with all deals
- ✅ Deal Detail page with API fetch
- ✅ SPV Registry with grouped data
- ✅ Loading states and error handling
- ✅ Custom UBUYBOX logo

### Live Metrics (from Google Sheets)
- **20 Total Deals**
- **20 Active SPVs**
- **$13.79M Total Capital**
- **$1,107 Avg Monthly Payment**
- **Capital Distribution:** 48% Senior, 50% Mezz, 1.5% Equity

## Test Results
- Backend: 100% pass (5/5 endpoints)
- Frontend: 95% pass (all pages load with live data)

## Files Structure

```
/app/
├── backend/
│   ├── server.py         # FastAPI with Google Sheets integration
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── api/deals.ts  # API service layer
│   │   ├── pages/        # Dashboard, CapitalStack, DealDetail, etc.
│   │   └── components/   # DealCard, StatCard, etc.
│   ├── public/logo.png   # Custom UBUYBOX logo
│   └── vite.config.ts    # Proxy configuration
```

## Example API Response

```json
// GET /api/deals/Deal_011
{
  "id": "Deal_011",
  "deal": "Deal_011",
  "spv": "SPV_011",
  "address": "111 Poplar St",
  "location": "DeKalb, GA",
  "price": 360000,
  "payment": 940,
  "senior": 338400,
  "mezz": 0,
  "equity": 10800,
  "status": "Pending",
  "totalCapital": 100000
}
```

## Next Tasks
1. Add authentication for secure access
2. Implement real-time sync with WebSockets
3. Add filtering/sorting on Capital Stack page
4. Enable document upload functionality
