# RBAC Implementation Checklist

Actionable micro-tasks to execute the plan in `docs/rbac-implementation-plan.md`.

## Phase 1 – ORM Setup (Drizzle) & Data Model
- [x] Install Drizzle: `npm i drizzle-orm drizzle-kit mysql2` (completed)
- [x] Note: `mysql2` includes its own types; `@types/mysql2` is not required.
- [x] Add `drizzle.config.ts` with connection settings and migrations dir.
- [x] Create `src/db/schema.ts` with models:
  - [x] `users` (id, email UNIQUE, password_hash, display_name, is_active, timestamps).
  - [x] `roles`, `permissions`.
  - [x] `user_roles` (join), `role_permissions` (join), `user_permissions` (direct grants).
  - [x] `permission_grants` (scoped grants), `rbac_audit_logs`.
- [x] Create `src/db/client.ts` to wrap `atlasPool` with Drizzle client.
- [x] Generate initial migration for all models and apply to dev DB (`db:generate`, `db:migrate`).
- [x] Add useful indexes (e.g., on `permission_grants(subject_type, subject_id)`, `permission_grants(permission)`, `users.email`).
- [x] Create seed script for baseline roles and permissions (`project:read`, `timesheet:read`, `bi:read`, `overrides:update`, `sync:execute`, `rbac:admin`).
- [x] Seed role→permission defaults to mirror current access model.
- [x] Document migration/seed commands (see `docs/drizzle-setup.md`).
- [x] Remove legacy auto-schema creation on startup (disabled `ensureAuthSchema`).

## Phase 2 – Policy Engine
- [x] Create `src/services/permissionsService.ts` file.
- [x] Implement `getUserPermissions(userId)` (merge role-derived, user-direct, active grants).
- [x] Implement scope matcher (global vs resource-specific; equality on resource_type/resource_id; expiry respected).
- [x] Implement `hasPermission(user, permission, resourceCtx?)` (deny-by-default, returns { allow, reason }).
- [x] Add `requirePermission(permission, { resourceExtractor? })` middleware.
- [x] Standardize reason codes (`unauthenticated`, `forbidden`, `no_grant`, `scope_mismatch`).
 - [x] Refactor existing raw SQL usage in auth/RBAC services to ORM repositories (AuthService, audit logs).
- [x] Add `drizzle-kit` scripts to `package.json` (`db:generate`, `db:migrate`, `db:seed`).

## Phase 3 – Route Mapping
- [x] Write resource extractor for overrides endpoints (read `req.body.id || req.body.kimai_project_id`).
- [x] Update `src/index.ts` to add `requirePermission` for:
  - [x] `GET /projects` → `project:read`.
  - [x] `GET /timesheets` → `timesheet:read`.
  - [x] `GET /bi/sunburst` → `bi:read`.
  - [x] `PUT /overrides/status` → `overrides:update` (with extractor).
  - [x] `PUT /overrides` → `overrides:update` (with extractor).
  - [x] `POST /sync/timesheets` → `sync:execute`.
- [x] Keep existing checks via `requireRoleUnlessPermitted` (dual-gate) to remove later.

## Phase 4 – Admin RBAC APIs
- [x] Create `src/controllers/rbacController.ts`.
- [x] Implement roles CRUD: `GET/POST/DELETE /admin/rbac/roles`.
- [x] Implement role-permissions map: `POST/DELETE /admin/rbac/roles/:id/permissions/:perm`.
- [x] Implement permissions CRUD: `GET/POST/DELETE /admin/rbac/permissions`.
- [x] Implement user-role assign/revoke: `POST/DELETE /admin/rbac/users/:id/roles/:role`.
- [x] Implement scoped grants CRUD: `GET/POST/DELETE /admin/rbac/grants` (support `?dryRun=1`).
- [x] Add input validation and consistent error payloads (basic checks).
- [x] Protect all endpoints with `requirePermission('rbac:admin')` and rate limits.
 - [x] Add audit logging for all mutations (writes to `rbac_audit_logs`).
 - [x] Use ORM repositories in controllers (no inline SQL).

## Phase 5 – Least-Privilege Tightening
- [x] Add wildcard support (grant `*` to admins via permissions rather than bypass).
- [x] Instrument current admin bypass path to log usage (temporary).
 - [x] Remove legacy role gates and admin bypass (permission-only enforcement).
  - [ ] (Optional) Split `overrides:update` into field-specific permissions if needed.

## Phase 6 – Resource-Level Scoping
 - [x] Validate and normalize resource types (e.g., `project`).
- [x] Enforce scoped grants in overrides endpoints (use extractor to build `{ resource_type, resource_id }`).
- [x] Add helpers for common resource contexts (e.g., `extractProjectId(req)`).
- [x] Add expiry handling for `permission_grants.expires_at`.

## Phase 7 – Auditing & Observability
 - [x] Extend `audit_logs` or add `rbac_audit_logs` (permission, resource_type, resource_id, decision, reason).
- [x] Implement `recordRbacDecision(req, { permission, resource, decision, reason })` helper (feature-flagged via `RBAC_DECISIONS_LOG`).
- [x] Call `recordRbacDecision` from `requirePermission` on allow/deny (non-blocking, concise warnings).
 - [x] Add lightweight in-memory counters for RBAC denials and privileged ops.
 - [x] Expose a minimal metrics endpoint (`GET /metrics`).
 - [x] Migrate existing audit writes to ORM (recordAudit uses Drizzle).

## Phase 8 – Developer Ergonomics
 - [x] Add `permit(permission, extractor?)` wrapper for routes to reduce boilerplate.
 - [x] Create a test to scan routes for missing `requirePermission` (CI guard).
 - [x] Add docs on permission naming and contribution rules under `docs/`.

## Phase 9 – Testing & Coverage
- [x] Add test framework (Jest + ts-jest + supertest) to devDependencies and config.
 - [x] Unit tests for `PermissionsService` (allow/deny/scoping/expiry/wildcard).
 - [x] Middleware tests for `requirePermission` (401/403/200 + reasons).
 - [x] Integration tests for key routes with different roles and grants.
- [x] Tests for admin RBAC APIs (CRUD + validation).

## Phase 10 – Rollout & Cleanup
- [x] Add feature flags: `RBAC_SHADOW_EVAL`, `RBAC_ENFORCE_READS`, `RBAC_ENFORCE_WRITES` in `config`.
 - [x] Implement shadow evaluation (log decisions without blocking) when enabled (via enforcement flags + decision logging).
- [x] Enable dual-gate on reads; monitor denials and adjust seeds/grants.
- [x] Switch reads to permission-only; keep dual-gate for writes temporarily.
- [x] Switch writes to permission-only; remove dual-gate and admin bypass at route level.
 - [x] Remove unused `requireRole` or keep as thin wrapper over permissions (removed).
- [x] Final documentation pass and README links update.

---

## Testing Checklist (Phases 1–3 Implemented)

Database & Seeds
- [x] Migrations apply cleanly on test DB (`npm run db:migrate`).
- [x] Seed script inserts baseline roles, permissions, and mappings (`npm run db:seed`).
 - [x] Seed script is idempotent (re-run does not duplicate roles/perms/mappings) — verified by idempotency tests.

AuthService (Drizzle)
 - [x] `createUser` + `findUserByEmail` returns expected fields and respects `is_active`.
 - [x] `ensureRole` creates (or no-ops) and returns role id.
 - [x] `assignRole` is idempotent and `getUserRoles` returns correct roles.

Audit Service (Drizzle)
 - [x] `recordAudit` writes a row with user, route, method, status, payload hash, and IP.

PermissionsService
 - [x] Global allow via role-derived permission (e.g., `hr` → `project:read`).
 - [x] Direct user permission allows access when granted.
 - [x] Scoped allow when `{ resource_type: 'project', resource_id }` matches a grant.
 - [x] Scoped deny when resource id mismatches.
 - [x] Expired grant is not selected and results in deny.
 - [x] Unknown permission results in deny.
 - [x] Wildcard `*` permission allows any requested permission.

Middleware
- [x] `authMiddleware` attaches `req.user` for valid JWT cookie; leaves undefined when invalid/missing.
- [x] `requirePermission` allows and sets `req.rbacAllowed`.
- [x] `requirePermission` 401 when unauthenticated (returns `{ error: 'Unauthorized', reason: 'unauthenticated' }`).
 - [x] `requirePermission` denies and sets `req.rbacDeniedReason` (defers response for dual-gate).
 - [N/A] Legacy role-gate middleware removed; routes are permission-only.
- [x] Overrides resource extractor reads `body.id || body.kimai_project_id`.

Integration (HTTP)
- [x] POST `/auth/login` valid → 200, sets cookie.
 - [x] POST `/auth/login` invalid → 401.
- [x] POST `/auth/logout` clears cookie.
- [x] GET `/me` with cookie → 200; without cookie → 401.
- [x] GET `/projects` with `hr` cookie → 200; with `basic` → 403.
- [x] GET `/timesheets` with `management` cookie → 200; with `basic` → 403.
- [x] GET `/bi/sunburst` with `directors` cookie → 200; with `basic` → 403.
- [x] PUT `/overrides/status` with scoped grant for project 123 → 200; for project 999 → 403.
 - [x] PUT `/overrides` mirrors `/overrides/status` behaviors.
- [x] POST `/sync/timesheets` → 200 for `admins`; 403 for others.
- [x] Admin RBAC APIs CRUD and grants endpoints guarded by `rbac:admin`.
 - [x] GET `/metrics` returns counters for RBAC decisions/admin mutations.
 - [x] Admin with `*` wildcard can access endpoints requiring specific permissions.
 - [x] Admin RBAC: non-admin access returns 403 for all endpoints.
 - [x] Admin RBAC: validation errors return 400/404 as appropriate.
 - [x] Admin RBAC: removal endpoints (role-permission, user-role) tested.
 - [x] Admin RBAC: audit rows recorded for mutations.

Edge Cases
- [x] Missing project id in overrides body:
  - With permission (e.g., `hr`): 400 from controller validation.
  - Without permission: 403 from permission enforcement.
- [x] No JWT on protected route → 401.
- [x] Malformed/unknown permission names → deny (unit).

Notes
- Consider exporting `app` from `src/index.ts` for Supertest-based integration tests without binding a port.
 - See RBAC flags and observability usage: [docs/rbac-flags.md](./rbac-flags.md)
