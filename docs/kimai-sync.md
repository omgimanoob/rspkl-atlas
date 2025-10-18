# Kimai Sync – Design and Plan

Atlas’ third core function is to provide well‑modeled, queryable data for analytics tools (e.g., Metabase). To achieve this, we will sync core Kimai tables into the Atlas DB, enrich them with Atlas overlays (overrides, tags, payments), and expose stable tables/views for BI.

## Goals
- Reliable, low‑latency replicas of Kimai data needed for BI.
- Enriched, denormalized views that include Atlas‑only data (overrides, taxonomy tags, payments rollups).
- Incremental syncs with idempotency and checkpoints; backfill support.
- Minimal impact on Kimai; Atlas is the BI‑facing store.

## Scope (Phase 1)
- Replicate Kimai tables (core):
  - `kimai2_projects` → `replica_kimai_projects`
  - `kimai2_timesheet` → `replica_kimai_timesheets`
- Replicate Kimai tables (dimensions for analytics):
  - `kimai2_users` → `replica_kimai_users`
  - `kimai2_activities` → `replica_kimai_activities`
  - `kimai2_tags` → `replica_kimai_tags`
  - `kimai2_timesheet_tags` → `replica_kimai_timesheet_tags`
  - (Optional) `kimai2_customers` → `replica_kimai_customers`
- Build enriched views:
  - `vw_projects` — `replica_kimai_projects` LEFT JOIN `overrides_projects` + tags + payments rollup
  - `vw_timesheet_facts` — `replica_kimai_timesheets` JOIN `replica_kimai_projects/users/activities` + aggregated tags + enriched project columns

## Data Flow
1) Extract: Read from Kimai via `kimaiPool`.
2) Load: Upsert into `replica_…` tables in Atlas DB.
3) Transform: Expose `vw_…` views; optionally materialize denormalized tables if needed for performance.

## Replicated Tables (Atlas DB)
- `replica_kimai_projects`
  - Columns mirror `kimai2_projects` (see `docs/kimai2_projects-schema.md`), plus `synced_at` timestamp.
  - PK: `id` (Kimai project id)
- `replica_kimai_timesheets`
  - Subset or full mirror of `kimai2_timesheet` (id, user, project, activity, begin, end, duration, rate, etc.), plus `synced_at`.
  - PK: `id` (Kimai timesheet id)
- `replica_kimai_users`
  - Columns mirror `kimai2_users` (id, username, email, enabled, color, supervisor_id, etc.), plus `synced_at`.
  - PK: `id`
- `replica_kimai_activities`
  - Columns mirror `kimai2_activities` (id, project_id?, name, visible, billable, time_budget, budget), plus `synced_at`.
  - PK: `id`
- `replica_kimai_tags`
  - Columns mirror `kimai2_tags` (id, name, color), plus `synced_at`.
  - PK: `id`
- `replica_kimai_timesheet_tags`
  - Columns mirror `kimai2_timesheet_tags` (timesheet_id, tag_id), plus `synced_at`.
  - PK: composite or surrogate id; indexes on (timesheet_id), (tag_id)
- `replica_kimai_customers` (optional Phase 1.5)
  - Columns mirror `kimai2_customers`, plus `synced_at`.

Indexes
- Primary keys on Kimai ids.
- Time‑based indexes on `begin/end` for timesheets; on `synced_at` for housekeeping.

## Enriched Views
- `vw_projects`
  - Base: `replica_kimai_projects p`
  - LEFT JOIN `overrides_projects o` ON `o.kimai_project_id = p.id`
  - LEFT JOIN `project_tags pt` → `taxonomy_terms` → `taxonomies` (aggregate terms per project)
  - LEFT JOIN `project_payments_rollup r` by project
  - Selected fields: p.*, o.money_collected (cached), o.status, o.is_prospective, tags (array/string agg), payments total(s)
- `vw_timesheet_facts`
  - Base: `replica_kimai_timesheets t`
  - JOIN `replica_kimai_projects p` (basic project info like name, customer_id)
  - JOIN `replica_kimai_users u`
  - JOIN `replica_kimai_activities a`
  - LEFT JOIN aggregated timesheet tags from `replica_kimai_timesheet_tags` + `replica_kimai_tags`
  - LEFT JOIN `vw_projects` (or join overlays directly) for enriched project columns (status, tags)
  - Selected fields: t.*, user_name, activity_name, project_name, customer_id, project_status, project_tags_csv, billable flags, derived duration_hours

Note: If the DB engine lacks native array agg, expose tags as comma‑separated string and document how to split in BI.

## Incremental Sync Strategy
- Projects
  - Use a high‑water mark on `id` or an `updated_at`/`modified_at` column if available.
  - If Kimai lacks update timestamps, fallback to comparing a hash of selected columns or periodic full refresh (projects are small).
- Timesheets
  - Prefer `modified_at` if available; else use the max `id` and a windowed backfill (e.g., last N days) to catch edits.
- Users / Activities / Tags / Customers
  - Small dimensions; refresh fully on a schedule (e.g., hourly/daily) if no `modified_at`.
- Timesheet Tags
  - Sync by joining to the same timesheet window as timesheets; or full refresh if volume allows.
- Checkpoints
  - Store last synced checkpoints in `sync_state` (key/value): e.g., `kimai.projects.max_id`, `kimai.timesheets.max_id`.

## Reliability
- Idempotent upserts on replicas using PK `id`.
- Batched reads (e.g., 5k rows) with retry on transient failures.
- Metrics: `sync.projects.upserts`, `sync.timesheets.upserts`, `sync.errors`.
- Audit logs: record manual triggers and failures.

## Scheduling & Triggers
- CLI/NPM scripts: `npm run sync:projects`, `npm run sync:timesheets` (Phase 1)
  - Additional: `npm run sync:users`, `npm run sync:activities`, `npm run sync:tags`, `npm run sync:customers` (optional)
- Admin endpoint (present): `POST /sync/timesheets` (requires `sync:execute`) — can be extended for projects.
- Cron/scheduler (external or PM2) to run syncs periodically.

## Security
- Replicas live in Atlas DB; BI tools connect read‑only.
- No writes back to Kimai. Filter sensitive columns if not needed.

## BI Configuration
- Point BI (e.g., Metabase) to Atlas DB.
- Include only `replica_…` tables and `vw_…` views in the BI model.
- Add entity relationships (project id, customer id) for drill‑through.
 - Example questions:
   - Activity breakdown by duration_hours (group by activity, project, customer)
   - User productivity: sum duration_hours per user; derive utilization from billable vs total
   - Tag-based segmentation: filter by project or timesheet tags

## Tasks & Plan
- Phase 1
  - [ ] Create replica tables (`replica_kimai_projects`, `replica_kimai_timesheets`, `replica_kimai_users`, `replica_kimai_activities`, `replica_kimai_tags`, `replica_kimai_timesheet_tags`).
  - [ ] Implement sync scripts/services with checkpoints & upsert.
  - [ ] Create `vw_projects` and `vw_timesheet_facts` views.
  - [ ] Add NPM scripts and optional endpoints for manual triggers.
- Phase 2
  - [ ] Add `replica_kimai_customers` + enriched customer views if required.
  - [ ] Materialize heavy views if performance needs demand it.
  - [ ] Add metrics endpoints/dashboards for sync health.
- Phase 3
  - [ ] Expand views to include payments rollups and taxonomy tags.
  - [ ] Data quality checks (counts vs Kimai, recent changes).

## References
- Kimai projects schema: `docs/kimai2_projects-schema.md`
- Overrides: `docs/overrides-projects.md`
- Taxonomy tags: `docs/taxonomy-tags.md`
- Payments: `docs/payments-implementation.md`
