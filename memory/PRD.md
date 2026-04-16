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
- DealCard accepts visibility prop, masks fields per disclosure level
- Dashboard, CapitalStack, SPVRegistry, DealDetail, Waterfalls all enforce masking
- blocked: shows SPV ID and blocked message only
- teaser: shows county, state, property type, status — hides price, capital stack, seller
- preview: shows price, capital stack, units — hides seller, address, waterfall
- full: shows all permitted fields — waterfall gated separately
- Waterfalls page: shows data only when waterfallVisible=true per SPV

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
