## Backend config
Link: [./.env](./.env)


### Frontend config (Vite + shadCN)
Link: [./client/.env](./client/.env)

### Quick sanity tests
Bash commands to test various functions and endpoints.
Link: [quick-sanity-tests.md](./quick-sanity-tests.md)

### Build & Run
- Guide for development and production builds: [docs/build-and-run.md](./docs/build-and-run.md)

### Initial Deployment
- First-time server deploy checklist: [docs/initial-deployment.md](./docs/initial-deployment.md)

### CI/CD
- Continuous Integration and Deployment guidance: [docs/ci-cd.md](./docs/ci-cd.md)

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
  - Users Endpoints Checklist: [docs/users-endpoints-checklist.md](./docs/users-endpoints-checklist.md)
  - Database Structure: [docs/database-structure.md](./docs/database-structure.md)
  - Kimai Projects Schema: [docs/kimai2_projects-schema.md](./docs/kimai2_projects-schema.md)
  - Kimai Timesheet Schema: [docs/kimai2_timesheet-schema.md](./docs/kimai2_timesheet-schema.md)
  - Overrides Model: [docs/overrides-projects.md](./docs/overrides-projects.md)
  - Taxonomy & Tags: [docs/taxonomy-tags.md](./docs/taxonomy-tags.md)
  - Payments Design: [docs/payments-implementation.md](./docs/payments-implementation.md)
  - Kimai Sync Plan: [docs/kimai-sync.md](./docs/kimai-sync.md)

### Admin Users API
- Requires `rbac:admin` and uses write rate limits.
- Endpoints:
  - `POST /admin/users` — create user
  - `GET /admin/users` — list users (supports `?page=&pageSize=&search=&active=`)
  - `GET /admin/users/:id` — fetch user by id
  - `PUT /admin/users/:id` — update `display_name`, `is_active`, optionally `password`
  - `POST /admin/users/:id/activate` — set active
  - `POST /admin/users/:id/deactivate` — set inactive
  - `DELETE /admin/users/:id` — soft delete (sets `is_active=false`)
- Response shape: `{ id, email, display_name, is_active, created_at, updated_at }`
- cURL examples: see [quick-sanity-tests.md](./quick-sanity-tests.md)

Seeding an Admin User
- Optionally seed an admin user via env vars (no PII in code):
  - Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and optional `ADMIN_DISPLAY_NAME`).
  - Run: `npm run db:seed:admin`.
  - The script calls the same logic used at app startup and assigns the `admins` role.

### Self-Service
- Endpoints:
  - `GET /me` — returns authenticated user `{ id, email, roles }`.
  - `PUT /me` — updates `display_name` only.
  - `POST /me/password` — change password with `{ current_password, new_password }`.
  - `POST /auth/password-reset/request` — request a password reset by email (always 200; no account enumeration).
  - `POST /auth/password-reset/confirm` — confirm reset with `{ token, new_password }`.
- Notes:
  - `/me` routes require authentication.
  - Write endpoints are rate-limited.
  - Reset tokens are one-time and time-limited.
- cURL examples: see [quick-sanity-tests.md](./quick-sanity-tests.md)

SPA Hosting
- For SPA deep links (e.g., `/reset`, `/account`) configure history fallback so routes resolve to `index.html`.
- See client docs: client/docs/spa-history-fallback.md

### Email Service
- Env vars:
  - `MAILER_FROM` (e.g., `timesheet@rspkl.com` or `RSPKL Atlas <timesheet@rspkl.com>`)
  - `MAILER_FROM_NAME` (optional; pairs with `MAILER_FROM` to form `Name <address>`)
  - `MAILER_URL` (SMTP URL or special values)
    - SMTP: `smtp://user:pass@host:port?verify_peer=0|1` (percent-encode `@` in user as `%40`)
    - Dev log: `dev://log` (logs instead of sending)
    - Disable: `null://null` (no-op)
  - `DEVELOPER_EMAIL` (for test sends)
  - `APP_BASE_URL` (base URL of the web app used in links, e.g., `https://app.rspkl.com` or `http://localhost:5173`)
  - `RESET_PATH` (path on the web app that handles password resets, default `/reset`)
- Test send:
  - `npm run mail:test` (sends to `DEVELOPER_EMAIL` if SMTP is enabled; logs URL with password redacted)
- More details: [docs/email-service-checklist.md](./docs/email-service-checklist.md)

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

### Admin Project Statuses
- Purpose: Lookup table powering `status_id` on project overrides.
- Endpoints (require `rbac:admin`):
  - `GET /admin/statuses` — list statuses
  - `POST /admin/statuses` — create `{ name, code?, is_active?, sort_order? }`
  - `PUT /admin/statuses/:id` — update any fields above
  - `DELETE /admin/statuses/:id` — remove a status
- Using `status_id` in overrides:
  - `PUT /overrides` body may include `status_id`; API persists `status_id` only (UI resolves name from lookup).
  - `PUT /overrides/status` accepts `status_id`.
 - DB constraints and inference:
   - `project_statuses.code` and `project_statuses.sort_order` are NOT NULL (see migration `drizzle/0007_statuses_require_code_sort.sql`).
   - When API callers omit `code`, the service infers it by slugifying `name` (lowercase, spaces→dashes, alnum only).
   - When API callers omit `sort_order`, the service sets it to `MAX(sort_order) + 10`.
   - The migration backfills code/sort_order for existing rows and then enforces NOT NULL.

Metrics
- `GET /metrics` returns in-memory counters for RBAC decisions and admin mutations

Sync (Kimai → Atlas)
- Endpoints (require `sync:execute` permission):
  - `POST /sync/projects` — refresh projects (staging-and-swap)
  - `POST /sync/timesheets` — incremental sync of timesheets
  - `GET /sync/health` — last-run state and replica counts
- CLI:
  - `npm run sync:all` — runs all syncs in sequence
  - `npm run sync:verify` — compares Kimai vs replicas (totals, recent window), with per-day breakdown
  - `npm run sync:materialize` — builds snapshot tables `mat_projects` and `mat_timesheet_facts` for BI performance
