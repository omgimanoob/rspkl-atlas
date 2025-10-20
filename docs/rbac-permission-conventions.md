# RBAC Permission Naming Conventions

This document defines conventions for naming permissions, scoping rules, and contribution guidelines to keep RBAC consistent and predictable.

## Naming format
- Use lowercase, colon-separated tokens: `resource:action[:qualifier]`
  - Examples: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`, `sync:execute`, `rbac:admin`
  - Optional qualifier for finer control: `overrides:update:status`, `overrides:update:money_collected`
- Keep resource and action clear and concise. Prefer nouns for resources and verbs for actions.

## Granularity
- Start coarse and split by need:
  - Begin with `overrides:update` for all fields.
  - If necessary, split into field-specific permissions (e.g., `overrides:update:status`).
- Avoid prematurely adding qualifiers unless there’s a concrete requirement.

## Wildcards
- `*` grants all permissions. Reserved for `admins` or emergency/break-glass roles only.
- Do not assign `*` to standard roles. Prefer explicit role→permission mappings.

## Scoping
- Use scoped grants in `permission_grants` when access must be limited:
  - `resource_type`: only allowed values are listed in the registry (currently: `project`).
  - `resource_id`: normalized per type (for `project`, a numeric identifier, e.g., `kimai_project_id`).
- Scoping is enforced by `PermissionsService.hasPermission` when `resource_type` and `resource_id` are provided to the permission middleware.

## Role mapping
- Map roles to permissions via `role_permissions`.
- Role intent examples:
  - `hr`: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`
  - `management`: `project:read`, `timesheet:read`, `bi:read`
  - `directors`: `project:read`, `timesheet:read`, `bi:read`, `overrides:update`
  - `admins`: `*`

Note on role identifiers
- Roles have a stable `code` (machine identifier used in JWT and APIs) and a human‑friendly `name` for display. Keep codes lowercase and descriptive (e.g., `admins`, `hr`). Names can evolve without breaking API contracts.

## Patterns to avoid
- Overlapping synonyms (e.g., `project:view` and `project:read` in parallel). Pick one and stick to it.
- Long chains of qualifiers. Consider a new permission if complexity grows beyond two colons.

## Versioning & deprecation
- Prefer additive changes. Deprecate old permissions only after updating all checks and role mappings.
- Keep seed scripts in sync with additions/splits.

## Testing
- Add tests when introducing new permissions:
  - Unit: `PermissionsService` allow/deny logic (global and scoped).
  - Integration: route access with/without the new permission.

## Contribution checklist
- Permission name follows `resource:action[:qualifier]`.
- Update role→permission mappings where appropriate.
- Update seed script and run idempotency checks.
- Add or update tests (unit + integration).
- Update documentation and, if needed, the route guard test allowlist.
