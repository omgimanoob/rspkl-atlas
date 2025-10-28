# Overrides – Implementation Checklist

Actionable tasks to implement and evolve the `project_overrides` model that fills gaps not present in Kimai. See design: `docs/overrides-projects.md`.

## Phase 1 – Schema & Migration
- [x] Table `project_overrides` (Atlas DB) with core fields:
  - [x] `kimai_project_id` (FK-less reference), `money_collected` (decimal), `status_id` (int), `is_prospective` (tinyint), `notes`, `source`, `updated_by_*`, timestamps, `extras_json`.
  - [x] Unique index on `kimai_project_id` (one override row per Kimai project).
- [x] Prospective projects: allow `kimai_project_id` to be NULL; unique index applies only when not NULL (MySQL unique index permits multiple NULLs).
- [x] Add optional indexes for `status_id`, `is_prospective`.

## Phase 2 – Services & Repository
- [x] Read overrides for projects; merge logic only applies non-null overrides.
- [x] Update endpoints write to `project_overrides` only (never Kimai).
- [x] Helper to compute/normalize project id from request payload.

## Phase 3 – API Endpoints (Write)
- [x] `PUT /overrides/status` — update `status_id` / `is_prospective`.
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
 - [ ] Validate Kimai existence on link: check `kimai2_projects.id` exists (or Kimai API) before accepting `kimai_project_id`. Return 400 on unknown ids.
 - [ ] Prevent conflicts: reject link if another overrides row already references the target Kimai id (409).
 - [ ] Orchestration (optional): implement `POST /prospective/:id/kimai-create-link` to create in Kimai then link (permission `kimai:project:create`).

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

## Phase 11 – Projects UI Integration (Prospective Create)
 - [x] Backend: expose `GET /statuses` (read‑only; mirrors admin list) for non‑admins with `project:read`.
 - [x] Backend: add `POST /prospective` guarded by `prospective:create` (creates Atlas‑native row with `kimai_project_id=NULL`, `is_prospective=0`).
 - [x] Client: add `api.listStatusesPublic()` and `api.createProspective()`.
 - [x] Client: add "New Prospective Project" button and dialog on Projects page.
- [ ] Client: validate `name` (required, 1–128); optional `status` and `notes (<=1024)`.
- [ ] Client: success toast and close; no table mutation required in MVP.
- [ ] (Optional) Client: Prospective tab listing and link action using `POST /prospective/:id/link`.
 - [ ] (Optional) Client: “Create in Kimai and Link” action visible only with `kimai:project:create`; shows customer picker and name; orchestrates create→verify→link.

## Phase 12 – Linking Workflow & Error Handling
- [ ] Link flow (existing id): validate target exists in Kimai; link on success; show inline errors for `unknown_kimai_project` and `override_exists_for_project`.
- [ ] Create-and-link flow (optional):
  - Step 1: call Kimai API to create project (name + customer required). On failure → show error; do not mutate Atlas.
  - Step 2: verify existence (query Kimai DB or poll API for project id). On timeout → show retry guidance; do not mutate Atlas.
  - Step 3: call link endpoint to set `kimai_project_id` and force `is_prospective=0`.
  - Step 4: audit success; toast and refresh lists.

## Test Updates — Prospective & Linking
- [ ] Update `tests/integration/prospective-projects.test.ts` to:
  - [ ] Insert a real Kimai project row via `kimaiPool` and link using that id (expect 200).
  - [ ] Add a negative case linking to a non-existent id (expect 400 with `unknown_kimai_project`).
  - [ ] Assert re-link on the same row fails with `already_linked` (or your chosen reason).
- [ ] Add tests for new endpoints (when implemented):
  - [ ] `GET /statuses` returns active statuses for non-admin with `project:read`.
  - [ ] `POST /prospective` requires `prospective:create` and returns 201 with `is_prospective=false`.
  - [ ] `POST /prospective/:id/kimai-create-link` success path (mock Kimai API) and failure path (no Atlas mutation on failure/timeout).
- [ ] Seed/mapping in tests: ensure `prospective:create`, `prospective:link`, `prospective:read`, and `kimai:project:create` are granted in fixtures (or use wildcard `*`).
- [ ] Avoid random ids to reduce flakiness; always insert a Kimai project (or mock existence) and clean up.

## Current Status Summary
- Implemented: endpoints (`PUT /overrides/status`, `PUT /overrides`), Prospective project create/list/link endpoints, RBAC, auditing, merge semantics, BI view integration, status vocabulary documented, money_collected semantics documented. Tests cover overrides endpoints, view exposure, and Prospective linking.
- Pending: optional status lookup table + validation, optional metrics for override mutations, unit tests for merge behavior.
