# Overrides – Implementation Checklist

Actionable tasks to implement and evolve the `overrides_projects` model that fills gaps not present in Kimai. See design: `docs/overrides-projects.md`.

## Phase 1 – Schema & Migration
- [x] Table `overrides_projects` (Atlas DB) with core fields:
  - [x] `kimai_project_id` (FK-less reference), `money_collected` (decimal), `status` (varchar), `is_prospective` (tinyint), `notes`, `source`, `updated_by_*`, timestamps, `extras_json`.
  - [x] Unique index on `kimai_project_id` (one override row per Kimai project).
- [x] Prospective projects: allow `kimai_project_id` to be NULL; unique index applies only when not NULL (MySQL unique index permits multiple NULLs).
- [x] Add optional indexes for `status`, `is_prospective`.

## Phase 2 – Services & Repository
- [x] Read overrides for projects; merge logic only applies non-null overrides.
- [x] Update endpoints write to `overrides_projects` only (never Kimai).
- [x] Helper to compute/normalize project id from request payload.

## Phase 3 – API Endpoints (Write)
- [x] `PUT /overrides/status` — update `status` / `is_prospective`.
- [x] `PUT /overrides` — upsert multiple fields (e.g., `money_collected`).
- [x] Resource extractor uses `body.id || body.kimai_project_id`.
- [x] Guard with `overrides:update` (project-scoped) and rate-limits.

## Phase 4 – Validation, RBAC & Auditing
- [x] Validate payload; support partial updates; reject invalid types.
- [x] RBAC enforcement via `requirePermission('overrides:update', { resourceExtractor })`.
- [x] Record audit rows for writes (route, method, status, user, payload hash).

## Phase 5 – Prospective Projects (Create → Link)
- [x] Support creating overrides rows with `kimai_project_id=NULL` for Prospective Projects.
- [x] Admin/automation endpoint to link a Prospective row to a real Kimai project id when created.
- [x] Ensure visibility until linked via separate listing endpoint (`GET /admin/prospective`).

## Phase 6 – Status Taxonomy
- [x] Document initial status vocabulary (Unassigned, Schematic Design, Design Development, Tender, Under construction, Post construction, KIV, Others).
- [x] Introduce `project_statuses` lookup table with admin CRUD and reference via `status_id`.
- [x] Accept only `status_id` in write APIs (`PUT /overrides`, `PUT /overrides/status`).
- [x] Denormalize `status` string from lookup name for readability; no longer accept raw `status` input.

## Phase 7 – Money Collected Semantics
- [x] Treat `money_collected` as cached/denormalized from authoritative payments.
- [x] Document rollup plan and override behavior (see `docs/payments-implementation.md`).
- [ ] (Optional) Policy flag to hydrate `money_collected` automatically from rollup when null.

## Phase 8 – BI Integration
- [x] Include overrides in `vw_projects` (override_status, override_is_prospective, override_money_collected).
- [x] Surface override fields in `vw_timesheet_facts` via join to `vw_projects`.
- [ ] (Optional) Materialize to snapshot tables for performance (`npm run sync:materialize`).

## Phase 9 – Tests
- [x] Integration tests for overrides endpoints (status/multi-field update, scoping, 400/403 cases).
- [ ] Add unit tests for merge semantics (null vs override precedence). 
  - [ ] Given upstream value and null override → returns upstream
  - [ ] Given upstream value and non-null override → returns override
  - [ ] Given no upstream value and non-null override → returns override
  - [ ] Given both null → returns null
- [x] Add tests for Prospective project linking workflow when implemented.
- [ ] View tests (read-only):
  - [ ] `vw_projects` includes override_status, override_is_prospective, override_money_collected for rows with overrides
  - [ ] `vw_timesheet_facts` exposes project_status and aggregated tags
  - [ ] Materialized tables (`mat_*`) match their source views when built

## Phase 10 – Observability & Ops
- [x] Audit logs for writes.
- [x] Add counters/metrics for override mutations (create/update/link) if needed.
- [x] Document in sanity tests and README how to exercise endpoints.

---

## Current Status Summary
- Implemented: endpoints (`PUT /overrides/status`, `PUT /overrides`), Prospective project create/list/link endpoints, RBAC, auditing, merge semantics, BI view integration, status vocabulary documented, money_collected semantics documented. Tests cover overrides endpoints, view exposure, and Prospective linking.
- Pending: optional status lookup table + validation, optional metrics for override mutations, unit tests for merge behavior.
