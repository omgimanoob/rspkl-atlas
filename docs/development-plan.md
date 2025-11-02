# One-Week Plan: In‑App RBAC + shadcn/ui

This plan delivers in‑app authentication and role‑based access control (RBAC) for Atlas, plus a new shadcn/ui React frontend, within one week. No third‑party identity providers are used.

## Scope
- Implement in‑app auth (username/password) with secure cookies (JWT) and RBAC enforced server-side.
- Build a React + Tailwind + shadcn/ui client for project overrides (list + edit status).
- Keep existing API semantics; extend with minimal endpoints for auth and user info.

## Decisions
- Auth: Username/password stored as bcrypt hashes in DB; login issues an HTTP‑only, SameSite=strict cookie with short‑lived JWT.
- RBAC: Roles in DB; middleware `requireRole(...)` protects routes.
- Bootstrap: Seed an admin user from env on first run.
- UI: New `client/` app using Vite + React + shadcn/ui; role‑aware actions.

## Goals (End of Week)
- RBAC enforced on API routes (401/403 as appropriate).
- shadcn/ui projects page with role‑aware editing of status.
- Audit logging for all write actions.
- Hard‑coded ID filters moved to config (env‑driven).
- Health endpoint and basic documentation.

## Day-by-Day Plan

### Day 1 — Schema + Auth Skeleton
- Add tables: `users`, `roles`, `user_roles`, `audit_logs`.
- Add env: `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Implement endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /me`.
- Use bcrypt (12–14 rounds) for password hashing.

### Day 2 — RBAC + Route Guards
- Implement role middleware: `requireRole('hr'|'management'|'directors'|'admins')`.
- Protect routes:
  - Read (`GET /projects`, `/timesheets`, `/bi/sunburst`): hr | management | directors
  - Write (`PUT /overrides/status`): hr | directors (optionally management)
  - Sync (`POST /sync/timesheets`): admins
- Add audit logging on writes (who, route, payload hash, status, timestamp).

### Day 3 — Config + Security Hardening
- Move hard‑coded ID filters to config (read from env arrays).
- Add `helmet`, rate limit `POST /auth/login` and write routes.
- Add `GET /healthz` (DB ping, version) and improve error handling.

### Day 4 — Client Scaffolding (shadcn/ui)
- Create `client/` (Vite + React + TS + Tailwind).
- Install shadcn/ui; generate base components: button, input, select, table primitives, dialog/sheet, toast, badge, skeleton.
- Add API module and `.env` (`VITE_API_URL`).
- Auth flow: call `/auth/login`, rely on httpOnly cookie; fetch `/me` to hydrate user + roles.

### Day 5 — Projects UI
- Projects page: table (Project, Money, Status, Actions), search/filter.
- Edit in Sheet/Dialog: status (select) wired to `PUT /overrides/status`.
- Role‑aware UI: edit actions only for hr | directors; others read‑only.
- Validation and toasts for success/error.

### Day 6 — Polish + Staging Readiness
- Profile/role badge (from `/me`), loading skeletons, empty/error states.
- Smoke tests across roles (HR, Management, Directors, Admin).
- Update README: setup (server + client), envs, roles, route policy, runbook.

### Day 7 — Buffer + Fixes
- Address feedback, refine validations, confirm audit logs and rate limits.
- Prepare production rollout notes (checklist, rollback steps).

## Deliverables
- Server: `src/middleware/auth.ts`, `src/middleware/audit.ts`, `src/config.ts`, routes: `/auth/login`, `/auth/logout`, `/me`, `/healthz`; RBAC guards on existing routes.
- Frontend: `client/` app with shadcn/ui projects page and edit flow.
- SQL: migrations for `users`, `roles`, `user_roles`, `audit_logs`.
- Docs: README updates and short runbook.

## Schema (DDL Sketch)
- `users(id PK, email UNIQUE, password_hash, display_name, is_active TINYINT, created_at, updated_at)`
- `roles(id PK, name UNIQUE CHECK IN ('hr','management','directors','admins'))`
- `user_roles(user_id FK, role_id FK, PRIMARY KEY(user_id, role_id))`
- `audit_logs(id PK, user_id FK NULL, email, route, method, status_code, payload_hash, ip, created_at)`
- Seed `roles`; seed admin from env on first start.

## API Additions
- `POST /auth/login {email, password}` → sets JWT cookie; returns `{email, roles}`
- `POST /auth/logout` → clears cookie
- `GET /me` → `{email, roles}`
- `GET /healthz` → `{ok:true, db:true, version}`

## Security Notes
- JWT in HTTP‑only, SameSite=strict cookie; ~8h TTL; rotate `AUTH_JWT_SECRET` via env.
- Brute‑force protection on login (per‑IP and per‑email rate limits).
- Input validation; parameterized SQL; audit all writes.

## Acceptance Criteria
- Unauthorized users receive 401; insufficient roles receive 403.
- Admin seed works; roles assignable; RBAC enforced on all routes.
- shadcn UI shows projects; HR/Directors can edit status; others read‑only.
- Audit entries recorded for each write; filters configurable via env.
- Docs updated; staging pass across roles.

## Risks and Assumptions
- Assumes Node 18+, MySQL available; bcrypt cost acceptable for your infra.
- If time is tight, non‑essential UI polish can be deferred.

