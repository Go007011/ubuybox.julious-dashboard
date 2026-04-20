# Test Credentials

## Orchestration API
- Token: `ubx_orch_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`
- Location: `/app/backend/.env` → `ORCHESTRATION_API_TOKEN`
- Usage: `Authorization: Bearer <token>` on all protected orchestration endpoints

## Licensed User Test Accounts (Bolt Auth)
- `mrbraboy+011@gmail.com` → SPV_011 (LEVEL_1, Active)
- `mrbraboy+012@gmail.com` → SPV_012 (LEVEL_1, Active)
- `mrbraboy+020@gmail.com` → SPV_020 (LEVEL_1, Active)
- Pattern continues for +013 through +030
- Login via: URL param `?email=mrbraboy%2B011@gmail.com` or sidebar email input

## App Auth
- No standalone auth system in Emergent. Bolt controls auth/login.
- Emergent reads the authenticated email from Bolt session context.
