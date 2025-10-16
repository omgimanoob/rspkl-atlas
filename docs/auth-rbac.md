# RSPKL Atlas – Authentication & RBAC Overview

This document summarizes how user accounts, authentication, and role‑based access control (RBAC) currently work in the codebase.

Sources reviewed:
- `src/services/authService.ts`
- `src/controllers/authController.ts`
- `src/middleware/auth.ts`
- `src/index.ts`
- `src/services/audit.ts`
- `src/config.ts`

## Authentication Model

- Transport: Cookie‑based JWT.
  - Cookie name: `config.auth.cookieName` (default: `atlas_token`).
  - Flags: `HttpOnly; SameSite=Strict; Path=/; Max-Age={TTL}` and `Secure` in production.
  - TTL: `config.auth.tokenTtlSeconds` (default: 8 hours).
- JWT payload: `{ sub: string (user id), email: string, roles: string[] }`.
- JWT signing: `HS256` via `jsonwebtoken` using `config.auth.jwtSecret`.
- Passwords: `bcryptjs` with 12 rounds (see `createUser` and `verifyPassword`).
- Middleware:
  - `authMiddleware` parses cookies, verifies JWT, and attaches `req.user` as `{ id, email, roles }` when valid.
  - `requireRole(...allowed)` enforces RBAC; `admins` bypass role checks automatically. Returns `401` if unauthenticated, `403` if authenticated but unauthorized.
  - `requireAuth` helper exists but routes use `requireRole` directly.

## Data Model (Auth)

Created idempotently by `AuthService.ensureAuthSchema()` at startup:

- `users` — columns: `id`, `email` (unique), `password_hash`, `display_name`, `is_active`, timestamps.
- `roles` — columns: `id`, `name` (unique). Seeded values: `hr`, `management`, `directors`, `admins`.
- `user_roles` — mapping table with PK `(user_id, role_id)`.
- `audit_logs` — columns: `id`, `user_id`, `email`, `route`, `method`, `status_code`, `payload_hash`, `ip`, `created_at`.

### Admin Seeding

- If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, an admin user is auto‑created and assigned the `admins` role on boot. Display name is `ADMIN_DISPLAY_NAME` or "Administrator".

## Auth Endpoints & Flow

- `POST /auth/login` (public; rate‑limited):
  - Body: `{ email, password }`.
  - Looks up active user, verifies password, fetches roles, signs JWT, sets cookie, returns `{ email, roles }`.
  - Errors: `400` on missing fields, `401` on invalid credentials.
- `POST /auth/logout` (public):
  - Clears the auth cookie by setting `Max-Age=0`. Returns `{ ok: true }`.
- `GET /me` (requires valid cookie):
  - Returns `req.user` (`{ id, email, roles }`) or `401` if unauthenticated.

## RBAC Matrix (Selected Routes)

Admins always permitted via bypass in `requireRole`.

- `GET /projects` — roles: `hr`, `management`, `directors`.
- `GET /timesheets` — roles: `hr`, `management`, `directors`.
- `GET /bi/sunburst` — roles: `hr`, `management`, `directors`.
- `PUT /overrides/status` — roles: `hr`, `directors`.
- `PUT /overrides` — roles: `hr`, `directors`.
- `POST /sync/timesheets` — roles: `admins` only.
- `GET /healthz` — public.
- Static assets under `public/` — public.

Notes:
- `controllers/projectsController.updateProjectStatusHandler` exists but is not routed in `src/index.ts`. The routed status update uses `projectOverridesController.updateProjectStatusHandler`.

## Audit Logging

- `recordAudit(req, statusCode, payloadHash?)` writes to `audit_logs` with user identity (if present), route, method, `status_code`, payload hash, and IP.
- Currently used by:
  - `projectOverridesController.updateProjectStatusHandler`
  - `projectOverridesController.updateProjectOverridesHandler`
  - `syncController.syncTimesheetsHandler`
- Failures to write audits are non‑blocking and logged as warnings.

## Configuration

- `AUTH_JWT_SECRET` — JWT signing secret (use a strong value in production).
- `AUTH_COOKIE_NAME` — cookie name (default `atlas_token`).
- `AUTH_TOKEN_TTL_SECONDS` — JWT and cookie lifetime in seconds (default 8h).
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` — optional admin seeding.

## Security Characteristics

- HttpOnly cookies prevent client‑side JS access to the token.
- `SameSite=Strict` mitigates CSRF for cross‑site requests; when behind a different origin UI, leverage dev proxy or adjust as needed.
- `Secure` cookie flag is enabled in production.
- Rate limiting applied to `POST /auth/login` and write routes (e.g., overrides) to reduce brute force/abuse.

## Limitations / Considerations

- No refresh token/rotation; session lifetime equals JWT TTL.
- `/auth/logout` is public (acceptable; it only clears cookie).
- Only some write operations are audited; consider auditing login attempts and RBAC denials for better traceability.
- Ensure `AUTH_JWT_SECRET` is set in production; default is insecure.
- Role management endpoints are not exposed; roles must be assigned via DB or future admin UI.
