# Atlas Overrides – `overrides_projects` Data Model

Purpose: One of Atlas’ core goals is to fill gaps in data that Kimai does not provide. Today, identified missing fields include:
- `project.money_collected`
- `project.status`
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
- `status` varchar(32) null — denormalized snapshot of the status name (derived from lookup)
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
- index on (`status`)
- index on (`is_prospective`)

Notes
- Use null to mean “no override” for a field; downstream merge logic should only apply non‑null values.
- Keep human‑readable `updated_by_email` alongside `updated_by_user_id` to aid operations.
 - Prospective Projects: support rows with `kimai_project_id` = null; once a real Kimai project is created, a background or admin action can assign the `kimai_project_id` to link and continue using the same override row.

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
  status: varchar('status', { length: 32 }),
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
  ixStatus: index('ix_overrides_projects_status').on(t.status),
  ixProspective: index('ix_overrides_projects_prospective').on(t.isProspective),
}));
```

## Merge Semantics
- Read path: Fetch Kimai project, then overlay any non‑null values from `overrides_projects`.
  - Example: if `money_collected` is non‑null in overrides, return that; else return Kimai’s value (if any) or null.
- Write path: Mutations only touch `overrides_projects`; never write to Kimai.
- Null clearing: Setting a field to null removes the override and restores upstream behavior.

## API Usage (Current)
- `PUT /overrides/status` — update `status` and/or `is_prospective` for a project
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
- Start with `status` as a varchar and validate against this allowlist in the API/UI.
- Consider a dedicated lookup table if/when needed:
  - Table `project_statuses(id, name, code, is_active, sort_order, created_at, updated_at)`
  - Reference via `status_id` (nullable) in `overrides_projects`; keep `status` text as a denormalized snapshot for readability/migration ease during transition.
  - Expose statuses via an admin endpoint to manage the list.

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
  "status": "active",
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
