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

### Phase 8: Full Multi-Sheet Visibility + Access Control + Caps (Complete — 2026-04-20)
- Backend reads ALL 8 Google Sheet tabs: Licensed Users, Main Maps Offers, SPV Registry, Capital Stack, Waterfall Engine, Deal Summary, Validation Engine, Orders
- Single `/api/user/dashboard` endpoint returns all tab data filtered by user's SPV and masked by license_level
- Hard masking: Property Address, Seller Name, Agent Name/Phone/Email NEVER shown to any partner-facing level
- LEVEL_1 (teaser): Deal ID, SPV ID, State, County, Status, Partner Updates, Units, Property Type, Business Use, Deal Summary (name/risk only), Validation (Overall_Status only), Capital Stack shows "Restricted"
- LEVEL_2 (preview): + Purchase Price, Monthly Payment, Seller Carryback, Open Loan Balance, Total Capital, Capital Stack amounts + risk, full Validation, waterfall summary only
- LEVEL_3 (full): + Capital Stack returns/priorities, full Waterfall Engine steps, Deal Summary waterfall display, Order records
- Controlled request actions: Request Review, Request Participation, Request Access — logged with email, license_id, SPV, timestamp
- Cap enforcement: LEVEL_1 max 1 active request (no participation), LEVEL_2 max 3, LEVEL_3 max 10
- All pages updated: Dashboard, Capital Stack, SPV Registry, Waterfalls, HoldCo Summary, Documents

### Phase 9: Opportunity Release Control (Complete — 2026-04-20)
- New sheet tab: Opportunity Release Control (spv_id, deal_id, release_status, release_to_level, visibility_mode, approval_required, capacity_status, max_orders_allowed, current_orders_count, opportunity_access_state)
- Dashboard now shows two sections: Personal Context (user's assigned SPV) + Active Opportunities (released private opportunities)
- Release filtering: only Active rows shown; L1 sees L1 releases, L2 sees L1+L2, L3 sees L1+L2+L3
- Visibility mode controls masking per opportunity: teaser/preview/full (independent of user level)
- CTA states: Available, Approval Required, Restricted, Full — based on approval_required, capacity_status, max_orders, current_orders, access_state
- Capacity bars on each opportunity card
- Hard masking enforced on all opportunity cards (no addresses, seller, agent info)
- Dashboard is no longer a broad marketplace — only intentionally released private opportunities shown

### Phase 10: Internal Admin Control Layer (Complete — 2026-04-20)
- Admin-only page at /admin with 5 tabbed modules: Requests Queue, Orders Control, Release Control, User Access, Notifications
- Access restricted to mrbraboy+007011@gmail.com only (backend 403 + frontend gate + nav hidden)
- Backend: 10 new admin endpoints (/api/admin/check, requests, requests/action, orders, orders/action, releases, releases/action, users, users/action, notifications, notifications/action)
- User requests from dashboard automatically populate admin Requests Queue
- Cleanly separated from partner-facing experience — no admin controls leak into user pages
- Admin email uses synthetic LEVEL_3 record when not in Licensed Users sheet

### Phase 11: Per-Viewer-Level Opportunity Rendering (Complete — 2026-04-20)
- Backend reads level_X_visibility, level_X_cta, level_X_access_state columns from Opportunity Release Control
- Each viewer gets their own visibility/CTA/access-state based on their license_level, not inherited from lower levels
- visibility=hidden skips the opportunity entirely for that viewer level
- CTA label rendered directly from sheet (e.g. "Request Review", "Request Participation", "Manage Opportunity")
- L2 users now see preview visibility with "Request Participation" on L1-released opportunities
- L3 users see full visibility with "Manage Opportunity" on all opportunities

### Phase 12: Persistent Storage + Enhanced Notifications (Complete — 2026-04-20)
- MongoDB persistence for admin requests, notifications, and action logs (survives restarts)
- Collections: admin_requests, admin_notifications, admin_actions
- 12 canned notification templates: Deal Approved/Closed, Review Required, Capital Call Reminder, Document Uploaded, Request Approved/Denied, Participation Approved/Pending, Opportunity Released, Capacity Full, General Notice
- Message builder with template selector, large text area (editable), separate admin notes field
- Notification history as styled cards matching notification page aesthetic
- Draft editing: click Edit on drafted notification to load it back into the composer
- Actions: Send, Save Draft, Edit Draft, Resend, Archive
- GET /api/admin/templates endpoint returns all canned templates

### Phase 13: Admin-Originated User Notifications (Complete — 2026-04-20)
- User-facing Notifications page now reads exclusively from MongoDB admin_notifications collection
- All mock/demo/hardcoded notifications removed
- New endpoint: GET /api/user/notifications?email= — filters sent notifications by target_user, target_level, and related_spv_id
- Filtering: exact email match if target_user set, level hierarchy if target_level set, SPV match if related_spv set
- Admin notes and created_by stripped from user-facing response
- Empty state: "No notifications at this time."
- Card layout matches admin panel style with type-colored icons and relative timestamps

### Phase 14: Bolt Access Routing Layer + Supabase Integration Points (Complete — 2026-04-21)
- `/enter-dashboard?email=` — single Bolt handoff entry route; validates access, sets session, redirects to dashboard
- `/access/pending` — shown when user status is pending/review
- `/access/denied` — shown when user is denied/suspended/inactive
- Backend: `GET /api/access/resolve` — returns full access decision (accessState, dashboardRoute, licenseLevel, assignedSpvId)
- Backend: `GET /api/access/enter` — validates and returns dashboard config for Bolt redirect
- Supabase integration points ready (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY env vars)
- When Supabase is configured, `supabase_lookup_user()` queries `licensed_users` view first; falls back to Google Sheets
- Access states: unauthenticated → 401, no_license → 401, pending → /access/pending, denied → /access/denied, approved → /enter-dashboard, admin → /enter-dashboard with isAdmin=true
- Google Sheets remains source of truth feeding Supabase; Supabase is the structured access layer

### Phase 15: Owner-Restricted CTA Button (Complete — 2026-04-22)
- "Manage Opportunity" only shown to SPV owner or admin
- All non-owners see "Request Information" instead
- Backend adds `isOwner` field to each opportunity based on user's assigned_spv_id matching the opportunity's spv_id
- CTA override happens server-side before response — frontend renders dynamically
- L2 users unaffected (their per-level CTA is "Request Participation", not "Manage Opportunity")

### Phase 16: Level 3 Operator Views — Deal Summary & Tranche Breakdown (Complete — 2026-04-22)
- Backend endpoints `/api/user/deal-summary` and `/api/user/tranche-breakdown` return hard-masked rows filtered by SPV (no address/seller/agent); return HTTP 403 for L1/L2
- Frontend pages: `/deal-summary` (DealSummary.tsx) and `/tranche-breakdown` (TrancheBreakdown.tsx)
- Deal Summary fields: Deal_Name, Deal_ID, SPV_ID, State, Capital_Stack_Display, Waterfall_Display, Risk_Summary
- Tranche Breakdown fields: Deal_ID (group), Priority, Tranche_Type, Amount, Return_Target, Risk_Level — grouped by deal with priority sort and aggregate total
- Sidebar renders a "LEVEL 3 · OPERATOR" section with Deal Summary and Tranche Breakdown links only for LEVEL_3 users or admin
- Safe empty states for missing rows, malformed Amount values parsed defensively
- Verified: L1 and L2 sidebar hides the links; direct URL access shows access-denied card

### Phase 17: Admin-Controlled Dynamic Menu Manager (Complete — 2026-04-22)
- MongoDB `menu_config` collection with fields: id, menu_label, path, source_sheet_name, icon_name, enabled, allowed_levels, admin_only, hidden_but_queryable, sort_order, created_at, updated_at
- 12 default items seeded on startup (idempotent): Dashboard, Opportunity Intake, Capital Stack, SPV Registry, Waterfalls, HoldCo Summary, Documents, Notifications, Deal Summary, Tranche Breakdown, Admin Control, Menu Manager
- Admin endpoints: GET/POST `/api/admin/menu`, PATCH/DELETE `/api/admin/menu/{id}`, POST `/api/admin/menu/reorder`, POST `/api/admin/menu/reset-defaults`, GET `/api/admin/menu/diagnostics`
- Public endpoint: GET `/api/menu?email=...` returns level-filtered, admin-filtered, enabled-only, non-hidden items
- Frontend page `/admin/menu-manager` (MenuManager.tsx) with three tabs: Menu Items (inline edit, toggles, level pills, reorder, delete, add), Diagnostics (admin-only), Live Preview (sidebar mirror)
- Sidebar refactored to fetch from `/api/menu` with safe fallback to hardcoded FALLBACK_MENU if config unreachable
- Admin diagnostics include "Seller-Forward Maps Offers" mapping-issue warning (admin-only, never exposed to regular users)
- Verified: admin can rename/disable/enable/reorder/add/delete; L1/L2 cannot access the page (access-denied card); Deal Summary and Tranche Breakdown still visible to L3

### Phase 18: Supabase Safe Views Integration (Complete — 2026-04-22)
- New module `/app/backend/supabase_reader.py` with VIEW_MAP (17 entries), `fetch_view`, `try_supabase_view`, `log_fallback`, `status_snapshot`
- SQL migration authored at `/app/supabase/migrations/001_safe_views.sql` defining v_main_maps_l1/l2/l3, v_spv_registry_l1/l2, v_capital_stack_l1/l2/l3, v_waterfall_l3, v_deal_summary_l1/l2/l3, v_tranche_breakdown_l3, v_validation_l1/l2, v_opportunity_release_admin — all excluding exact address / seller PII / agent PII / internal compliance fields
- Migrated backend endpoints to Supabase-first reads: `/api/user/deals`, `/api/user/spvs`, `/api/user/deal-summary`, `/api/user/tranche-breakdown` — each returns `source: "supabase"|"sheet"` for transparency
- MongoDB `supabase_fallback_log` collection records every fallback event (area, level, reason, timestamp)
- New admin-only endpoint `GET /api/admin/supabase-status` exposing config + recent fallbacks + aggregated summary
- Fallback semantics: Supabase disabled OR view unmapped OR fetch failed → falls through to existing sheet path + Python masking; response shape preserved so frontend is unchanged
- Dashboard endpoint `/api/user/dashboard` intentionally left on sheet reads this phase: its per-opportunity cross-join logic requires raw rows that will migrate to a materialized view later
- Verified: SUPABASE_ENABLED=False in env → all endpoints return source="sheet"; response shapes identical to pre-migration; L1/L2/L3 filtering unchanged; admin cannot see owner-only CTAs

### Phase 19: UBIDS Terminology Enforcement (Complete — 2026-04-23)
- Source Google Sheets migrated: `SPV_ID`/`spv_id` columns → `Business ID (UBIDS)`; `assigned_spv_id` → `assigned_business_id`; values `SPV_###` → `UBIDS_###`
- Backend data-loading alias: `fetch_sheet_tab` now also exposes `"Business ID (UBIDS)"` column values under the legacy keys `SPV_ID` / `spv_id` so internal masking / filtering code keeps working without invasive refactor
- Backend Licensed Users loader reads `assigned_business_id` (with `assigned_spv_id` fallback)
- New FastAPI middleware `ubids_presentation_sanitizer` rewrites every outbound `/api/*` JSON body. Ordered regex: `SPV_\d+` → `UBIDS_\d+`, `SPV Registry` → `Business Registry`, `SPV ID` → `Business ID (UBIDS)`, `SPV Structure` → `Business Structure`, `SPVs` → `Businesses`, standalone `\bSPV\b` → `Business`. JSON keys preserved (no word boundary inside `SPV_ID`), so frontend contract is stable.
- Seeded menu item "SPV Registry" renamed to "Business Registry" (with one-shot migration for existing DB rows)
- Frontend hardcoded labels updated across Dashboard, SPVRegistry, DealSummary, TrancheBreakdown, Notifications, AdminControl, HoldCoSummary, DealDetail, DealCard, Header, Sidebar: "SPV" → "Business", "SPV ID" → "Business ID (UBIDS)", "My SPV" → "My Business", "SPVs" → "Businesses", "SPV Registry" → "Business Registry"
- Verified: 0 visible-text SPV leaks across 11 routes for L3 user + admin; API value scans show 0 SPV string-value leaks across 7 endpoints

### Phase 20: Premium Waterfall Visualization Engine (Complete — 2026-04-23)
- New endpoints `GET /api/user/waterfall-view?email&businessId` and `GET /api/user/available-businesses?email`. Waterfall-view joins Waterfall Engine + Tranche Breakdown on Business ID (UBIDS) + Tranche, returns UI-ready payload: business_id, total_capital, tranches[step,name,kind,amount,percent,return_target,priority,risk,description], chart_data, summary{senior,mezz,equity,total_capital,tranche_count}
- Access: LEVEL_3 / admin only (403 for L1/L2); non-admin users cannot query a business other than their assigned one (cross-business request returns 403)
- Safe degradation: if Waterfall Engine rows are empty, steps are derived from Tranche Breakdown order; missing values render as "Data unavailable" placeholders rather than breaking layout
- Frontend `/app/frontend/src/pages/Waterfalls.tsx` fully rewritten: title block with UBIDS highlighted, Business selector (admin sees all 20 UBIDS, users see only theirs), 4 KPI cards (Total / Senior / Mezz / Equity with amount + % of capital), stacked bar chart with color-coded segments + legend, SVG donut chart with center label, 8-column tranche table (Step/Tranche/Amount/% of Total/Return Target/Priority/Risk/Description) sorted by Step_Order with Senior→Mezz→Equity priority, Distribution Order step cards
- Chart rendering: pure SVG + CSS — no new dependency added
- Dynamic: selector change triggers refetch + full UI re-render with no page reload
- Verified: L3 user sees UBIDS_015 with $95K total + 3 tranches; admin switches to UBIDS_021 and sees $875K + fully re-rendered chart/table/cards; 0 visible-text SPV leaks on both; L1/L2 see access-denied card

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
