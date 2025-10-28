# Project Taxonomy & Tagging

Enable tagging projects with a controlled taxonomy so users can categorize and filter projects beyond what Kimai provides. Tags support both Kimai-backed projects and Prospective Projects (those not yet in Kimai).

## Goals
- Flexible categorization: multiple tags per project.
- Controlled taxonomy: centrally managed sets (e.g., "Discipline", "Region", "Vertical").
- Works for Prospective Projects: tags attach even when there is no Kimai record yet.
- Simple, additive model: does not modify Kimai; tags live in Atlas DB.

## Data Model (Atlas DB)

Tables
- `taxonomies`
  - `id` (PK), `name` (unique), `code` (unique, short), `description`, `is_active`, `sort_order`, timestamps
- `taxonomy_terms`
  - `id` (PK), `taxonomy_id` (FK → taxonomies.id), `name`, `code` (unique within taxonomy), `description`, `is_active`, `sort_order`, timestamps
- `project_tags`
  - `id` (PK)
  - `taxonomy_term_id` (FK → taxonomy_terms.id)
  - `kimai_project_id` (nullable, bigint unsigned)
  - `override_project_id` (nullable, bigint unsigned) — FK → project_overrides.id
  - timestamps
  - Unique constraints to prevent duplicates:
    - Unique (taxonomy_term_id, kimai_project_id) when kimai_project_id is not null
    - Unique (taxonomy_term_id, override_project_id) when override_project_id is not null

Notes
- Exactly one of `kimai_project_id` or `override_project_id` should be present.
- For Prospective Projects, use `override_project_id` to tag before a Kimai project exists. When the Kimai project is created, you can either:
  - Update the row to set `kimai_project_id` and clear `override_project_id`, or
  - Keep tags on overrides row and resolve in a view; preferred is to relink to Kimai for consistency.

## Drizzle Schema (Skeleton)
```ts
import { mysqlTable, int, varchar, tinyint, bigint, timestamp, uniqueIndex, index } from 'drizzle-orm/mysql-core';

export const taxonomies = mysqlTable('taxonomies', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 64 }).notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  description: varchar('description', { length: 255 }),
  isActive: tinyint('is_active').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  uxName: uniqueIndex('ux_taxonomies_name').on(t.name),
  uxCode: uniqueIndex('ux_taxonomies_code').on(t.code),
}));

export const taxonomyTerms = mysqlTable('taxonomy_terms', {
  id: int('id').primaryKey().autoincrement(),
  taxonomyId: int('taxonomy_id').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  description: varchar('description', { length: 255 }),
  isActive: tinyint('is_active').notNull().default(1),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  uxTaxCode: uniqueIndex('ux_terms_tax_code').on(t.taxonomyId, t.code),
  ixTax: index('ix_terms_tax').on(t.taxonomyId),
}));

export const projectTags = mysqlTable('project_tags', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  taxonomyTermId: int('taxonomy_term_id').notNull(),
  kimaiProjectId: bigint('kimai_project_id', { mode: 'number', unsigned: true }),
  overrideProjectId: bigint('override_project_id', { mode: 'number', unsigned: true }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => ({
  ixTerm: index('ix_project_tags_term').on(t.taxonomyTermId),
  ixKimai: index('ix_project_tags_kimai').on(t.kimaiProjectId),
  ixOverride: index('ix_project_tags_override').on(t.overrideProjectId),
}));
```

## API (Admin + Assignment)

Protected with `rbac:admin`:
- Taxonomy CRUD
  - `GET/POST/DELETE /admin/taxonomies`
  - `GET/POST/DELETE /admin/taxonomies/:id/terms`
- Assignment
  - `POST/DELETE /admin/projects/:kimaiId/tags/:termId` — assign/unassign by Kimai id
  - `POST/DELETE /admin/prospective/:overrideId/tags/:termId` — assign/unassign for Prospective Projects

Public (read):
- `GET /projects/:kimaiId/tags` — list tags for a Kimai project (respect RBAC on project reads)
- `GET /prospective/:overrideId/tags` — list tags for Prospective

Notes
- For listing, you may also support `GET /projects?tags=termCode1,termCode2` to filter projects by tags (intersection).

## UI/UX Considerations
- Multi-select controls with autocomplete by taxonomy.
- Show tags as chips on project detail and listings.
- Allow filtering by one or more tags; optionally grouped by taxonomy.

## RBAC & Auditing
- Writes guarded by `rbac:admin` initially. Later, introduce finer permissions like `project:tags:update`.
- Audit tag mutations via existing audit logs and `rbac_audit_logs`.

## BI Integration
- Expose a view or join that adds tags to project facts for analytics.
- When Prospective Projects are later linked to Kimai, migrate tags accordingly to avoid duplication.

## Migration Outline
- Create the three tables and indexes.
- Seed example taxonomies/terms (e.g., Discipline: Architecture, MEP; Region: APAC, EMEA).
- Build admin CRUD + assignment endpoints.
- Integrate tags into project listing filters.
