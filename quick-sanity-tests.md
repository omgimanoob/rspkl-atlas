## Quick sanity tests

### Authentication

Before running commands, load env so $PORT is available:
```bash
source .env
```

##### Check /me before login (should 401)
```bash
curl -i http://localhost:$PORT/me
```
Expected:
- HTTP/1.1 401 Unauthorized
- Body: `{ "error": "Unauthorized" }`

##### Log in (POST /auth/login)
Expected:
- Response contains { "email": "nickcys@gmail.com", "roles": [...] }.
- Saves cookie in [cookies.txt](./cookies.txt)
- HTTP/1.1 200 OK and a `Set-Cookie` header for the auth cookie
```bash
curl -i -X POST http://localhost:$PORT/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nickcys@gmail.com","password":"vgsd_gr0k79ZpLy77"}' \
  -c cookies.txt
```
Expected:
- HTTP/1.1 200 OK, Set-Cookie for auth cookie, body with `{ "email": "...", "roles": [ ... ] }`

##### Browser client login
1. In `client/`, set `VITE_API_TARGET=http://localhost:$PORT` in `.env`
2. Run `npm run dev` and open the client URL (default http://localhost:5173)
3. Login with your credentials; you should see the Projects page

##### Check /me again after login
```bash
curl -i http://localhost:$PORT/me -b cookies.txt
```
Expected:
- HTTP/1.1 200 OK
- Body: `{ "id": <number>, "email": "...", "roles": [ ... ] }`

---

### RBAC — Read routes

##### Check /timesheets with cookie
```bash
curl -i http://localhost:$PORT/timesheets -b cookies.txt
```
Expected:
- HTTP/1.1 200 OK with JSON when roles include `hr|management|directors` (or `admins`)
- HTTP/1.1 403 Forbidden if lacking required role

---

### Health

##### Check /healthz
```bash
curl -i http://localhost:$PORT/healthz
```
Expected:
- HTTP/1.1 200 OK and body `{ "ok": true, "db": true }`
- If DB down: HTTP/1.1 500 and `{ "ok": false, "db": false }`

---

### Admin Users (requires rbac:admin)

Use an admin account cookie (login first with an admin user). Cookies saved in `cookies.txt`.

##### Create user
```bash
curl -i -X POST http://localhost:$PORT/admin/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email":"test.user+1@example.com","password":"ChangeMe123!","display_name":"Test User","is_active":true}'
```
Expected: 201 with `{ id, email, display_name, is_active, created_at }`

##### List users (paginate)
```bash
curl -i "http://localhost:$PORT/admin/users?page=1&pageSize=5" -b cookies.txt
```
Expected: 200 with `{ items: [...], total, page, pageSize }`

##### Get user by id
```bash
USER_ID=123 # replace with created id
curl -i http://localhost:$PORT/admin/users/$USER_ID -b cookies.txt
```
Expected: 200 with the user DTO; 404 if missing

##### Update user
```bash
curl -i -X PUT http://localhost:$PORT/admin/users/$USER_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"display_name":"Updated Name","is_active":false}'
```
Expected: 200 with updated fields

##### Activate / Deactivate
```bash
curl -i -X POST http://localhost:$PORT/admin/users/$USER_ID/deactivate -b cookies.txt
curl -i -X POST http://localhost:$PORT/admin/users/$USER_ID/activate -b cookies.txt
```
Expected: 200; `is_active` toggles

##### Soft delete (deactivate)
```bash
curl -i -X DELETE http://localhost:$PORT/admin/users/$USER_ID -b cookies.txt
```
Expected: 200; `is_active` becomes false

---

### Admin Project Statuses (requires rbac:admin)

Manage the project status lookup used by overrides.

##### List statuses
```bash
curl -i http://localhost:$PORT/admin/statuses -b cookies.txt
```

##### Create a status
```bash
curl -i -X POST http://localhost:$PORT/admin/statuses \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Tender","code":"tender","sort_order":30}'
```
Expected: 201 with `{ id, name, code, is_active, sort_order }`

##### Update a status
```bash
STATUS_ID=1 # replace
curl -i -X PUT http://localhost:$PORT/admin/statuses/$STATUS_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Under construction","is_active":true}'
```

##### Delete a status
```bash
curl -i -X DELETE http://localhost:$PORT/admin/statuses/$STATUS_ID -b cookies.txt
```

##### Use status_id in overrides upsert
```bash
PROJECT_ID=123
STATUS_ID=1
curl -i -X PUT http://localhost:$PORT/overrides \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"id":'$PROJECT_ID',"status_id":'$STATUS_ID',"money_collected":1000}'
```
Expected: 200; DB row has both `status` (resolved name) and `status_id` set

---

### Self-Service (Profile & Password)

These require an authenticated user cookie (login first as that user).

##### Get current user
```bash
curl -i http://localhost:$PORT/me -b cookies.txt
```
Expected: 200 with `{ id, email, roles }`

##### Update display name
```bash
curl -i -X PUT http://localhost:$PORT/me \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"display_name":"New Name"}'
```
Expected: 200 with updated `{ display_name }`

##### Change password
```bash
curl -i -X POST http://localhost:$PORT/me/password \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"current_password":"OldPass123!","new_password":"NewPass123!"}'
```
Expected: 200 on success; 400 on wrong current or weak new

##### Request password reset (no account enumeration)
```bash
curl -i -X POST http://localhost:$PORT/auth/password-reset/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```
Expected: 200 with `{ ok: true }`. In tests only, response includes `debugToken`.

##### Confirm password reset
```bash
# Replace TOKEN with debugToken from test env or from email in production
curl -i -X POST http://localhost:$PORT/auth/password-reset/confirm \
  -H "Content-Type: application/json" \
  -d '{"token":"TOKEN","new_password":"FinalPass123!"}'
```
Expected: 200 on success; 400 if token invalid/expired/used or password weak

---

### Password Reset Email (SMTP)

Configure where links in emails should point:

```bash
# .env
# Public base URL of the web app used in links (password reset, etc)
# No trailing slash. Example: https://app.rspkl.com (prod) or http://localhost:5173 (dev)
APP_BASE_URL=https://app.rspkl.com

# Path on the web app that handles password reset and accepts ?token=
# Should start with a leading slash. Default: /reset
RESET_PATH=/reset
```

SMTP settings (examples):

```bash
MAILER_FROM="RSPKL Atlas <timesheet@rspkl.com>"
MAILER_URL=smtp://username%40example.com:PASSWORD@mail.rspkl.com:587?verify_peer=0
DEVELOPER_EMAIL=you@example.com
```

Send a one-off password reset email to `DEVELOPER_EMAIL` without hitting HTTP:

```bash
npm run mail:reset:test
```

Or trigger via HTTP endpoint (app must be running):

```bash
curl -s -X POST "http://localhost:$PORT/auth/password-reset/request" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Expected:
- Email arrives with link `${APP_BASE_URL}${RESET_PATH}?token=...`
- Logs show redacted SMTP URL in CLI helpers

---

### Kimai Sync (Admins)

Requires a user with `sync:execute` (admins have `*`).

Trigger syncs via API (replace cookie with an admin session):

```bash
curl -i -X POST http://localhost:$PORT/sync/projects -b cookies.txt
curl -i -X POST http://localhost:$PORT/sync/timesheets -b cookies.txt
```

Check sync health (requires `sync:execute`):

```bash
curl -s http://localhost:$PORT/sync/health -b cookies.txt | jq
```

Or use CLI helpers:

```bash
npm run sync:all
npm run sync:verify
npm run sync:materialize
```
