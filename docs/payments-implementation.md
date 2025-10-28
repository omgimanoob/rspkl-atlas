# Payments Implementation – Design & Plan

This document describes how Atlas models and ingests project payments and how it powers the cached `money_collected` value used in operational views and overrides.

## Goals & Scope
- Model payments received against projects with clear provenance (source + reference).
- Support multiple sources (e.g., accounting system API, CSV uploads).
- Provide a trusted rollup per project and a cached value for quick reads.
- Preserve auditability and idempotency; never lose financial trail.
- Keep Kimai untouched; payments live in the Atlas DB.

Out of scope (initial): invoicing workflow, currency conversion across multi‑currency ledgers (see Future Work).

## Data Model (Atlas DB)

Tables
- `payment_sources`
  - `id` (PK), `code` (unique), `name`, `description`, `is_active`, timestamps
- `payments`
  - `id` (PK)
  - `source_id` (FK → payment_sources.id)
  - `source_ref` (unique within source; e.g., external payment id, invoice# + line)
  - `kimai_project_id` (nullable, bigint unsigned)
  - `override_project_id` (nullable, bigint unsigned) — for Prospective Projects
  - `amount_minor` (bigint) — amount in minor units (e.g., cents)
  - `currency` (char(3), ISO 4217)
  - `received_at` (timestamp) — when funds were recorded
  - `notes` (varchar 512), `meta_json` (json) — optional metadata from source
  - `created_at`, `updated_at`
  - Indexes on (kimai_project_id), (override_project_id), (source_id, source_ref)
- `project_payments_rollup`
  - `id` (PK)
  - `kimai_project_id` (nullable)
  - `override_project_id` (nullable)
  - `currency` (char(3))
  - `amount_minor` (bigint) — summed from `payments` for the tuple
  - `as_of` (timestamp) — snapshot time of the rollup
  - Unique on (kimai_project_id, override_project_id, currency)

Notes
- Exactly one of `kimai_project_id` or `override_project_id` should be present per row.
- Keep `amount` in minor units to avoid floating‑point errors.
- If multiple currencies are needed per project, keep separate rollup rows per currency; choose a display currency per project in UI.

## Drizzle Schema (Skeleton)
```ts
import { mysqlTable, int, bigint, varchar, char, timestamp, json, uniqueIndex, index } from 'drizzle-orm/mysql-core';

export const paymentSources = mysqlTable('payment_sources', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  isActive: int('is_active').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({ uxCode: uniqueIndex('ux_payment_sources_code').on(t.code) }));

export const payments = mysqlTable('payments', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  sourceId: int('source_id').notNull(),
  sourceRef: varchar('source_ref', { length: 128 }).notNull(),
  kimaiProjectId: bigint('kimai_project_id', { mode: 'number', unsigned: true }),
  overrideProjectId: bigint('override_project_id', { mode: 'number', unsigned: true }),
  amountMinor: bigint('amount_minor', { mode: 'number', unsigned: true }).notNull(),
  currency: char('currency', { length: 3 }).notNull(),
  receivedAt: timestamp('received_at').notNull(),
  notes: varchar('notes', { length: 512 }),
  metaJson: json('meta_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  uxSourceRef: uniqueIndex('ux_payments_source_ref').on(t.sourceId, t.sourceRef),
  ixKimai: index('ix_payments_kimai').on(t.kimaiProjectId),
  ixOverride: index('ix_payments_override').on(t.overrideProjectId),
}));

export const projectPaymentsRollup = mysqlTable('project_payments_rollup', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  kimaiProjectId: bigint('kimai_project_id', { mode: 'number', unsigned: true }),
  overrideProjectId: bigint('override_project_id', { mode: 'number', unsigned: true }),
  currency: char('currency', { length: 3 }).notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number', unsigned: true }).notNull(),
  asOf: timestamp('as_of').notNull().defaultNow(),
}, (t) => ({
  uxProjectCurrency: uniqueIndex('ux_rollup_project_currency').on(t.kimaiProjectId, t.overrideProjectId, t.currency),
}));
```

## Ingestion & Idempotency

Sources
- Accounting API (preferred): poll or webhook for posted/paid receipts.
- CSV upload (admin): map columns to fields; store raw row in `meta_json` for traceability.

Idempotency
- Use `(source_id, source_ref)` as a unique business key.
- Upsert on conflict to avoid duplicates; update mutable fields (notes, received_at) if needed.

Linking to projects
- Primary: use `kimai_project_id` when known.
- For Prospective Projects, store `override_project_id` and optionally update to `kimai_project_id` when created.

## Rollup & `money_collected`

Rollup job (cron/task)
- Periodically recompute `project_payments_rollup` from `payments`.
- Optionally update `project_overrides.money_collected` with the rolled‑up display amount (converted from minor units).
- Respect manual overrides: if `project_overrides.money_collected` is non‑null and a policy flag is set, preserve manual value and expose both numbers in UI for reconciliation.

Policy flags (config)
- `PAYMENTS_UPDATE_OVERRIDES` (default: false) — when true, write rolled‑up amount to `project_overrides.money_collected` if it is null.
- `PAYMENTS_DISPLAY_CURRENCY` — default currency for display when multiple currencies exist.

## API Endpoints (Admin)
- `GET /admin/payments?s=source&project=kimaiId|overrideId` — list payments filtered by project or source.
- `POST /admin/payments/import/csv` — upload CSV and ingest (validates + idempotent upsert).
- `POST /admin/payments/recompute` — trigger rollup (optional, feature‑flagged).

Permissions
- Guard with `rbac:admin` (later: split into `payments:read`, `payments:ingest`, `payments:recompute`).

## Observability & Auditing
- Metrics
  - `payments.ingested.success|fail`
  - `payments.rollup.updated`
- Audit logs for CSV imports and admin recompute actions.
- Reconciliation report endpoint (future): differences between rolled‑up sums and overrides’ manual values.

## Testing Plan
- Unit: parsing + idempotent upsert, minor‑unit conversions, project linking fallback.
- Integration: CSV import happy/invalid rows, rollup recomputation, permission enforcement.
- Edge cases: duplicate source_ref, currency mismatch, switching from override→kimai linking.

## Env & Config
- `PAYMENTS_SOURCE` (optional default source code for ad‑hoc ingests).
- `PAYMENTS_UPDATE_OVERRIDES` (true|false) — see above.
- `PAYMENTS_DISPLAY_CURRENCY=USD` — default display currency.

## Future Work
- Multi‑currency normalization with FX rates and reporting currency.
- Webhooks for real‑time updates from accounting systems.
- UI for payment browsing, reconciliation, and override resolution.

