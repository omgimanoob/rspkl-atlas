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
  - Selected fields: p.*, o.money_collected (cached), o.status_id, o.is_prospective, tags (array/string agg), payments total(s)
- `vw_timesheet_facts`
  - Base: `replica_kimai_timesheets t`
  - JOIN `replica_kimai_projects p` (basic project info like name, customer_id)
  - JOIN `replica_kimai_users u`
  - JOIN `replica_kimai_activities a`
  - LEFT JOIN aggregated timesheet tags from `replica_kimai_timesheet_tags` + `replica_kimai_tags`
  - LEFT JOIN `vw_projects` (or join overlays directly) for enriched project columns (status_id, tags)
  - Selected fields: t.*, user_name, activity_name, project_name, customer_id, project_status_id, project_tags_csv, billable flags, derived duration_hours

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

## Sync Strategies (Implementation)

- Dimensions (small/medium tables): staging-and-swap
  - Tables: users, activities, tags, timesheet_tags, projects (and customers if enabled).
  - Steps per run:
    1. Create staging table as `CREATE TABLE live_stg LIKE live`.
    2. Bulk load all current rows from Kimai into staging.
    3. Atomically `RENAME TABLE live TO live_old, live_stg TO live`; then drop `live_old`.
  - Benefits: reflects deletions, yields a consistent snapshot, avoids empty-table windows for readers.

- Facts (large mutable tables): incremental upsert with overlap
  - Tables: timesheets.
  - Steps per run:
    1. Read rows with `modified_at > last_checkpoint - overlap` (e.g., 5 minutes).
    2. Upsert into replica by PK with `INSERT … ON DUPLICATE KEY UPDATE`.
    3. Advance `last_checkpoint` to max `modified_at` seen.
  - Deletions: if needed, periodically reconcile a rolling window (e.g., last 90 days) and delete IDs not present in Kimai.

Consistency notes
- `RENAME TABLE` is atomic in MySQL and ensures readers see either the old or the new snapshot, not a partial load.
- Keep `synced_at` on all replicas for freshness checks; maintain checkpoints in `sync_state` for incrementals.

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
  - [x] Create replica tables (`replica_kimai_projects`, `replica_kimai_timesheets`, `replica_kimai_users`, `replica_kimai_activities`, `replica_kimai_tags`, `replica_kimai_timesheet_tags`).
  - [x] Implement sync scripts/services (dimensions via staging-and-swap; timesheets via incremental with overlap).
  - [x] Create `vw_projects` and `vw_timesheet_facts` views.
  - [x] Add NPM scripts for manual triggers (`sync:*`).
- Phase 2
  - [x] Add `replica_kimai_customers` + include in views where useful.
  - [x] Materialize heavy views if performance needs demand it (`npm run sync:materialize`).
  - [x] Add metrics endpoints for sync health (`/metrics` includes sync state/cnts; `/sync/health`).
- Phase 3
  - [ ] Expand views to include payments rollups and taxonomy tags.
  - [x] Data quality checks (counts vs Kimai, recent changes).
  - [x] Add a verification script (`npm run sync:verify`) to compare counts (totals and recent window) and per-day breakdowns.

## Verification
- Run all syncs: `npm run sync:all`
- Verify counts and recent changes: `npm run sync:verify`
  - Config via env:
    - `QUALITY_WINDOW_DAYS` (default 7)
    - `QUALITY_TOLERANCE` (default 0.02 = 2%)
  - Output:
    - Totals for projects/users/activities/timesheets (Kimai vs replicas)
    - Timesheets counts in the recent window (Kimai vs replicas)
    - Per-day breakdown for timesheets in the window
  - Sync health:
    - `/sync/health` (requires `sync:execute`) — last-run state and replica counts
    - `/metrics` — includes `sync` section with state and counts

Linking validation
- Linking Prospective → Kimai can rely on either the live Kimai DB (`kimai2_projects`) or the `replica_kimai_projects` table if sync freshness is guaranteed.
- Prefer live DB (via `kimaiPool`) for strict existence checks to avoid race conditions when linking immediately after creation.

## Materialization
- For BI performance, create snapshot tables from views:
  - `npm run sync:materialize` (builds `mat_projects` and `mat_timesheet_facts` from `vw_*` via staging-and-swap)
- Schedule materialization as needed based on reporting freshness requirements.

## References
- Kimai projects schema: `docs/kimai2_projects-schema.md`
- Overrides: `docs/overrides-projects.md`
- Taxonomy tags: `docs/taxonomy-tags.md`
- Payments: `docs/payments-implementation.md`
