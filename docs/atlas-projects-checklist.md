# Atlas-Native Projects — Implementation Checklist

Goal: Enable creating and managing projects that do NOT originate from Kimai (aka “Atlas-native” or “Prospective” projects), while keeping existing Kimai projects intact. Atlas-native projects live in Atlas DB and may optionally be linked to a Kimai project later.

Scope and assumptions
- Kimai projects are already implemented: read-only replicas + overrides and a unified Projects view.
- Atlas-native projects use the existing `project_overrides` table with `kimai_project_id = NULL` until linked.
- Status taxonomy is managed via `project_statuses` and `status_id` (UI resolves the status name for display — no denormalized string stored).

## Phase 1 — Data Model & Migrations
- [x] Use `project_overrides` for Atlas-native projects (non-Kimai):
  - `kimai_project_id` NULL
  - `status_id` (FK to `project_statuses`)
  - `is_prospective` = 1 by default (Atlas-native Prospective rows)
  - `money_collected` (decimal) — cached/denormalized value
  - `notes`, `source`, `updated_by_*`, timestamps
  - `extras_json` — store Atlas-only attributes (e.g., `name` initially)
- [x] Indexes/constraints already present:
  - Unique index on `kimai_project_id` (applies only when not NULL)
  - Indexes on `status_id` and `is_prospective`
- [ ] Optional: promote `name` from `extras_json` to a first-class column if/when needed (migration + ORM update).

## Phase 2 — Services & Repository
- [x] Prospective service (implemented via `StatusService` and overrides services)
- [x] Merge logic for Kimai+overrides (keeps override precedence when non-null)
- [ ] Add thin repository for Atlas-native projects:
  - `listAtlasProjects()` — rows where `kimai_project_id IS NULL`
  - `createAtlasProject({ name, statusId?, notes? })` — write to `project_overrides` with `is_prospective = 1`, `extras_json: { name }`, set `status_id` (and `status` denormalized) when provided
  - `updateAtlasProject(id, { name?, statusId?, notes?, money_collected?, is_prospective? })`
  - `deleteAtlasProject(id)` — soft delete or hard delete (decide policy; see Phase 5)
  - `linkAtlasProject(id, kimai_project_id)` — move from Atlas-native to linked Kimai row

## Phase 3 — API Endpoints (Admin)
- [x] Implemented:
  - `POST /admin/prospective` — create Atlas-native project (stores name in `extras_json`)
  - `GET /admin/prospective` — list Atlas-native (unlinked) projects
  - `POST /admin/prospective/:id/link` — link to Kimai project
- [ ] Extend Admin API for full CRUD (guarded by `rbac:admin`):
  - `PUT /admin/prospective/:id` — update `name`, `status_id`, `notes`, `money_collected`, `is_prospective`
  - `DELETE /admin/prospective/:id` — delete (or deactivate) Atlas-native project
  - Validation: require `name`; allow `status_id` only (server denormalizes `status`)
  - Audit: record mutations in `audit_logs`

## Phase 4 — Unified Read (Projects View)
- Current `/projects` returns Kimai projects enriched by overrides; Atlas-native projects with `kimai_project_id = NULL` are not included.
- [ ] Add optional inclusion of Atlas-native projects to `/projects`:
  - Option A (toggle): `/projects?includeAtlas=1` returns both Kimai + Atlas-native rows (Atlas-native lack Kimai fields)
  - Option B (separate): `GET /projects/atlas` returns Atlas-native projects only
  - Normalize DTO for Atlas-native rows to match essential columns used by the table (id, name, status, statusId, moneyCollected, isProspective; missing Kimai-only columns can be null/undefined)
- [ ] Ensure sorting, pagination, and filtering behave sensibly when combining sources.

## Phase 5 — Lifecycle & Policies
- [ ] Decide delete semantics for Atlas-native projects:
  - Soft delete (recommended): add `deleted_at` (nullable). Hidden from lists by default; prevent link when deleted.
  - Hard delete: only when never linked and no dependent records (payments, tags, etc.).
- [ ] Linking rules:
  - Prevent linking if another override already references the `kimai_project_id` (409 conflict)
  - On link, set `is_prospective = 0`, retain `money_collected`, `status_id`, `notes`, and `extras_json`
- [ ] Allow “unlinked Atlas-native” to be converted to “Atlas-only long-term project” (leave `is_prospective = 0` with `kimai_project_id = NULL`) if the business flow requires non-Kimai projects permanently.
- [ ] Consistency rules for `is_prospective` vs `kimai_project_id` (validate at API and optionally via DB checks):
  - When `kimai_project_id IS NULL` (Atlas-native), `is_prospective` must be `0`.
  - When `is_prospective <> 0`, `kimai_project_id` must be a valid number (not NULL).
  - Enforce in Admin forms (disable/toggle), service validation (reject invalid combinations), and add unit/integration tests.

## Phase 6 — UI (Admin)
- [ ] Admin: “Atlas Projects” page
  - List Atlas-native projects (id, name, status, is_prospective, money_collected, notes)
  - Create modal: `name` (required), `status` (via `status_id`), `notes`
  - Edit inline/modal: update fields; toggle `is_prospective`
  - Link action: open small dialog to type/paste `kimai_project_id` and link
  - Delete action: soft delete with confirm; show badge for deleted in a filtered view
  - Skeleton loading and consistent table placeholder (reusing `TablePlaceholder`)
- [ ] Permissions: guard Admin UI by `admins` (and/or introduce finer-grained permission e.g., `projects:atlas:manage`)

## Phase 7 — UI (Projects screen)
- [ ] Optional: show Atlas-native projects in the main Projects grid (behind a toggle/filter)
  - Filter pills: All | Kimai | Atlas-native
  - Columns: name, status, isProspective, moneyCollected (hide Kimai-only fields)
  - Reuse existing edit dialog to update `statusId`, `moneyCollected`, `isProspective`

## Phase 8 — Permissions & RBAC
- [ ] Introduce finer permissions (optional):
  - `projects:atlas:create`, `projects:atlas:update`, `projects:atlas:delete`, `projects:atlas:link`
  - Map to roles as needed; keep Admin as superset via `*` or explicit grants
- [ ] Continue using `overrides:update` for read/write on override fields in the shared edit dialog

## Phase 9 — Observability & Auditing
- [ ] Audit all Admin mutations (`create`, `update`, `delete`, `link`) with user, route, method, and status
- [ ] Add counters to metrics (e.g., `prospective.created`, `prospective.linked`, `atlas_projects.updated`, `atlas_projects.deleted`)

## Phase 10 — Tests
- [x] Integration tests exist for create/list/link (Prospective)
- [ ] Add integration tests for update/delete of Atlas-native projects
- [ ] Add `/projects?includeAtlas=1` or `/projects/atlas` tests (DTO shape, pagination, sorting)
- [ ] RBAC tests for Admin endpoints
- [ ] UI test plan (manual/Playwright): create, edit, link, delete; skeleton/placeholder; error paths

## Phase 11 — Docs & Sanity
- [ ] README section: Atlas-native projects — flows, linking, and limitations
- [ ] Quick sanity guide: cURL examples for Admin CRUD + link, and how to view Atlas-native rows in UI
- [ ] Note on `extras_json` vs promoted columns for `name`; migration guidance if promoting later

---

### Notes & Decisions
- Atlas-native naming: initially stored in `extras_json` to reduce schema churn. Promote to a dedicated `name` column when requirements stabilize.
- Status: accept only `status_id` on writes; server denormalizes `status` string for display.
- Linking is a one-way operation; unlinking is not supported (document if needed).
- “Prospective” flag (`is_prospective`) can be toggled even without linking to reflect pipeline stages.
