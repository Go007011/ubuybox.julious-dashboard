# Test Credentials

## Orchestration API
- Token: `ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`
- Location: `/app/backend/.env` → `ORCHESTRATION_API_TOKEN`
- Usage: `Authorization: Bearer <token>` on all protected orchestration endpoints
- Note: Rotate before production deployment

## App Auth
- No user authentication system. The app has no login/registration.
