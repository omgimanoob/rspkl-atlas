# RSPKL Atlas — Agent Brief
understanding databases: 
```bash
$ npm run db:describe:kimai
$ npm run db:describe:atlas
```



npm run 
## Mission Snapshot
- Build an in-app auth + RBAC platform with shadcn/ui client.
- Synchronize Atlas replicas with Kimai data while exposing admin tooling.
- Maintain detailed runbooks for deployment, testing, and operations.

## Essential References
- `README.md` — entry point linking env configs, quick tests, and major guides.
- `development-plan.md` & `development-progress-tracking.md` — one-week RBAC/ui plan plus status log.
- `docs/build-and-run.md` — dev/prod workflows, DB bootstrap scripts, troubleshooting.
- `docs/initial-deployment.md`, `docs/ci-cd.md` — rollout and pipeline playbooks.
- `quick-sanity-tests.md` — curl-driven smoke tests for auth, RBAC, sync, and admin APIs.

## RBAC & Auth Focus
- `docs/rbac-implementation-plan.md` — phased rollout from Drizzle schema to scoped grants and auditing.
- `docs/rbac-missing-essentials.md` — gap analysis driving central policy engine, observability, and user lifecycle.
- `docs/rbac-implementation-checklist.md`, `docs/rbac-testing-plan.md`, `docs/rbac-permission-conventions.md`, `docs/rbac-flags.md` — execution checklist, test matrix, naming standards, and feature-flag map.

## Data & Sync Domain
- `docs/database-structure.md` — Atlas schema overview.
- `docs/kimai2_schemas/README.md` + per-table files — Kimai replica schemas.
- `docs/overrides-projects.md`, `docs/overrides-projects-checklist.md` — overrides domain and status management.
- `docs/payments-implementation.md`, `docs/project-payments.md` — payments flow design.
- `docs/prospective-linking.md`, `docs/prospective-linking-workflow.md` — linking Atlas prospects to Kimai.

## Client & UX Notes
- `client/docs/admin-ui-checklist.md` — admin console build with users/roles/permissions/grants management.
- `client/docs/self-service-ux-checklist.md` — login/profile/password UX polish.
- `client/docs/status-id-migration-checklist.md`, `client/docs/prospective-projects-ui.md`, `client/docs/spa-history-fallback.md` — status lookup migration, prospective UI states, SPA routing fallback.

## Outstanding Work Signals
- Day 6–7 polish items remain open in `development-progress-tracking.md` (role badge, staging smoke tests, docs refresh).
- Admin UI checklist still tracking soft delete, bulk actions, accessibility, and advanced validations.
- RBAC docs emphasize closing audit, observability, and scoped-permission gaps before hardening rollout.

## Agent Tips
- Start with `quick-sanity-tests.md` to validate auth/cookies before hitting admin endpoints.
- Follow deployment guides for full build pipeline; client relies on `/api` proxy in dev.
- When extending RBAC, align permission names with conventions and update both plan & checklist docs to keep status coherent.
