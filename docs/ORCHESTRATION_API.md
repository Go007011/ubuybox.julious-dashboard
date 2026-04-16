# UBUYBOX Orchestration API Documentation

## Overview

This orchestration layer allows OpenClaw to control UBUYBOX's SPV display/process layer without becoming the database.

**Architecture:**
- Google Sheets remains the source of truth
- OpenClaw controls display state only (disclosure levels)
- No direct Google Sheets access from OpenClaw
- All data modifications stay in app-layer memory

## Base URL

```
Production: https://your-domain.com
Preview: https://your-preview.preview.emergentagent.com
Local: http://localhost:8001
```

## Authentication

All orchestration endpoints (except `/health`) require Bearer token authentication.

**Header Format:**
```
Authorization: Bearer <token>
```

**Token Location:**
- Set via environment variable: `ORCHESTRATION_API_TOKEN`
- Default token (change in production): `ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`

**Generate New Token:**
```bash
python -c "import secrets; print('ubx_orch_' + secrets.token_hex(32))"
```

---

## Endpoints

### 1. GET /api/orchestration/health

Health check endpoint. No authentication required.

**Request:**
```bash
curl -X GET https://your-domain.com/api/orchestration/health
```

**Response (200 OK):**
```json
{
  "ok": true,
  "service": "ubuybox-emergent",
  "version": "1.0.0"
}
```

---

### 2. POST /api/orchestration/load-spv

Load SPV view model based on current disclosure level. Validates SPV exists in sheet-backed data and returns allowed view model. Does NOT modify source data.

**Request:**
```bash
curl -X POST https://your-domain.com/api/orchestration/load-spv \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0" \
  -d '{
    "spvId": "SPV_011"
  }'
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| spvId | string | Yes | SPV identifier (e.g., "SPV_001") |

**Response (200 OK):**
```json
{
  "success": true,
  "spvId": "SPV_011",
  "disclosureLevel": "teaser",
  "viewModel": {
    "id": "SPV_011",
    "name": "SPV_011",
    "dealCount": 1,
    "disclosureLevel": "teaser"
  },
  "timestamp": "2026-04-16T17:10:48.471756"
}
```

**View Model by Disclosure Level:**

| Level | Fields Returned |
|-------|-----------------|
| teaser | id, name, dealCount |
| preview | id, name, dealCount, deals |
| full | All fields including capital stack data |

**Error Response (404 Not Found):**
```json
{
  "error": "not_found",
  "message": "SPV SPV_999 not found in source data",
  "timestamp": "2026-04-16T17:10:56.529797"
}
```

---

### 3. POST /api/orchestration/set-disclosure

Set disclosure level for an SPV. Controls what data is visible at the app layer. Does NOT write to Google Sheets.

**Request:**
```bash
curl -X POST https://your-domain.com/api/orchestration/set-disclosure \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0" \
  -d '{
    "spvId": "SPV_011",
    "disclosureLevel": "preview"
  }'
```

**Request Body:**
| Field | Type | Required | Allowed Values |
|-------|------|----------|----------------|
| spvId | string | Yes | SPV identifier |
| disclosureLevel | string | Yes | "teaser", "preview", "full" |

**Response (200 OK):**
```json
{
  "success": true,
  "spvId": "SPV_011",
  "disclosureLevel": "preview",
  "message": "Disclosure level updated (app layer only)",
  "timestamp": "2026-04-16T17:10:48.681779"
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "detail": [
    {
      "type": "literal_error",
      "loc": ["body", "disclosureLevel"],
      "msg": "Input should be 'teaser', 'preview' or 'full'"
    }
  ]
}
```

---

### 4. GET /api/orchestration/status/:spvId

Get comprehensive status for orchestration decisions.

**Request:**
```bash
curl -X GET https://your-domain.com/api/orchestration/status/SPV_011 \
  -H "Authorization: Bearer ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
```

**Response (200 OK - SPV Exists):**
```json
{
  "spvId": "SPV_011",
  "exists": true,
  "disclosureLevel": "preview",
  "disclosureLastUpdated": "2026-04-16T17:10:48.681734",
  "waterfallAvailable": true,
  "requiredFieldsComplete": true,
  "missingFields": [],
  "safeToDisplay": true,
  "summary": {
    "dealCount": 1,
    "totalCapital": 100000.0
  },
  "timestamp": "2026-04-16T17:10:56.369408"
}
```

**Response (200 OK - SPV Not Found):**
```json
{
  "spvId": "SPV_999",
  "exists": false,
  "disclosureLevel": null,
  "waterfallAvailable": false,
  "requiredFieldsComplete": false,
  "safeToDisplay": false,
  "reason": "SPV not found in source data",
  "timestamp": "2026-04-16T17:10:56.529797"
}
```

**Status Fields:**
| Field | Type | Description |
|-------|------|-------------|
| exists | boolean | Whether SPV exists in Google Sheets |
| disclosureLevel | string | Current disclosure level (teaser/preview/full) |
| disclosureLastUpdated | string | ISO timestamp of last disclosure change |
| waterfallAvailable | boolean | Whether capital stack data exists |
| requiredFieldsComplete | boolean | Whether all required fields are filled |
| missingFields | array | List of missing fields (max 5) |
| safeToDisplay | boolean | Overall safety check for display |
| summary | object | Quick stats (dealCount, totalCapital) |

---

## Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 401 | unauthorized | Missing or invalid Authorization header |
| 403 | forbidden | Invalid API token |
| 404 | not_found | SPV not found in source data |
| 422 | validation_error | Invalid request body |
| 500 | internal_error | Server error (check logs) |
| 502 | bad_gateway | Failed to fetch from Google Sheets |

---

## Example Workflow

```bash
TOKEN="ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
BASE_URL="http://localhost:8001"

# 1. Check health
curl -s "$BASE_URL/api/orchestration/health"

# 2. Check SPV status before display
curl -s "$BASE_URL/api/orchestration/status/SPV_011" \
  -H "Authorization: Bearer $TOKEN"

# 3. If safeToDisplay=true, set disclosure level
curl -s -X POST "$BASE_URL/api/orchestration/set-disclosure" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"spvId": "SPV_011", "disclosureLevel": "preview"}'

# 4. Load SPV view model for display
curl -s -X POST "$BASE_URL/api/orchestration/load-spv" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"spvId": "SPV_011"}'
```

---

## Security Notes

1. **Token Management**: Change the default token in production
2. **HTTPS**: Always use HTTPS in production
3. **Logging**: Tokens are never logged, only existence is logged
4. **Rate Limiting**: Consider adding rate limiting for production
5. **No Data Writes**: Orchestration layer cannot write to Google Sheets

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│    OpenClaw     │────▶│  Orchestration API   │────▶│  Google Sheets  │
│  (Controller)   │     │  (App Layer State)   │     │ (Source of Truth)│
└─────────────────┘     └──────────────────────┘     └─────────────────┘
        │                         │
        │ Bearer Token Auth       │ Read-Only
        │                         │
        ▼                         ▼
   Set Disclosure           Validate SPV Exists
   Load View Model          Fetch Current Data
   Check Status             Filter by Disclosure
```

**Key Principle**: OpenClaw controls *how* data is displayed, not *what* data exists.
