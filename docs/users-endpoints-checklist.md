# Users Endpoints Implementation Checklist

Actionable micro-tasks to implement minimal admin-only user management endpoints, modeled after `docs/rbac-implementation-checklist.md`.

## Phase 1 – Data Model & Service
- [x] Confirm `users` table exists with: `id`, `email` (UNIQUE), `password_hash`, `display_name`, `is_active`, timestamps.
- [x] Add `UsersService` with methods:
  - [x] `createUser({ email, password, displayName, isActive })` (hash password with bcrypt 12 rounds; enforce unique email).
  - [x] `getUserById(id)` (omit `password_hash`).
  - [x] `listUsers({ page, pageSize, search, active })` (pagination + optional filters).
  - [x] `updateUser(id, { displayName?, isActive?, password? })` (re-hash when password provided).
  - [x] `setActive(id, boolean)` convenience wrapper.
- [x] Map Drizzle entities to DTOs that never expose `password_hash`.

## Phase 2 – Validation & DTOs
- [x] Define request DTOs with validation:
  - [x] `email` required, proper format.
  - [x] `password` required on create (min length); optional on update.
  - [x] `display_name` optional string; `is_active` boolean.
- [x] Define response DTOs: `{ id, email, display_name, is_active, created_at, updated_at }`.
- [x] Normalize errors with clear messages and fields.

## Phase 3 – Controllers & Routes
- [x] Create `usersController.ts` with handlers:
  - [x] `POST /admin/users` — create user.
  - [x] `GET /admin/users` — list users (pagination + filters).
  - [x] `GET /admin/users/:id` — fetch user by id.
  - [x] `PUT /admin/users/:id` — update `display_name`, `is_active`, optional password.
  - [x] `POST /admin/users/:id/activate` — set `is_active=true`.
  - [x] `POST /admin/users/:id/deactivate` — set `is_active=false`.
  - [x] (Optional) `DELETE /admin/users/:id` — soft-delete or omit in MVP.
- [x] Register routes in `src/index.ts` under `/admin` prefix.

## Phase 4 – RBAC & Rate Limits
- [x] Protect all endpoints with `requirePermission('rbac:admin')`.
- [x] Apply rate limits to write endpoints (create/update/activate/deactivate/delete).

## Phase 5 – Persistence (Drizzle)
- [x] Implement Drizzle queries in `UsersService` (no inline SQL in controllers).
- [x] Ensure unique index on `users.email`; handle conflicts as `409 Conflict`.

## Phase 6 – Auditing & Metrics
- [x] Record audit entries for user creates, updates, activate/deactivate (route, method, status, actor, payload hash).
- [x] Increment `rbac.adminMutations` counter on all successful writes.

## Phase 7 – Serialization & Error Handling
- [x] Never return `password_hash` in any response.
- [x] Standardize error codes: `400` (validation), `401` (unauthenticated), `403` (forbidden), `404` (not found), `409` (conflict), `429` (rate limit).
- [x] Provide consistent error payloads: `{ error, reason, details? }`.

## Phase 8 – Testing
- [x] Unit tests (UsersService):
  - [x] `createUser` success and email conflict (409).
  - [x] `updateUser` updates fields and re-hashes password; no exposure of `password_hash`.
  - [x] `setActive` toggles state; idempotent.
- [x] Middleware tests:
  - [x] `requirePermission('rbac:admin')` → 401/403/200 paths.
- [x] Integration tests (HTTP via Supertest):
  - [x] `POST /admin/users` valid → 201; invalid → 400; duplicate → 409.
  - [x] `GET /admin/users` paginates, filters by `active`, search.
  - [x] `GET /admin/users/:id` found → 200; missing → 404.
  - [x] `PUT /admin/users/:id` updates display name/active; password update rotates hash.
  - [x] `POST /admin/users/:id/activate|deactivate` flips state.
  - [x] `DELETE /admin/users/:id` soft-deletes (sets is_active=false).
  - [x] All above enforce `rbac:admin`.
- [x] Test DB setup: apply migrations, seed an admin user/role; truncate between suites.

## Phase 9 – Documentation & Examples
- [x] README section summarizing endpoints, RBAC requirement, and typical responses.
- [x] cURL examples for create, list (with pagination), get-by-id, update, activate/deactivate.
- [x] Note security considerations: strong password policy, no password exposure, admin-only access.

## Phase 10 – User Self-Service (MVP)
- [x] Scope and goals
  - [x] Enable authenticated users to update their own profile and password.
  - [x] Provide password reset (forgot password) flow without revealing account existence.
- [ ] Endpoints (self-service)
  - [x] `GET /me` — ensure sanitized DTO `{ id, email, roles, display_name? }`.
  - [x] `PUT /me` — update `display_name` only.
  - [x] `POST /me/password` — change password with body `{ current_password, new_password }`.
  - [x] `POST /auth/password-reset/request` — body `{ email }`, idempotent 200, throttle.
  - [x] `POST /auth/password-reset/confirm` — body `{ token, new_password }`.
- [ ] RBAC & security
  - [x] Guard `/me` routes with authenticated user checks (401 if missing).
  - [x] Rate-limit password change and reset endpoints.
  - [x] Strong password policy (min length, complexity guidance).
  - [x] Do not leak account existence on reset request (always 200).
  - [x] Require `current_password` verification for `/me/password`.
- [ ] Persistence
  - [x] Add `password_reset_tokens` table: `{ id, user_id, token_hash, expires_at, used_at, created_at }`.
  - [x] Store hashed tokens (one-time use); TTL (e.g., 30 minutes).
  - [x] Invalidate token on confirm; mark used_at to prevent reuse.
- [ ] Services & controllers
- [x] `AuthService.requestPasswordReset(email, origin)` — create token if user exists; origin validated against allowlist.
  - [x] `AuthService.confirmPasswordReset(token, newPassword)` — validate + rotate password.
  - [x] `AuthService.changePassword(userId, current, next)` — verify current + rotate.
  - [x] `UsersService.updateSelf(userId, { displayName })` (via UsersService.updateUser).
– [x] Emails / delivery
  - [x] Dev: log reset link `${origin}${RESET_PATH}?token=...` to console or DB outbox.
  - [x] Prod: integrate mail provider via SMTP (nodemailer) and env-configured MAILER_URL/MAILER_FROM.
– [x] Auditing & metrics
  - [x] Audit successful password changes and reset confirmations (no sensitive payloads).
  - [x] Metrics counters for `auth.password_change.success|fail`, `auth.password_reset.request|confirm`.
- [ ] Validation
  - [x] Enforce min password length (e.g., 8) and deny weak inputs.
  - [x] Token format validation; deny malformed/expired/used tokens with 400.
- [ ] Error responses
  - [x] Standardize: 400 (invalid input/token), 401 (unauthenticated), 429 (rate limit).

## Testing Checklist (Self-Service MVP)

Unit Tests
- [x] AuthService.changePassword
  - [x] Success with correct current password rotates hash.
  - [x] Fails with wrong current password (400/invalid_current_password).
  - [x] Enforces password policy (weak/short → 400).
- [x] AuthService.requestPasswordReset
  - [x] Existing email → creates a reset token (hashed, with expiry).
  - [x] Non-existing email → no token created, returns OK (no enumeration).
- [x] AuthService.confirmPasswordReset
  - [x] Valid token → rotates password and invalidates token.
  - [x] Malformed/unknown token → 400.
  - [ ] Expired token → 400.
  - [x] Reuse of used token → 400.

Middleware
- [x] requireAuth guards `/me` and `/me/password`: unauthenticated → 401.
- [ ] Rate limiting applied to password-change and reset endpoints: hammering → 429.

Integration (HTTP)
- [x] GET `/me` with cookie → 200 sanitized DTO; without cookie → 401.
- [x] PUT `/me` updates `display_name` only; other fields ignored.
- [x] POST `/me/password`:
  - [x] Success with valid current/new password.
  - [x] Wrong current → 400; weak new → 400; rate limit → 429 when abused.
- [x] POST `/auth/password-reset/request`:
  - [x] Returns 200 for existing and non-existing emails; response indistinguishable.
  - [ ] Rate limit enforced on repeated requests.
- [x] POST `/auth/password-reset/confirm`:
  - [x] With valid token → 200; subsequent login works with new password.
  - [x] Reusing token → 400; expired token → 400; malformed token → 400.

Auditing & Metrics
- [ ] Audit rows for password change and reset confirmation (no sensitive payloads).
- [ ] Metrics counters increment for `auth.password_change.*` and `auth.password_reset.*`.

---

## Testing Checklist (Users Endpoints Implemented)

Database & Seeds
- [x] Migrations apply cleanly; `users.email` has a UNIQUE index.
- [x] Seed script can create an initial admin (optional; aligns with existing admin seeding).

UsersService
- [x] `createUser` inserts user with hashed password; rejects duplicate email.
- [x] `getUserById` returns sanitized fields only.
- [x] `listUsers` supports `page`, `pageSize`, `active`, and `search`.
- [x] `updateUser` persists changes; password update re-hashes.
- [x] `setActive` toggles `is_active` and returns updated user.

Controllers / Routes
- [x] `POST /admin/users` returns 201 with sanitized payload.
- [x] `GET /admin/users` returns paginated list and metadata.
- [x] `GET /admin/users/:id` returns 404 for unknown id.
- [x] `PUT /admin/users/:id` returns 200 with updated fields.
- [x] `POST /admin/users/:id/activate|deactivate` return 200 and reflect new state.
- [x] Errors formatted consistently with reason codes.

Middleware & RBAC
- [x] All routes deny without JWT (401) and without `rbac:admin` (403).
- [x] Rate limiting active on write routes (429 on abuse in tests).

Integration (HTTP)
- [x] Admin cookie can access all endpoints.
- [x] Non-admin users receive 403 for all endpoints.
- [x] Duplicate email returns 409; invalid email/password returns 400.

Edge Cases
- [x] Email case-insensitive uniqueness enforced (normalize on create/update).
- [x] Empty password on update rejected unless explicitly allowed by policy.
- [x] `is_active` non-boolean rejected with 400.
- [x] Large pagination params clamped to sane limits.

Notes
- Consider exporting `app` from `src/index.ts` to enable Supertest without binding a port.
- RBAC flags and observability can follow `docs/rbac-flags.md` if decision logging is desired during testing.
