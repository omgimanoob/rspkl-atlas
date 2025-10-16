# RBAC Testing Plan

Plan to validate the RBAC implementation described in `docs/rbac-implementation-checklist.md` across unit, middleware, and integration layers. Focus on correctness, regressions, and safe rollout of dual‑gate (permissions OR legacy roles).

## Scope & Goals
- Verify Drizzle schema and seeds enable baseline RBAC data.
- Validate PermissionsService decisions (global, scoped, expiry).
- Confirm middleware behavior for `requirePermission` and `requireRoleUnlessPermitted`.
- Exercise protected routes with dual‑gate access.
- Validate auditing still works after Drizzle refactor.
- Establish repeatable fixtures and guidance for future tests.

## Environments
- Test DB: use a separate database (e.g., `ATLAS_DB_DATABASE_TEST`).
  - Apply migrations: `npm run db:migrate`
  - Seed baseline RBAC data: `npm run db:seed`
- App: run under `NODE_ENV=test` when executing integration tests.

## Test Data & Fixtures
- Users:
  - `admin@example.com` → roles: `admins`
  - `hr@example.com` → roles: `hr`
  - `manager@example.com` → roles: `management`
  - `director@example.com` → roles: `directors`
  - `basic@example.com` → roles: none
- Scoped grants:
  - Grant `overrides:update` to `hr@example.com` for `project_id=123` only.
  - Expired grant for negative  case.
- Utilities:
  - Factory to create users + role assignments via Drizzle.
  - Helper to sign JWTs (reuse `AuthService.signJwt`).
  - DB reset between tests (truncate affected tables or transaction rollback per test suite).

## Unit Tests
- PermissionsService
  - Global allow: role‑derived permission (e.g., `hr` → `project:read`).
  - Direct user permission allow (insert into `user_permissions`).
  - Scoped allow: matches `resource_type='project'` and `resource_id`.
  - Scoped deny: scope mismatch (`resource_id` different).
  - Expiry: expired grant returns deny with reason `expired`/`no_grant` (current code treats expired as not selected; assert deny).
  - No grant: deny with reason `no_grant`.
- AuthService (Drizzle)
  - `createUser` + `findUserByEmail` returns sanitized record.
  - `ensureRole` idempotent creation.
  - `assignRole` idempotent mapping; `getUserRoles` returns expected roles.
- Audit Service
  - `recordAudit` writes a row with user, route, method, status, payload hash, ip.

## Middleware Tests
- authMiddleware
  - Parses cookie, verifies JWT, attaches `req.user`.
  - Missing/invalid JWT leaves `req.user` undefined.
- requirePermission
  - 401 when unauthenticated.
  - Allows when permission present; sets `req.rbacAllowed`.
  - Denies but defers response (no send) when missing; sets `req.rbacDeniedReason`.
  - Resource extractor works for overrides endpoints (reads `id|kimai_project_id`).
- requireRoleUnlessPermitted
  - Skips role check when `req.rbacAllowed` true.
  - 403 when roles missing and `req.rbacAllowed` not set.

## Integration Tests (HTTP)
Use `supertest` against the Express app instance (refactor to export `app` from `src/index.ts` if needed).

- Auth
  - POST `/auth/login` with valid credentials → 200, sets cookie, returns email+roles.
  - POST `/auth/logout` clears cookie.
  - GET `/me` with cookie → 200; without cookie → 401.
- Read routes (dual‑gate)
  - GET `/projects` with `hr` cookie → 200 (permission or role path).
  - GET `/timesheets` with `management` cookie → 200.
  - GET `/bi/sunburst` with `director` cookie → 200.
  - Each above with `basic` cookie → 403.
- Write routes (overrides with scoping)
  - PUT `/overrides/status` for `project_id=123` with `hr` user having scoped grant → 200.
  - Same user for `project_id=999` (no grant) → 403.
  - PUT `/overrides` behaves identically in both allowed and denied cases.
- Admin route
  - POST `/sync/timesheets` → 200 for `admins`; 403 for others.

Edge/Negative Cases
- Invalid resource payload (missing `id`/`kimai_project_id`) → permission middleware denies; role gate may still allow (dual‑gate) → assert 200 for currently authorized roles, 403 for others.
- Expired grant present → deny, confirm not used.
- Unknown permission string → deny.

## Tooling & Setup (Recommended)
- Add testing stack:
  - `jest` `ts-jest` `@types/jest` for unit/middleware tests.
  - `supertest` `@types/supertest` for integration tests.
- Scripts:
  - `test`: run unit + middleware tests
  - `test:integration`: boot app in test mode and run HTTP suites
- App export for tests:
  - Refactor `src/index.ts` to export `app` (and keep bootstrap). In tests, import `app` to avoid binding to a port.

## Data Isolation Strategy
- Preferred: use a dedicated test DB and clean tables between suites:
  - Truncate: `users`, `roles`, `user_roles`, `permissions`, `role_permissions`, `user_permissions`, `permission_grants`, `audit_logs`, `rbac_audit_logs`.
  - Re‑seed baseline roles/permissions after cleanup.
- Alternative: wrap each suite in a transaction and rollback at the end (requires test‑friendly connection handling).

## Exit Criteria
- Unit coverage for PermissionsService and AuthService core methods.
- Middleware behavior validated for success, deny, and dual‑gate interactions.
- Integration tests pass for all mapped routes and negative cases.
- Seeds and migrations can set up a clean test DB from scratch.
- No regressions in auth endpoints (`/auth/login`, `/me`, `/auth/logout`).

## Future Work (when Admin APIs exist)
- Test role/permission CRUD and scoped grant CRUD:
  - Validation errors, idempotency, and audit entries.
  - Permissions enforced with `requirePermission('rbac:admin')`.

