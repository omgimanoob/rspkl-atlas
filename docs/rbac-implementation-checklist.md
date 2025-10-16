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
- [ ] Add simple in-memory cache (per-request) to avoid redundant DB calls.
- [x] Add `requirePermission(permission, { resourceExtractor? })` middleware.
- [x] Standardize reason codes (`unauthenticated`, `forbidden`, `no_grant`, `scope_mismatch`).
- [ ] Refactor existing raw SQL usage in auth/RBAC services to ORM repositories.
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
- [ ] Create `src/controllers/rbacController.ts`.
- [ ] Implement roles CRUD: `GET/POST/DELETE /admin/rbac/roles`.
- [ ] Implement role-permissions map: `POST/DELETE /admin/rbac/roles/:id/permissions/:perm`.
- [ ] Implement permissions CRUD: `GET/POST/DELETE /admin/rbac/permissions`.
- [ ] Implement user-role assign/revoke: `POST/DELETE /admin/rbac/users/:id/roles/:role`.
- [ ] Implement scoped grants CRUD: `GET/POST/DELETE /admin/rbac/grants` (support `?dryRun=1`).
- [ ] Add input validation and consistent error payloads.
- [ ] Protect all endpoints with `requirePermission('rbac:admin')` and rate limits.
- [ ] Add audit logging for all mutations.
 - [ ] Use ORM repositories in controllers (no inline SQL).

## Phase 5 – Least-Privilege Tightening
- [ ] Add wildcard support (grant `*` to admins via permissions rather than bypass).
- [ ] Instrument current admin bypass path to log usage (temporary).
- [ ] Remove admin bypass from `requireRole` once permission path is verified.
- [ ] (Optional) Split `overrides:update` into field-specific permissions if needed.

## Phase 6 – Resource-Level Scoping
- [ ] Validate and normalize resource types (e.g., `project`).
- [x] Enforce scoped grants in overrides endpoints (use extractor to build `{ resource_type, resource_id }`).
- [x] Add helpers for common resource contexts (e.g., `extractProjectId(req)`).
- [x] Add expiry handling for `permission_grants.expires_at`.

## Phase 7 – Auditing & Observability
- [ ] Extend `audit_logs` or add `rbac_audit_logs` (permission, resource_type, resource_id, decision, reason).
- [ ] Implement `recordRbacDecision(req, { permission, resource, decision, reason })` helper.
- [ ] Call `recordRbacDecision` from `requirePermission` on allow/deny.
- [ ] Add lightweight in-memory counters for RBAC denials and privileged ops.
- [ ] Expose a minimal metrics endpoint or integrate with existing telemetry (optional).
 - [ ] Migrate existing audit writes to ORM where applicable.

## Phase 8 – Developer Ergonomics
- [ ] Add `permit(permission, extractor?)` wrapper for routes to reduce boilerplate.
- [ ] Create a script to scan routes for missing `requirePermission` (CI check).
- [ ] Add docs on permission naming and contribution rules under `docs/`.

## Phase 9 – Testing & Coverage
- [ ] Add test framework (e.g., Jest + ts-jest) to devDependencies and config.
- [ ] Unit tests for `PermissionsService` (allow/deny/scoping/expiry/wildcard).
- [ ] Middleware tests for `requirePermission` (401/403/200 + reasons).
- [ ] Integration tests for key routes with different roles and grants.
- [ ] Tests for admin RBAC APIs (CRUD + validation + audit entries).

## Phase 10 – Rollout & Cleanup
- [ ] Add feature flags: `RBAC_SHADOW_EVAL`, `RBAC_ENFORCE_READS`, `RBAC_ENFORCE_WRITES` in `config`.
- [ ] Implement shadow evaluation (log decisions without blocking) when enabled.
- [ ] Enable dual-gate on reads; monitor denials and adjust seeds/grants.
- [ ] Switch reads to permission-only; keep dual-gate for writes temporarily.
- [ ] Switch writes to permission-only; remove dual-gate and admin bypass.
- [ ] Remove unused `requireRole` or keep as thin wrapper over permissions.
- [ ] Final documentation pass and README links update.
