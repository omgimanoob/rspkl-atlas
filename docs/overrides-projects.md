# Atlas Overrides – `overrides_projects` Data Model

Purpose: One of Atlas’ core goals is to fill gaps in data that Kimai does not provide. Today, identified missing fields include:
- `project.money_collected`
- `project.status_id`
- `project.is_prospective`

The list will likely grow; this model is designed to be additive and non‑disruptive.

Secondary goal: Allow users to add Prospective Projects that do not yet exist in Kimai. These projects should be representable in Atlas without a Kimai record and later linkable once a Kimai project is created.

## Design Goals
- Non‑destructive: Never modify Kimai data; layer overrides on top.
- Minimal coupling: Do not require cross‑DB foreign keys to Kimai.
- Explicit precedence: When an override is present (non‑null), it wins; null means “no override”.
- Traceable: Track who changed what and when; audit in existing logs.
- Extensible: Leave room for new fields without schema churn.

## Table Schema (Proposed)

Physical table: `overrides_projects` (in Atlas DB)

Columns
- `id` bigint unsigned PK auto‑increment
- `kimai_project_id` bigint unsigned null — Kimai project identifier (no FK across DBs); null allowed for Prospective Projects not in Kimai yet
- `money_collected` decimal(12,2) null — cached/denormalized sum of confirmed payments received for the project; can be manually overridden here
- `status_id` int null — FK to `project_statuses.id`
 - `status_id` int null — FK to `project_statuses.id`; the UI resolves a name for display
- `is_prospective` tinyint(1) null — 1/0 for boolean override
- `notes` varchar(1024) null — optional operator notes for context
- `source` varchar(64) null — e.g., `manual`, `import:csv`, `api`
- `updated_by_user_id` bigint unsigned null — Atlas user id who last mutated
- `updated_by_email` varchar(255) null — redundancy for audit clarity
- `created_at` timestamp not null default now()
- `updated_at` timestamp not null default now() on update current_timestamp
- `extras_json` json null — flexible bag for future fields (see Extensibility)

Indexes
- unique index on (`kimai_project_id`) where not null — one override row per Kimai project; Prospective Projects are identified by null `kimai_project_id`
- index on (`status_id`)
- index on (`is_prospective`)

Notes
- Use null to mean “no override” for a field; downstream merge logic should only apply non‑null values.
- Keep human‑readable `updated_by_email` alongside `updated_by_user_id` to aid operations.
 - Prospective Projects: support rows with `kimai_project_id` = null; once a real Kimai project is created, a background or admin action can assign the `kimai_project_id` to link and continue using the same override row.

Invariants
- Atlas‑native “Prospective” rows (where `kimai_project_id` IS NULL) must have `is_prospective = 1`.
- Kimai‑backed rows (where `kimai_project_id` IS NOT NULL) must have `is_prospective = 0`.

### `money_collected` semantics
- Treat `money_collected` as a cached/denormalized value derived from authoritative payment sources (e.g., accounting/AR system).
- If/when a payments feed is integrated, recompute and persist `money_collected` on a schedule or on change events.
- Manual edits in `overrides_projects` act as an explicit override; set to null to fall back to computed value.
- Do not rely on `money_collected` here as the source‑of‑truth for financial reporting; it is for operational views and filtering.

## Drizzle Schema (TypeScript Skeleton)
```ts
import {
  mysqlTable, bigint, varchar, tinyint, decimal, timestamp, json, uniqueIndex, index
} from 'drizzle-orm/mysql-core';

export const overridesProjects = mysqlTable('overrides_projects', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  kimaiProjectId: bigint('kimai_project_id', { mode: 'number', unsigned: true }).notNull(),
  moneyCollected: decimal('money_collected', { precision: 12, scale: 2 }),
  // status column removed; use status_id only
  isProspective: tinyint('is_prospective'),
  notes: varchar('notes', { length: 1024 }),
  source: varchar('source', { length: 64 }),
  updatedByUserId: bigint('updated_by_user_id', { mode: 'number', unsigned: true }),
  updatedByEmail: varchar('updated_by_email', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  extrasJson: json('extras_json'),
}, (t) => ({
  uxProject: uniqueIndex('ux_overrides_projects_kimai_project').on(t.kimaiProjectId),
  // ixStatus removed; use index on status_id if needed
  ixProspective: index('ix_overrides_projects_prospective').on(t.isProspective),
}));
```

## Merge Semantics
- Read path: Fetch Kimai project, then overlay any non‑null values from `overrides_projects`.
  - Example: if `money_collected` is non‑null in overrides, return that; else return Kimai’s value (if any) or null.
- Write path: Mutations only touch `overrides_projects`; never write to Kimai.
- Null clearing: Setting a field to null removes the override and restores upstream behavior.

## API Usage (Current)
- `PUT /overrides/status` — update `status_id` (and/or `is_prospective`) for a project
  - Resource extractor uses `body.id` or `body.kimai_project_id`
  - Permission: `overrides:update` (project‑scoped)
  - Input: requires `status_id` referencing `project_statuses.id`
- `PUT /overrides` — upsert multiple override fields, including `money_collected`
  - Same resource extraction and permissioning
  - Input: supports `status_id`; raw `status` input is rejected

Both endpoints should:
- Validate `kimai_project_id` (numeric)
- Accept partial payloads; only provided keys are updated
- Capture `updated_by_*` from `req.user` if present
- Record audit entry and update metrics

## Status Field Guidance
- Identified statuses (initial set):
  - Unassigned — projects not assigned any status
  - Schematic Design
  - Design Development
  - Tender
  - Under construction
  - Post construction
  - KIV
  - Others
- We use a dedicated lookup table:
  - Table `project_statuses(id, name, code, is_active, sort_order, created_at, updated_at)`
  - Reference via `status_id` (nullable) in `overrides_projects`; the UI resolves the name for display.
  - Expose statuses via an admin endpoint to manage the list.

## UI Integration Plan — Create Prospective from Projects Page

Goal: From the Projects page, allow permitted users to create an Atlas‑native “Prospective Project” that does not yet exist in Kimai, then (later) link it once the Kimai project is created.

Phases
- Phase 1: Creation from UI
  - Backend:
    - Add a non‑admin read endpoint for statuses used by the UI:
      - `GET /statuses` — permission `project:read` (read‑only copy of admin list).
    - Add a dedicated creation endpoint (permission‑gated) for Atlas‑native rows:
      - `POST /prospective` — permission `prospective:create` (no resource scope; creates `overrides_projects` row with `kimai_project_id=NULL`, `status_id?`, `notes?`, and `extras_json.name`).
      - Validation: reject non‑null/true `is_prospective`; enforce that `is_prospective` is stored as `0` on these rows.
    - Keep existing admin endpoints under `/admin/prospective` for ops tooling.
  - Client (Projects page):
    - Add “New Prospective Project” button (visible for roles `hr|directors|admins` initially; later gate by effective permission when available).
    - Dialog fields: `Name` (required), `Status` (optional; dropdown from `GET /statuses`), `Notes` (optional, 1–2 lines).
    - Call `POST /prospective` with `{ name, status_id?, notes? }`.
    - Success toast with hint to link once the Kimai project exists.
- Phase 2: Listing and Linking (optional for initial release)
  - Backend:
    - Option A: Extend `GET /projects` to include Atlas‑native rows with a minimal shape (id in override space, name from `extras_json`, null Kimai fields), flagged as `origin: 'atlas'`.
    - Option B (simpler): Add `GET /prospective` to list Atlas‑native rows separately; UI shows a “Prospective” tab on Projects page.
    - Add `POST /prospective/:id/link` to assign `kimai_project_id` once known; permission `prospective:link` or reuse `rbac:admin` for now.
      - Validate the target exists in Kimai before linking: query `kimai2_projects` (or Kimai API) and return `400 { reason: 'unknown_kimai_project' }` if missing.
      - Reject conflicts: `409 { reason: 'override_exists_for_project' }` when another overrides row already references the same Kimai id.
    - Optional orchestration for authorized operators: `POST /prospective/:id/kimai-create-link`
      - Permission: `kimai:project:create`.
      - Steps: (1) Create project in Kimai with the provided name/customer, (2) verify/poll until the new project id is available, (3) link the Prospective row (set `kimai_project_id`, force `is_prospective = 0`), (4) return the linked id.
      - Failure policy: if Kimai create fails or verification times out, do not mutate the Atlas row; return an error payload with reason.
  - Client:
    - Display prospective rows either inline (with a “Draft/Prospective” badge) or under a separate tab.
    - Provide “Link to Kimai Project” action when the external id is known.

Permissions
- Introduce `prospective:create` (unscoped write) for creation endpoint.
- Optionally `prospective:read` (for `GET /prospective`) and `prospective:link` for linking action.
- Keep `overrides:update` for per‑project field updates on existing Kimai projects.
 - Introduce `kimai:project:create` for automated creation in Kimai (restricted).

Validation & Auditing
- On create/link, record audit entries with actor identity and payload hash.
- Validate `status_id` exists and is active.
- Enforce name length and notes length (e.g., 1–128 and ≤ 1024 chars).
 - On link, first validate that `kimai_project_id` exists in Kimai; reject otherwise to avoid orphan references.

Out‑of‑Scope (Phase 1)
- No attempt to create or modify Kimai projects.
- No automatic materialization into analytics until the list view is defined.

## Project Types and Origin

Atlas distinguishes two project types, surfaced together in the Projects list when requested:
- Kimai projects (origin: `kimai`)
  - Source-of-truth lives in Kimai; Atlas reads and overlays non-destructive overrides (status_id, money_collected, is_prospective).
  - Edit action in UI updates overrides only; Kimai data remains read-only.
  - `id` is the Kimai project id (positive integer).
- Atlas-native Prospective projects (origin: `atlas`)
  - Created in Atlas (`overrides_projects` with `kimai_project_id=NULL`).
  - `is_prospective` is always `1` for Atlas-native rows.
  - Appear in mixed list when `includeProspective=1` is passed to `GET /projects`.
  - UI treats them as read-only in the main grid; a dedicated Prospective view can provide edit/link actions.
  - `id` is a negative virtual id derived from the override row id: `-overrides_projects.id` (prevents collision with Kimai ids).

Notes
- The mixed `/projects` payload includes an `origin` field to distinguish types.
- When a Prospective row is linked to a real Kimai project, it will later surface as `origin:'kimai'` after sync and the Prospective entry should be hidden from Prospective listings.

## Extensibility Strategy
- For new missing data (e.g., `project.customerPo`, `project.stage`, `project.renewalDate`), prefer adding typed columns when widely used.
- For rare/experimental fields, use `extras_json` with a stable key name; promote to a column if it becomes core.

## Auditing & Ownership
- All write endpoints should call the existing `recordAudit` helper and include actor and route.
- Consider a lightweight change log (separate table) if field‑level diffs are required later.

## Example Row
```json
{
  "kimai_project_id": 12345,
  "money_collected": 125000.00,
  "status_id": 1234,
  "is_prospective": 0,
  "notes": "PO received Q1",
  "source": "manual",
  "updated_by_user_id": 101,
  "updated_by_email": "analyst@example.com",
  "updated_at": "2025-01-15T10:20:30Z"
}
```

## Migration Outline
- Create table + unique index on `kimai_project_id`
- Backfill from any existing ad‑hoc storage (if present)
- Wire endpoints and services to read/write this table only

## Open Questions
- Money currency: If multi‑currency appears, add `money_currency` (ISO 4217) and store amounts in minor units or decimal with currency.
- Ownership: Who maintains status values across teams? Consider role‑based permissions for writing specific fields.
- BI impact: If BI uses overrides, document the precedence in analytics transformations.
