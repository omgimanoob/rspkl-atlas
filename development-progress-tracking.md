# Development Progress Tracking — RBAC + shadcn/ui (1 Week)

Status Legend: [ ] pending, [~] in progress, [x] done

## Day 1 — Schema + Auth Skeleton
- [x] Create migrations: `users`, `roles`, `user_roles`, `audit_logs` (sql/001_auth_schema.sql)
- [x] Add env: `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (code reads them; set values in `.env`)
- [x] Implement `POST /auth/login`, `POST /auth/logout`, `GET /me`
- [x] Seed admin from env on first run (via AuthService.seedAdminIfConfigured)

Notes:

## Day 2 — RBAC + Route Guards
- [x] Implement `requireRole(...)` middleware
- [x] Protect read routes for hr|management|directors
- [x] Protect write and sync routes for hr|directors and admins
- [x] Add audit logging on write endpoints

Notes:

## Day 3 — Config + Security Hardening
- [x] Move hard‑coded ID filters to env config
- [x] Add `helmet`, rate limit login + write routes
- [x] Add `/healthz` endpoint and improve error handling

Notes:

## Day 4 — Client Scaffolding (shadcn/ui)
- [x] Scaffold `client/` (Vite + React + TS + Tailwind)
- [x] Install/generate base UI components (manual addition due to CLI/network limits)
- [x] Implement API module and dev proxy (`VITE_API_TARGET`)
- [x] Auth flow: `/auth/login` + `/me` hydration

Notes:

## Day 5 — Projects UI
- [ ] Projects table (Project, Money, Status, Actions) + search/filter
- [ ] Edit Sheet/Dialog: status select wired to `PUT /overrides/status`
- [ ] Role‑aware UI + toasts and basic validation

Notes:

## Day 6 — Polish + Staging Readiness
- [ ] Role badge from `/me`, loading states, empty/error states
- [ ] Smoke tests across roles (HR/Management/Directors/Admin)
- [ ] Update README and runbook

Notes:

## Day 7 — Buffer + Fixes
- [ ] Address feedback and refine validations
- [ ] Confirm audit logs + rate limits
- [ ] Prepare rollout checklist and rollback steps

Notes:
