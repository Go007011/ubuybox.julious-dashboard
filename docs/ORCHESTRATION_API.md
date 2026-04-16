# UBUYBOX Orchestration API — Verified Reference

> Tested 2026-04-16. All endpoints verified against live Google Sheets data.  
> System: Emergent backend (FastAPI) + Emergent frontend (React/Vite)  
> External client: OpenClaw

---

## 1. Verified Endpoint List

| # | Method | Path | Auth | Purpose |
|---|--------|------|------|---------|
| 1 | GET | `/api/orchestration/health` | None | Uptime monitoring |
| 2 | POST | `/api/orchestration/load-spv` | Bearer | Load filtered view model for SPV |
| 3 | POST | `/api/orchestration/set-disclosure` | Bearer | Set disclosure level (blocked/teaser/preview/full) |
| 4 | POST | `/api/orchestration/set-waterfall-permission` | Bearer | Grant/revoke waterfall visibility |
| 5 | GET | `/api/orchestration/status/{spvId}` | Bearer | Full status intelligence for SPV |
| 6 | POST | `/api/orchestration/resolve-visibility` | Bearer | Resolve what visibility the SPV should have |
| 7 | GET | `/api/spv-visibility` | None | Visibility map for frontend consumption |

---

## 2. Request/Response Examples

### 2.1 Health Check
```
GET /api/orchestration/health
```
```json
{"ok": true, "service": "ubuybox-emergent", "version": "1.1.0"}
```

### 2.2 Load SPV — Valid (SPV_011 at full disclosure + waterfall permitted)
```
POST /api/orchestration/load-spv
Authorization: Bearer <token>
Content-Type: application/json

{"spvId": "SPV_011"}
```
```json
{
  "success": true,
  "spvId": "SPV_011",
  "disclosureLevel": "full",
  "visibilityState": "full",
  "waterfallAvailable": true,
  "waterfallVisible": true,
  "viewModel": {
    "spvId": "SPV_011",
    "visibilityState": "full",
    "dealCount": 1,
    "deals": [{
      "dealId": "Deal_011",
      "county": "DeKalb",
      "state": "GA",
      "location": "DeKalb, GA",
      "address": "111 Poplar St",
      "purchasePrice": 360000.0,
      "monthlyPayment": 940.0,
      "senior": 338400.0,
      "mezz": 0,
      "equity": 10800.0,
      "totalCapital": 100000.0,
      "agentCommission": 10800.0,
      "netToSeller": 349200.0,
      "units": 20,
      "unitsSold": 0,
      "unitSize": 5000.0,
      "status": "Active",
      "propertyType": "Commercial",
      "businessUse": "BUY BOX..."
    }],
    "summary": {
      "totalCapital": 100000.0,
      "totalSenior": 338400.0,
      "totalMezz": 0,
      "totalEquity": 10800.0,
      "avgPayment": 940.0,
      "totalNetToSeller": 349200.0
    },
    "waterfall": {
      "available": true,
      "visible": true,
      "capitalStack": {"senior": 338400.0, "mezz": 0, "equity": 10800.0, "total": 100000.0},
      "distributions": {"netToSeller": 349200.0}
    }
  },
  "timestamp": "2026-04-16T17:38:05.062441"
}
```

### 2.3 Load SPV — Teaser (SPV_012, default)
```json
{
  "success": true,
  "spvId": "SPV_012",
  "disclosureLevel": "teaser",
  "visibilityState": "teaser",
  "waterfallAvailable": false,
  "waterfallVisible": false,
  "viewModel": {
    "spvId": "SPV_012",
    "visibilityState": "teaser",
    "dealCount": 1,
    "counties": ["Harris"],
    "states": ["TX"],
    "propertyTypes": ["20"],
    "businessUses": ["BUY BOX..."],
    "statuses": ["Pending"]
  }
}
```

### 2.4 Load SPV — Invalid
```
POST /api/orchestration/load-spv
{"spvId": "SPV_999"}
```
```json
HTTP 404
{"error": "not_found", "message": "SPV SPV_999 not found in source data", "timestamp": "..."}
```

### 2.5 Set Disclosure
```
POST /api/orchestration/set-disclosure
{"spvId": "SPV_011", "disclosureLevel": "preview"}
```
```json
{
  "success": true,
  "spvId": "SPV_011",
  "disclosureLevel": "preview",
  "message": "Disclosure level updated (app layer only - Google Sheets unchanged)"
}
```

### 2.6 Set Waterfall Permission
```
POST /api/orchestration/set-waterfall-permission
{"spvId": "SPV_011", "permitted": true}
```
```json
{
  "success": true,
  "spvId": "SPV_011",
  "waterfallPermitted": true,
  "message": "Waterfall permission updated (app layer only)"
}
```

### 2.7 Status Intelligence
```
GET /api/orchestration/status/SPV_011
```
```json
{
  "success": true,
  "spvId": "SPV_011",
  "exists": true,
  "dealCount": 1,
  "disclosureLevel": "full",
  "waterfallAvailable": true,
  "waterfallVisible": true,
  "waterfallPermitted": true,
  "fieldsComplete": true,
  "safeToDisplay": true,
  "visibilityState": "full",
  "missingFields": [],
  "blockingReasons": [],
  "summary": {"totalCapital": 100000.0, "dealCount": 1}
}
```

### 2.8 Status Intelligence — Invalid SPV
```
GET /api/orchestration/status/SPV_999
```
```json
{
  "success": true,
  "spvId": "SPV_999",
  "exists": false,
  "dealCount": 0,
  "disclosureLevel": null,
  "waterfallAvailable": false,
  "waterfallVisible": false,
  "fieldsComplete": false,
  "safeToDisplay": false,
  "visibilityState": "blocked",
  "missingFields": [],
  "blockingReasons": ["SPV not found in source data"]
}
```

### 2.9 Resolve Visibility
```
POST /api/orchestration/resolve-visibility
{"spvId": "SPV_011"}
```
```json
{
  "success": true,
  "spvId": "SPV_011",
  "resolvedVisibility": "full",
  "disclosureLevelSet": "full",
  "waterfallAvailable": true,
  "waterfallVisible": true,
  "waterfallPermitted": true,
  "safeToDisplay": true,
  "fieldsComplete": true,
  "missingFields": [],
  "blockingReasons": []
}
```

### 2.10 Auth Failures
```
# No token
HTTP 401 {"error": "unauthorized", "message": "Missing Authorization header"}

# Wrong token
HTTP 403 {"error": "forbidden", "message": "Invalid API token"}
```

---

## 3. Visibility Logic Summary

### Disclosure Levels
| Level | What's Shown | What's Hidden |
|-------|-------------|---------------|
| **blocked** | SPV ID, deal count, blocked message | Everything else |
| **teaser** | SPV ID, county, state, property type, status, deal count | Price, capital stack, address, seller, waterfall |
| **preview** | + Purchase price, monthly payment, senior/mezz/equity, units, status | Address, seller identity, full waterfall splits |
| **full** | + Address, agent commission, net to seller, unit size, business use | Seller name (intentionally excluded), waterfall (gated separately) |

### Resolution Rules
```
if SPV not found           → blocked
if blocking issues exist   → blocked
if disclosure="full" but fieldsComplete=false
  → preview (if capital stack exists)
  → teaser (if no capital stack)
if disclosure="preview" but no capital stack → teaser
otherwise → respect the set disclosure level
```

---

## 4. Waterfall Gating Summary

**Waterfall is visible only when ALL five conditions are met:**

| # | Condition | Source | Current SPV_011 |
|---|-----------|--------|-----------------|
| 1 | `disclosureLevel = "full"` | OpenClaw sets via `set-disclosure` | full |
| 2 | `waterfallAvailable = true` | Computed from deal data validation | true |
| 3 | `fieldsComplete = true` | All required sheet fields populated | true |
| 4 | `safeToDisplay = true` | No blocking issues (identity + price valid) | true |
| 5 | `waterfallPermitted = true` | OpenClaw sets via `set-waterfall-permission` | true |

**If any condition is false, waterfall is hidden.**

Current state across all SPVs:
- SPV_011: waterfall **visible** (all 5 conditions met after sheet update)
- SPV_012-030: waterfall **gated** (Status empty → fieldsComplete=false)

---

## 5. OpenClaw-Safe Calling Order

### Initial SPV Onboarding
```
1. GET  /api/orchestration/health          → verify Emergent is up
2. GET  /api/orchestration/status/{spvId}  → check if SPV exists, field completeness
3. POST /api/orchestration/set-disclosure   → set to "teaser" (safe default)
4. POST /api/orchestration/load-spv        → verify teaser view model looks correct
```

### Promotion to Preview
```
1. GET  /api/orchestration/status/{spvId}  → confirm fieldsComplete=true, no blockingReasons
2. POST /api/orchestration/set-disclosure   → {"spvId": "...", "disclosureLevel": "preview"}
3. POST /api/orchestration/resolve-visibility → verify resolvedVisibility="preview"
4. POST /api/orchestration/load-spv        → verify preview view model
```

### Promotion to Full + Waterfall
```
1. GET  /api/orchestration/status/{spvId}  → confirm safeToDisplay=true, waterfallAvailable=true
2. POST /api/orchestration/set-disclosure   → {"spvId": "...", "disclosureLevel": "full"}
3. POST /api/orchestration/set-waterfall-permission → {"spvId": "...", "permitted": true}
4. POST /api/orchestration/resolve-visibility → verify resolvedVisibility="full", waterfallVisible=true
5. POST /api/orchestration/load-spv        → verify full view model with waterfall data
```

### Demotion / Emergency Block
```
POST /api/orchestration/set-disclosure → {"spvId": "...", "disclosureLevel": "blocked"}
POST /api/orchestration/set-waterfall-permission → {"spvId": "...", "permitted": false}
```

### Safety Rules for OpenClaw
1. **Always check `status/{spvId}` before promoting** — never blindly set "full" without verifying `fieldsComplete` and `safeToDisplay`
2. **Never skip disclosure levels** — promote teaser → preview → full, not teaser → full
3. **Waterfall permission is separate from disclosure** — even at "full", waterfall is hidden until explicitly permitted
4. **Use `resolve-visibility` as a sanity check** — if `resolvedVisibility` doesn't match what you set, the data doesn't support that level
5. **No writes to Google Sheets** — all orchestration state is app-layer only. Sheet corrections must happen in the sheet itself

---

## 6. Issues Fixed During This Session

| # | Issue | Fix | Verified |
|---|-------|-----|----------|
| 1 | Orchestration endpoints written but never tested | Restarted backend, ran comprehensive curl tests against all 7 endpoints | Yes |
| 2 | Frontend showed all data regardless of visibility | Added `fetchSPVVisibility()` API, `isFieldVisible()` helper, visibility prop on DealCard, masking on all pages | Yes |
| 3 | Waterfalls page used hardcoded mock data | Replaced with live data from Google Sheets, gated by `waterfallVisible` per SPV | Yes |
| 4 | SPV Registry had no visibility indicators | Added Visibility (badge) and Waterfall (Gated/Visible) columns | Yes |
| 5 | DealDetail showed all fields unconditionally | Added field-level masking based on visibility state, waterfall section only shown when `waterfallVisible=true` | Yes |
| 6 | No public endpoint for frontend to read visibility state | Added `GET /api/spv-visibility` (no auth required) | Yes |

---

## Security Note

**Rotate the orchestration token before production.** The test token `ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0` was used in all testing and appears in logs. Generate a new one:

```bash
python3 -c "import secrets; print('ubx_orch_' + secrets.token_hex(32))"
```

Update `/app/backend/.env` → `ORCHESTRATION_API_TOKEN` and restart the backend.
