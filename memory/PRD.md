# UBUYBOX SPV Dashboard — Product Requirements Document

## Original Problem Statement
Build a full-stack real estate SPV dashboard (UBUYBOX):
1. Recreate the UI using React, Tailwind CSS, and Vite
2. Build a backend API to fetch live data from a read-only Google Sheet
3. Create a production-safe orchestration interface for an external client ("OpenClaw") to control SPV visibility, disclosure states, and waterfall gating at the app layer without mutating the Google Sheet

## System Labels
- **Google Sheets**: Source of truth (read-only)
- **Emergent backend**: FastAPI orchestration/data API
- **Emergent frontend**: React/Vite/Tailwind UI
- **OpenClaw**: External orchestration client

## Architecture
- Frontend: React + TypeScript + Vite 5 + Tailwind CSS (port 3000)
- Backend: FastAPI + Uvicorn (port 8001)
- Data source: Google Sheets via CSV export (read-only)
- Orchestration state: In-memory (app-layer only, never writes to Sheets)
- Auth: Bearer token for orchestration endpoints

## What's Been Implemented

### Phase 1: UI Recreation (Complete)
- Dashboard with stat cards, recent deals, activity feed
- Capital Stack page with portfolio distribution visualization
- SPV Registry with visibility and waterfall columns
- Deal Detail page with capital stack visualization and metrics
- Waterfalls page with live data and gating
- Sidebar navigation, header, responsive layout

### Phase 2: Backend Data Pipeline (Complete)
- Google Sheets CSV parsing via httpx
- Deal normalization (price, status, capital stack computation)
- Endpoints: /api/deals, /api/dashboard, /api/spvs, /api/deals/:id, /api/health

### Phase 3: Orchestration API (Complete — Tested 2026-04-16)
- Health check: GET /api/orchestration/health
- Load SPV: POST /api/orchestration/load-spv
- Set Disclosure: POST /api/orchestration/set-disclosure
- Set Waterfall Permission: POST /api/orchestration/set-waterfall-permission
- Status Intelligence: GET /api/orchestration/status/{spvId}
- Resolve Visibility: POST /api/orchestration/resolve-visibility
- Frontend Visibility Map: GET /api/spv-visibility

### Phase 4: Frontend Visibility Enforcement (Complete — Tested 2026-04-16)

### Phase 5: Visibility Logic Invariant Fix (Complete — 2026-04-17)
- Replaced two separate functions (`determine_visibility_state` + `compute_waterfall_visibility`) with single unified `resolve_spv_visibility_state` that enforces invariants
- Added `nextSafeAction` field to all orchestration responses
- Enforced: if resolvedVisibility=full then safeToDisplay must be true
- Enforced: if safeToDisplay=false then resolvedVisibility cannot be full (downgrades to preview/teaser)
- Enforced: if missingFields=[] and blockingReasons=[] and SPV exists, safeToDisplay must be true
- Enforced: if waterfallVisible=true, SPV cannot be blocked
- blockingReasons now merges both field and waterfall sources before computing safeToDisplay
- Root cause: safeToDisplay and resolvedVisibility were computed from different inputs independently with no post-computation invariant check
- DealCard accepts visibility prop, masks fields per disclosure level
- Dashboard, CapitalStack, SPVRegistry, DealDetail, Waterfalls all enforce masking
- blocked: shows SPV ID and blocked message only
- teaser: shows county, state, property type, status — hides price, capital stack, seller
- preview: shows price, capital stack, units — hides seller, address, waterfall
- full: shows all permitted fields — waterfall gated separately
- Waterfalls page: shows data only when waterfallVisible=true per SPV

### Phase 6: User-Scoped Dashboard via Licensed Users (Complete — 2026-04-20)
- New Google Sheet: 1EmXsM7W_ny28d4YRh8M3U7mOLO9uC5tjQKJF11Z7AeA
- Access-control tab (gid=1056764769): email → assigned_spv_id lookup
- New backend endpoints: /api/user/resolve, /api/user/dashboard, /api/user/deals, /api/user/spvs
- Frontend reads Bolt session email (via URL ?email= param or localStorage)
- Dashboard, Capital Stack, SPV Registry, Waterfalls all scoped to user's assigned SPV only
- Sidebar shows user profile (ownerName, SPV, license level) when authenticated
- Shows "Not authenticated" with email login when no session
- No mock data — all live from Google Sheets
- Bolt handles auth/login, Emergent reads sheets and serves scoped data, OpenClaw is messaging only

### Phase 7: License-Level Visibility Rules (Complete — 2026-04-20)
- LEVEL_1 (teaser): deal count, SPV name, county/state, status visible. Prices, capital stack, waterfall, HoldCo, Documents all restricted
- LEVEL_2 (preview): + purchase price, monthly payment, capital stack breakdown, portfolio distribution, HoldCo summary, Documents
- LEVEL_3 (full): + address, seller name, net to seller, waterfall data, document upload
- Applied to: Dashboard stats, DealCard, DealDetail, CapitalStack, SPVRegistry, Waterfalls, HoldCo Summary, Documents
- Frontend uses `licenseToVisibility()` mapper from Licensed Users sheet license_level field
- No UI redesign — same layout, just content gated by level

## Backlog

### P1: Persistent Orchestration State
- Currently in-memory (resets on backend restart)
- Consider MongoDB or file-based persistence for disclosure levels and waterfall permissions

### P2: Data Quality
- Property_Type column in Google Sheets contains numeric values (20, 100, etc.) instead of labels
- SPV_011 Property_Type shows empty despite user stating "Mixed Use" — sheet update needed
- Only SPV_011 has a populated Status field; SPV_012-030 still have blank Status

### P3: Refactoring
- server.py is large (~1200 lines). Consider splitting into route modules as codebase grows

### P4: Security
- Rotate orchestration token before production deployment
- Consider rate limiting on orchestration endpoints
