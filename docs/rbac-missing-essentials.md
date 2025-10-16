# Missing RBAC Essentials

- Centralized role/permission model
  - Define explicit permissions (e.g., `project:read`, `overrides:update`) instead of route-level role arrays.
  - Map roles → permissions; avoid hardcoding roles per route.
  - Support role hierarchies or inheritance (e.g., `directors` ⊃ `management` ⊃ `hr`).

- Resource-level scoping
  - Enforce permissions at resource scope (per project/customer/user), not just per route.
  
- Persistence & ORM (Decision: Drizzle ORM)
  - Use Drizzle ORM + drizzle-kit with `mysql2` to model `users`, `roles`, `permissions`, `role_permissions`, `user_permissions`, and `permission_grants` with referential integrity.
  - Manage schema via Drizzle migrations and seeds; keep type-safe queries across services.
  - Replace raw SQL in RBAC paths with Drizzle repositories; keep BI-heavy queries on raw SQL initially if needed.
  - Conventions: schema in `src/db/schema.ts`, client in `src/db/client.ts`, migrations in `drizzle/`, config in `drizzle.config.ts`.

- Role/permission lifecycle APIs
  - Admin endpoints to create/delete roles, assign/revoke roles, and manage permissions.
  - Safe updates with validation, conflict detection, and dry-run.

- Policy engine and consistency
  - Central policy evaluation (PDP) used by all routes/services for consistent decisions.
  - Deny-by-default posture with explicit allow, and clear precedence rules (deny > allow).

- Least-privilege tightening
  - Remove broad “admins bypass” for all checks or scope it narrowly; allow override only where necessary and auditable.
  - Split coarse actions (e.g., overrides) into finer permissions per field/action.

- Comprehensive auditing of RBAC
  - Log all access denials (403) with actor, target resource, and policy reason.
  - Log role/permission assignments, changes, and elevations with who/when/why.

- Testing and coverage
  - Automated tests for RBAC decisions (unit + integration) across critical routes.
  - Route inventory to ensure every endpoint declares required permissions.

- Developer ergonomics
  - Shared middleware/helpers to declare required permissions succinctly.

- Observability
  - Metrics for RBAC denials, elevations, and privileged operations (alerts on anomalies).
  - Tracing tags to correlate RBAC decisions with requests.

- User model and lifecycle (currently absent)
  - Introduce a first-class `users` table/model with: `id`, `email` (unique), `password_hash`, `display_name`, `is_active`, timestamps.
  - Enforce uniqueness on `email`, and add indexes for frequent lookups.
  - Provide lifecycle operations: create/activate/deactivate, password reset/rotation, and soft-delete or archival policy.
  - Expose minimal admin endpoints for user management or seed via migrations initially.
