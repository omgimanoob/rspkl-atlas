# Admin UI Checklist — Users, Roles, Permissions, Grants

Scope: Build an admin console for managing users and RBAC (roles, permissions, grants) using the existing API.

## Phase 1 — Navigation & Access
- [x] Add Admin section in sidebar (visible only for admins).
- [x] Route: `/console/users` (UI) — Admin Users screen.
- [x] Routes: `/console/roles`, `/console/permissions`, `/console/grants` — placeholders added.
- [x] Guard routes client‑side (admin‑only UI sections hidden when not admin); Forbidden route shown when accessing directly.

## Phase 2 — Users Management
- [x] List users table with search, pagination.
  - API: `GET /admin/users?search=&page=&pageSize=`
  - Columns: email, display_name, is_active, created_at, updated_at.
- [x] Create user modal (email, password, display_name, is_active).
  - API: `POST /admin/users`
- [x] Edit user dialog (display_name, is_active) with self‑deactivation block.
  - API: `PUT /admin/users/:id`
- [x] Activate/Deactivate via checkbox in Active column; disabled for current user.
  - API: `PUT /admin/users/:id` (is_active)
- [x] Show user roles inline in the table using display names.
- [ ] Soft delete (deactivate) action if needed.
  - API: `DELETE /admin/users/:id`
- [x] Error handling & toasts.

## Phase 3 — Roles
- [x] List roles.
  - API: `GET /admin/rbac/roles`
- [x] Create role.
  - API: `POST /admin/rbac/roles` body `{ code, name }`
- [x] Delete role.
  - API: `DELETE /admin/rbac/roles/:id`
- [x] Show and manage a role’s permissions inline.
  - UI: per-role row renders all permissions as inline checkboxes; toggling attaches/detaches via API. Scrollable area with pending/disabled state while updating.
  - UI: shows role Name (human) and Code (machine).

## Phase 4 — Permissions
- [x] List permissions.
  - API: `GET /admin/rbac/permissions`
- [x] Create permission.
  - API: `POST /admin/rbac/permissions` body `{ name }`
- [x] Delete permission.
  - API: `DELETE /admin/rbac/permissions/:id`
- [ ] Naming guidance (see docs/rbac-permission-conventions.md).

## Phase 5 — Role ↔ Permission Mapping
- [x] Attach/detach permissions to a role via inline checkboxes on the Roles page.
  - API: `POST /admin/rbac/roles/:id/permissions/:perm`
  - API: `DELETE /admin/rbac/roles/:id/permissions/:perm`
- [ ] Optional: add search/filter for permissions when the list is large.
- [x] Reflect assigned permissions per role (uses `GET /admin/rbac/roles/:id/permissions`).

## Phase 6 — User ↔ Role Assignment
- [x] Assign/remove roles to/from a user via checkboxes with human‑friendly names; sends role codes to API.
  - API: `POST /admin/rbac/users/:id/roles/:role` (role is the code)
  - API: `DELETE /admin/rbac/users/:id/roles/:role`
- [x] Show user’s roles with display names; effective permissions summary pending.
- [x] Inline controls in user detail drawer/panel.

## Phase 7 — Scoped Grants (Resource‑level)
- [x] List grants.
  - API: `GET /admin/rbac/grants`
- [x] Create grant (subject type: role/user; subject id; permission; resource type/id; optional expiry) with dryRun validation.
  - API: `POST /admin/rbac/grants` (supports `?dryRun=1`)
- [x] Delete grant.
  - API: `DELETE /admin/rbac/grants/:id`
- [x] UI: compact form with validation.

## Phase 8 — UX & Productivity
- [x] Table features: column visibility + persisted preferences (localStorage) and client-side sorting. Persisted sort (key + dir) in localStorage. Server-side sort params included in requests (backend support pending).
- [ ] Bulk actions: activate/deactivate users; add/remove role permissions.
- [ ] Confirmations for destructive actions; undo toasts where safe.
- [ ] Inline toasts + ARIA live announcements for success/failure.
- [ ] Copyable cURL snippets for complex operations (optional).

## Phase 9 — Validation & Policies
- [ ] Client‑side password policy aligned with server (upper+lower+number+symbol, min length 8).
- [ ] Prevent deleting roles/permissions in use (guard via API error; show friendly message).
- [ ] Normalize inputs (trim names; lower‑case emails).

## Phase 10 — API Integration & Error Handling
- [x] Centralized admin API client (users, roles, permissions, grants).
- [ ] Map `{ error, reason }` to inline messages; toast for generic failures.
- [x] 401 handler reuses global session expiry logic; route back to Login.
- [ ] Show 429 rate‑limit notices where applicable.

## Phase 11 — Accessibility
- [ ] Focus management on modals/drawers; return focus to trigger on close.
- [ ] Visible focus rings on table actions and form controls.
- [ ] Labels/aria‑describedby for all inputs; role=alert/status for messages.
- [ ] Keyboard support: full CRUD without mouse.

## Phase 12 — Testing
- [ ] Manual QA scenarios:
  - Create/edit/activate/deactivate user.
  - Create/delete role; attach/detach permissions.
  - Assign/remove roles to user.
  - Create/delete grants; verify scoped access downstream.
- [ ] Edge cases:
  - Duplicate role/permission names → API conflict → show inline error.
  - Deleting entities in use → blocked with friendly message.
  - Rate‑limit responses on write bursts.

## Phase 13 — Observability & Docs
- [ ] Link to `/metrics` for quick health.
- [ ] Show audit log count for last N admin actions (optional).
- [ ] Add Admin UI section to README with routes and screenshots.

References
- Backend endpoints documented in [README.md](../../README.md) and [docs/quick-sanity-tests.md](../../docs/quick-sanity-tests.md)
- RBAC docs: docs/rbac-implementation-plan.md, docs/rbac-permission-conventions.md
