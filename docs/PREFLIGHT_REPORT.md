# UBUYBOX Production Preflight Report
**Date**: 2026-04-20
**Status**: READY TO DEPLOY

---

## 1. Auth/Session
| Check | Result |
|-------|--------|
| Sign-in (valid user) | PASS |
| Sign-in rejects unknown email (404) | PASS |
| Admin resolves as LEVEL_3 | PASS |
| Admin-only endpoints blocked for regular users (403) | PASS |
| All 5 admin endpoints blocked for non-admin | PASS |
| Sign-out clears session and returns to login | PASS |

## 2. Opportunity Visibility
| Check | Result |
|-------|--------|
| LEVEL_1 (mrbraboy+014): 3 teaser opps, no prices, CTA="Request Review" | PASS |
| LEVEL_2 (mrbraboy+011): 7 opps, preview with prices, CTA="Request Participation" | PASS |
| LEVEL_3 (mrbraboy+015): 11 opps, full with commission, CTA="Manage Opportunity" | PASS |
| Per-viewer-level columns drive visibility/CTA/access-state | PASS |
| No lower/higher level inheritance bugs | PASS |

## 3. Hard Disclosure Protection
| Check | Result |
|-------|--------|
| LEVEL_1 — no addresses, seller, agent in response | PASS |
| LEVEL_2 — no addresses, seller, agent in response | PASS |
| LEVEL_3 — no addresses, seller, agent in response | PASS |
| Personal context (mainMaps, spvRegistry) — no address leaks | PASS |
| Opportunity cards — no address leaks | PASS |

## 4. Notifications
| Check | Result |
|-------|--------|
| User notifications sourced only from admin-sent records | PASS |
| Drafts excluded from user view | PASS |
| Archived excluded from user view | PASS |
| admin_notes and created_by stripped from user response | PASS |
| target_user filtering (exact email match) | PASS |
| target_level filtering (hierarchy) | PASS |
| related_spv_id filtering | PASS |

## 5. Admin Workflow Persistence
| Check | Result |
|-------|--------|
| User requests persist to MongoDB | PASS (10 records) |
| Admin action logs persist to MongoDB | PASS (7 records) |
| Notifications persist to MongoDB | PASS (11 records) |
| Data survives backend restart | PASS |

## 6. Data + Production Config
| Check | Result |
|-------|--------|
| SPREADSHEET_ID env var (no fallback) | PASS |
| ORCHESTRATION_API_TOKEN env var (no fallback) | PASS |
| MONGO_URL env var | PASS |
| DB_NAME env var | PASS |
| ADMIN_EMAIL env var (with dev fallback) | PASS |
| MongoDB connected | PASS |
| Google Sheets accessible | PASS |
| Frontend uses relative /api paths | PASS |
| CORS: allow_origins=["*"] | PASS (acceptable) |
| No mock/demo data in production flows | PASS |
| No hardcoded secrets in source code | PASS |
| Disk space: 80% free | PASS |

## 7. Deploy Readiness
| Check | Result |
|-------|--------|
| Backend compiles and starts cleanly | PASS |
| Frontend compiles without errors | PASS |
| All API endpoints responding | PASS |
| External preview URL accessible | PASS |
| Supervisor services healthy | PASS |

**Blockers**: None remaining (3 hardcoded fallbacks fixed)
**Status**: READY TO DEPLOY
