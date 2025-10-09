# Development Progress Tracking — RBAC + shadcn/ui (1 Week)

Status Legend: [ ] pending, [~] in progress, [x] done

## Day 1 — Schema + Auth Skeleton
- [ ] Create migrations: `users`, `roles`, `user_roles`, `audit_logs`
- [ ] Add env: `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- [ ] Implement `POST /auth/login`, `POST /auth/logout`, `GET /me`
- [ ] Seed admin from env on first run

Notes:

## Day 2 — RBAC + Route Guards
- [ ] Implement `requireRole(...)` middleware
- [ ] Protect read routes for hr|management|directors
- [ ] Protect write and sync routes for hr|directors and admins
- [ ] Add audit logging on write endpoints

Notes:

## Day 3 — Config + Security Hardening
- [ ] Move hard‑coded ID filters to env config
- [ ] Add `helmet`, rate limit login + write routes
- [ ] Add `/healthz` endpoint and improve error handling

Notes:

## Day 4 — Client Scaffolding (shadcn/ui)
- [ ] Scaffold `client/` (Vite + React + TS + Tailwind)
- [ ] Install shadcn/ui and generate base components
- [ ] Implement API module and `.env` (`VITE_API_URL`)
- [ ] Auth flow: `/auth/login` + `/me` hydration

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

