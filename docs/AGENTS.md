# RSPKL Atlas — Agent Brief

## Ground Rules
- Root `AGENTS.md` is a sentinel; document updates belong here only.
- Root `README.md` is immutable; defer to `docs/README.md` and linked guides.
- Default to ASCII and align with existing coding patterns when editing source.

## Quickstart Checklist
```bash
# install deps (monorepo style)
npm ci
cd client && npm ci

# bootstrap databases (requires env vars in ./.env and ./client/.env)
npm run db:install

# dev servers
npm run dev            # API (PORT from env, typically 9999)
cd client && npm run dev  # Vite UI proxying to ${VITE_API_TARGET}/api

# describe live schemas when debugging replicas
npm run db:describe:kimai
npm run db:describe:atlas
```

## Mission Snapshot
- Build and harden Atlas auth + RBAC with shadcn/react admin tooling.
- Keep Kimai replicas in sync while exposing override, payments, and studio workflows.
- Maintain runbooks (deploy, CI/CD, testing, sync) so ops stays reproducible.

## Architecture Highlights
- API entrypoint `src/index.ts` wires Express 5 routes, global middlewares, and SPA fallback. Every route is gated via `permit(...)` for granular permissions in tandem with rate limiters.
- Auth stack lives in `src/services/authService.ts` and `src/controllers/authController.ts`, issuing JWT cookies, seeding admins from env, and handling password resets (mailer via env-driven transport).
- RBAC decisions flow through `src/middleware/permissions.ts` backed by Drizzle models in `src/db/schema.ts`. Scoped grants and audit logging are first-class; use `recordRbacDecision` for any new gate.
- Sync utilities (`src/services/*Sync.ts`, `scripts/sync-*.ts`) materialize Kimai data into Atlas tables using staging-table swaps and `sync_state` markers.
- Client SPA in `client/src/app/App.tsx` uses React Router, shadcn/ui components, and role guards to switch between dashboards, admin screens, payments, and studios.

## Essential References
- `docs/README.md` — index of environment configs, sanity tests, and major guides.
- `docs/development-plan.md` + `docs/development-progress-tracking.md` — rolling RBAC/UI roadmap.
- `docs/build-and-run.md` — dev/prod build instructions, troubleshooting, and deployment scripts.
- `docs/initial-deployment.md`, `docs/ci-cd.md` — server rollout, automated CI/CD workflow (`.github/workflows/ci.yml`), and operational SOPs.
- `quick-sanity-tests.md` — cURL smoke tests for auth, RBAC, sync, and payments flows.

## Domain Deep Dives
- RBAC: `docs/rbac-implementation-plan.md`, `docs/rbac-missing-essentials.md`, `docs/rbac-implementation-checklist.md`, `docs/rbac-testing-plan.md`, `docs/rbac-permission-conventions.md`, `docs/rbac-flags.md`.
- Data & Sync: `docs/database-structure.md`, `docs/kimai2_schemas/`, `docs/overrides-projects*.md`, `docs/payments-implementation.md`, `docs/project-payments.md`, `docs/prospective-linking*.md`.
- Client UX: `client/docs/admin-ui-checklist.md`, `client/docs/self-service-ux-checklist.md`, `client/docs/status-id-migration-checklist.md`, `client/docs/prospective-projects-ui.md`, `client/docs/spa-history-fallback.md`.

## Verification & Testing
- Unit/integration suites live under `tests/`; run targeted commands (`npm test`, `npm run test:projects:v2`, `npm run test:prospective:all`) as needed.
- For mailers/password reset flows, remember `NODE_ENV=test` short-circuits SMTP sends and exposes `debugToken`.
- Metrics endpoint `/api/metrics` is unauthenticated; use it for quick RBAC counter checks post-change.

## Active TODO Signals
- `development-progress-tracking.md` still lists Day 6–7 polish (role badges, staging smoke tests, doc refresh).
- Admin UI checklists track soft delete UX, bulk actions, A11y, and validation safeguards.
- RBAC docs flag audit + observability hardening and scoped permission coverage gaps.

## Agent Tips
- Begin with `quick-sanity-tests.md` to ensure auth cookies and DB pools are healthy.
- When adding permissions or grants, mirror naming conventions and update both plans and checklists.
- For sync adjustments, validate schema assumptions with `ProjectsSync.assertReplicaSchema()` before touching migrations.
- SPA routing normalizes double slashes on load; keep deep links under `/reset`, `/account`, `/admin/...` consistent with Vite history fallback.
- Deployments must follow the droplet runbook in `docs/ci-cd.md`; build on-server, migrate, then `pm2 reload atlas-api`.
- CI/CD automation expects GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY`; without them the deploy job will noop.
