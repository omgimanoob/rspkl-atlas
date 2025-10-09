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
