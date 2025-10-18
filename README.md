## Backend config
Link: [./.env](./.env)


### Frontend config (Vite + shadCN)
Link: [./client/.env](./client/.env)

### Quick sanity tests
Bash commands to test various functions and endpoints.
Link: [quick-sanity-tests.md](./quick-sanity-tests.md)

---

### Development Plan
Link: [development-plan.md](./development-plan.md)

### Development Progress Tracking
Link: [development-progress-tracking.md](./development-progress-tracking.md)

---

### RBAC and Auth
- RBAC Implementation Plan: [docs/rbac-implementation-plan.md](./docs/rbac-implementation-plan.md)
- Missing RBAC Essentials: [docs/rbac-missing-essentials.md](./docs/rbac-missing-essentials.md)
- Implementation Checklist: [docs/rbac-implementation-checklist.md](./docs/rbac-implementation-checklist.md)
 - Testing Plan: [docs/rbac-testing-plan.md](./docs/rbac-testing-plan.md)
   - Includes edge-case behaviors for overrides and protected routes
 - Drizzle Setup Guide: [docs/drizzle-setup.md](./docs/drizzle-setup.md)
 - RBAC Flags & Observability: [docs/rbac-flags.md](./docs/rbac-flags.md)
 - Permission Naming: [docs/rbac-permission-conventions.md](./docs/rbac-permission-conventions.md)

Admin RBAC API (requires `rbac:admin` or `*`)
- List roles: `GET /admin/rbac/roles`
- Create role: `POST /admin/rbac/roles` body `{ name }`
- Delete role: `DELETE /admin/rbac/roles/:id`
- List perms: `GET /admin/rbac/permissions`
- Create perm: `POST /admin/rbac/permissions` body `{ name }`
- Delete perm: `DELETE /admin/rbac/permissions/:id`
- Add perm to role: `POST /admin/rbac/roles/:id/permissions/:perm`
- Remove perm from role: `DELETE /admin/rbac/roles/:id/permissions/:perm`
- Assign role to user: `POST /admin/rbac/users/:id/roles/:role`
- Remove role from user: `DELETE /admin/rbac/users/:id/roles/:role`
- Grants: `GET /admin/rbac/grants`, `POST /admin/rbac/grants` (supports `?dryRun=1`), `DELETE /admin/rbac/grants/:id`

Metrics
- `GET /metrics` returns in-memory counters for RBAC decisions and admin mutations
