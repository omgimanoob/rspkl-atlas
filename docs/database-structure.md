# Database Structure – Atlas and Kimai

This document summarizes the databases used by Atlas, their connection settings, and the key tables relevant to the application.

## Databases

- Atlas DB (application data)
  - Env: `ATLAS_DB_HOST`, `ATLAS_DB_USER`, `ATLAS_DB_PASSWORD`, `ATLAS_DB_DATABASE`, `ATLAS_DB_PORT`
  - Used for: auth, RBAC, overrides, audit logs, payments, taxonomy tags
- Kimai DB (source system)
  - Env: `KIMAI_DB_HOST`, `KIMAI_DB_USER`, `KIMAI_DB_PASSWORD`, `KIMAI_DB_DATABASE`, `KIMAI_DB_PORT`
  - Used for: reading projects/timesheets/customers; treated as read-only by Atlas

Utilities
- Connectivity check: `npm run kimai:check` (runs a basic query and counts `kimai2_projects`)
- Migrations (Atlas DB): `npm run db:migrate`
- Seeds (Atlas DB): `npm run db:seed`

## Atlas DB – Core Tables

Auth & RBAC
- `users` — local user identities (email, password_hash, display_name, is_active, timestamps)
- `roles`, `permissions` — RBAC catalogs
- `user_roles`, `role_permissions`, `user_permissions` — mappings and direct grants
- `permission_grants` — scoped permission grants (e.g., per-project overrides)
- `audit_logs` — request-level audits (who/route/method/status/ip)
- `rbac_audit_logs` — RBAC decision/mutation logs (allow/deny/mutate/reason)

Overrides & Projects
- `overrides_projects` — overlay fields missing from Kimai: `money_collected` (cached), `status`, `is_prospective`, notes, source, updated_by, timestamps, extras JSON
  - Design and schema: see `docs/overrides-projects.md`

Taxonomy & Tags
- `taxonomies` — tag groups (e.g., Discipline, Region)
- `taxonomy_terms` — terms per taxonomy (e.g., Architecture, APAC)
- `project_tags` — assignment of terms to Kimai projects or Prospective Projects
  - Design and schema: see `docs/taxonomy-tags.md`

Payments (optional/planned)
- `payment_sources` — catalog of external payment sources
- `payments` — individual payment entries (source_ref, amount_minor, currency, received_at, project link)
- `project_payments_rollup` — cached per-project totals (by currency)
  - Design and schema: see `docs/payments-implementation.md`

## Kimai DB – Referenced Tables (read-only)

- `kimai2_projects` — projects (reference: `docs/kimai2_projects-schema.md`)
- `kimai2_timesheet` — timesheets (not fully documented here; used via services)
- `kimai2_customers` — customers (not fully documented here; used via services)

Notes
- Atlas never writes to the Kimai DB; it reads and enriches data via overlays in Atlas DB.
- When Prospective Projects are added in Atlas, they exist without a Kimai id and can be linked later.

## Environment & Links

- App base URL for links in emails: `APP_BASE_URL`; reset path: `RESET_PATH`
- Email service: `MAILER_FROM`, `MAILER_FROM_NAME`, `MAILER_URL`, `DEVELOPER_EMAIL`
- RBAC flags and metrics: see `docs/rbac-flags.md`

## References
- Drizzle setup and schema code snippets: `docs/drizzle-setup.md`
- Overrides model: `docs/overrides-projects.md`
- Taxonomy/Tags: `docs/taxonomy-tags.md`
- Payments design: `docs/payments-implementation.md`
- Kimai projects schema: `docs/kimai2_projects-schema.md`
 - Kimai timesheet schema: `docs/kimai2_timesheet-schema.md`
 - Kimai sync plan: `docs/kimai-sync.md`

## Views (Analytics)
- `vw_projects` — replica projects + overrides (status, is_prospective, money_collected cached)
- `vw_timesheet_facts` — replica timesheets + users/activities/projects + aggregated timesheet tags
