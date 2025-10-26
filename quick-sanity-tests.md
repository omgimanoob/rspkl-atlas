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
  -d '{"email":"nickcys@gmail.com","password":"vgsd_gr0k79ZpLy88"}' \
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

### Sync (admin)

Requires an admin cookie (`-b cookies.txt`).

##### Sync projects (full refresh)
```bash
curl -i -X POST http://localhost:$PORT/sync/projects -b cookies.txt
```

##### Sync timesheets (incremental)
```bash
curl -i -X POST http://localhost:$PORT/sync/timesheets -b cookies.txt
```

##### Sync users / activities / tags / customers / timesheet meta
```bash
curl -i -X POST http://localhost:$PORT/sync/users -b cookies.txt
curl -i -X POST http://localhost:$PORT/sync/activities -b cookies.txt
curl -i -X POST http://localhost:$PORT/sync/tags -b cookies.txt
curl -i -X POST http://localhost:$PORT/sync/customers -b cookies.txt
curl -i -X POST http://localhost:$PORT/sync/tsmeta -b cookies.txt
```

##### Clear a replica table (dangerous)
```bash
curl -i -X POST http://localhost:$PORT/sync/clear/timesheet_meta -b cookies.txt
```
Allowed table keys: `projects|timesheets|users|activities|tags|timesheet_tags|timesheet_meta|customers`.

##### Sync health & verify
```bash
curl -sS http://localhost:$PORT/sync/health -b cookies.txt | jq '.'
curl -sS http://localhost:$PORT/sync/verify -b cookies.txt | jq '.'
```
Expected:
- Health: last-run timestamps and replica counts for each replica.
- Verify: Kimai vs replica totals, and timesheets recent-window accuracy.

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

### Prospective Projects (UI support; permissions TBD)

MVP flow for enabling creation from the Projects page.

##### Public statuses list (used by UI)
```bash
curl -i http://localhost:$PORT/statuses -b cookies.txt
```
Expected:
- 200 OK with active statuses for non‑admin users who can read projects.

##### List Prospective projects (non-admin read)
```bash
curl -sS http://localhost:$PORT/prospective -b cookies.txt | jq '.'
```
Notes:
- This returns only Atlas-native (Prospective) entries without Kimai rows. Use this to verify creation quickly.

##### Create a prospective project (Atlas‑native)
```bash
curl -i -X POST http://localhost:$PORT/prospective \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"New Draft Project","status_id":1,"notes":"Optional context"}'
```
Expected:
- 201 Created with `{ id, kimai_project_id: null, is_prospective: true, name, status? }`.

##### Link a prospective row to Kimai (optional Phase 2)
```bash
PROS_ID=123
KIMAI_ID=456
curl -i -X POST http://localhost:$PORT/prospective/$PROS_ID/link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"kimai_project_id":'$KIMAI_ID'}'
```
Expected:
- 200 OK with `{ id, kimai_project_id, is_prospective: false }`.
- 400 with `{ reason: 'unknown_kimai_project' }` if the Kimai id does not exist.
- 409 with `{ reason: 'override_exists_for_project' }` if another override exists for that Kimai id.

Notes:
- The UI only surfaces creation on the Projects page; listing/linking may be provided in a dedicated Prospective tab.

##### End-to-end via cURL (login → create → list)
```bash
# If your .env contains values with spaces, avoid sourcing it directly.
# Either export just PORT, or ensure those values are quoted in .env.
export PORT=${PORT:-9999}

# 1) Login (saves cookie)
curl -sS -i -X POST "http://localhost:$PORT/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"nickcys@gmail.com","password":"vgsd_gr0k79ZpLy88"}' \
  -c cookies.txt

# 2) Create a Prospective project (Atlas-native)
curl -sS -X POST "http://localhost:$PORT/prospective" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"Prospective via curl","notes":"created from CLI"}' | tee create.json

# 3) Fetch projects including Prospective rows (mixed list)
curl -sS "http://localhost:$PORT/projects?includeProspective=1" -b cookies.txt | jq '.'

# 4) Show only Prospective (Atlas-native) entries
curl -sS "http://localhost:$PORT/projects?includeProspective=1" -b cookies.txt \
  | jq '[.[] | select(.origin=="atlas")]'
```
Tips:
- Keep `-b cookies.txt` on the same line as its argument; splitting them causes curl to error.
- Prospective rows appear only when `includeProspective=1` is included. They show with `origin: "atlas"` and a negative `id`.

##### (Optional) Create in Kimai then link
```bash
PROS_ID=123
curl -i -X POST http://localhost:$PORT/prospective/$PROS_ID/kimai-create-link \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name":"New Draft Project","customer_id":99}'
```
Expected:
- 201/200 with `{ id, kimai_project_id }` when created in Kimai and linked.
- 403 if caller lacks `kimai:project:create`.
- 500/4xx with a reason if Kimai creation failed or verification timed out; Atlas row remains unchanged.

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
Expected: 200 with updated `{ display_name }`.
Notes:
- Provide a non-empty `display_name`. Sending an empty or missing value may result in no update and a 404.

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
