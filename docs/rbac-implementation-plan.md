# RBAC Implementation Plan

This plan implements the items in `docs/rbac-missing-essentials.md` in phased, deploy-safe steps.

ORM Decision: Drizzle ORM + drizzle-kit with `mysql2`. Place schema in `src/db/schema.ts`, client in `src/db/client.ts`, and migrations in `drizzle/`. See `docs/drizzle-setup.md` for code snippets and scripts.

## Phase 1: ORM & Data Model (Drizzle)
- Define Drizzle schema for: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `user_permissions`, `permission_grants`, and `audit_logs`/`rbac_audit_logs`.
- Use `drizzle-kit` to generate and apply SQL migrations to the dev DB.
- Seed baseline permissions: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`, `sync:execute`, `rbac:admin` and role→permission mappings mirroring current access.

## Phase 2: Policy Engine
- Add `PermissionsService`:
  - `getUserPermissions(userId)` merges role-derived, user-direct, and active scoped grants.
  - `hasPermission(user, permission, resourceCtx?)` with deny-by-default and simple scope matching.
  - Scope matcher: compare `{ resource_type, resource_id }`; allow nulls as global grants.
- Add middleware `requirePermission(permission, { resourceExtractor? })` returning 401/403 with a reason code.
- Keep legacy `requireRole` during rollout.

## Phase 3: Map Existing Routes
- Enforce permissions and update `src/index.ts`:
  - `GET /projects` → `project:read`
  - `GET /timesheets` → `timesheet:read`
  - `GET /bi/sunburst` → `bi:read`
  - `PUT /overrides/status` → `overrides:update`
  - `PUT /overrides` → `overrides:update`
  - `POST /sync/timesheets` → `sync:execute`
- Seed role→permission defaults to mirror current access:
  - `hr`: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`
  - `management`: `project:read`, `timesheet:read`, `bi:read`
  - `directors`: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`
  - `admins`: all permissions (see Phase 5 for bypass removal)
- Initially use dual-gate (role OR permission) to de-risk.

## Phase 4: Admin RBAC APIs
- Under `/admin/rbac` guarded by `requirePermission('rbac:admin')`:
  - Roles: `GET/POST/DELETE /roles`, `POST/DELETE /roles/:id/permissions/:perm`
  - Permissions: `GET/POST/DELETE /permissions`
  - Role assignment: `POST/DELETE /users/:id/roles/:role`
  - Scoped grants: `POST/DELETE /grants` (supports `?dryRun=1`), list `GET /grants`
- Validate inputs, ensure idempotency, and return clear error reasons.

## Phase 5: Least-Privilege Tightening
- Replace blanket admin bypass with explicit `*` permission or explicit full set via `role_permissions`.
- Log any legacy admin bypass usage during transition; remove bypass once permission path is verified.
- Optionally split `overrides:update` into: `overrides:update:status`, `overrides:update:money_collected`, `overrides:update:is_prospective` if finer control is required.

## Phase 6: Resource-Level Scoping
- Support project-scoped grants for overrides endpoints using `resource_type='project'` and `resource_id=kimai_project_id`.
- Provide helpers like `extractProjectId(req)` for `requirePermission` resource extraction.
- Prepare for future scoping on reads (by project or customer) as requirements evolve.

## Phase 7: Auditing & Observability
- Add `rbac_audit_logs` or extend `audit_logs` to include: `permission`, `resource_type`, `resource_id`, `decision` (allow|deny), `reason`.
- Log all 403 denials and all RBAC mutations (role/permission/grant changes).
- Add counters for denials and privileged operations; expose minimal metrics for alerting.

## Phase 8: Developer Ergonomics
- Add `permit(permission, extractor?)` helper and common extractors.
- Add a route inventory script to flag endpoints missing `requirePermission`.
- Document permission naming conventions and contribution rules in `docs/`.

## Phase 9: Testing & Coverage
- Unit tests for `PermissionsService` (allow/deny, scoping, expiry, wildcard).
- Middleware tests for `requirePermission` (401/403/200 paths with reasons).
- Integration tests on critical routes with users across roles.
- Snapshot tests for seeded role→permission mappings.

## Phase 10: Rollout Plan
- Step 1: Ship schema + `PermissionsService`; shadow-evaluate decisions (no enforcement), log would-be denials.
- Step 2: Enable dual-gate on read routes.
- Step 3: Switch reads to permission-only.
- Step 4: Dual-gate then switch writes; replace admin bypass with explicit permissions.
- Step 5: Enable scoped grants; validate with targeted users.
- Step 6: Remove legacy role checks.

## Acceptance Criteria
- All routes guarded by `requirePermission` with documented permissions.
- Admin can manage roles/permissions/grants via APIs; all changes audited.
- High test coverage on policy engine/middleware; integration on key routes.
- Metrics reflect RBAC denials and privileged ops; no unexplained access paths.
- No blanket bypass; admin access is explicit and auditable.
