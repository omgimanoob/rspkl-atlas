# Build and Run Guide (Dev & Prod)

This document explains how to develop, build, and run the RSPKL Atlas app in both development and production.

## Prerequisites

- Node.js 18+ (Node 22 is fine)
- MySQL-compatible DBs for Atlas and Kimai replicas
- `./.env` configured with DB and app settings (see existing `.env`)

Key environment variables:
- API: `PORT`, `ATLAS_DB_*`, `KIMAI_DB_*`, `AUTH_*`
- Client (dev): `VITE_API_TARGET` (e.g., `http://localhost:9999`)

## Database Setup

The project uses Drizzle migrations. To initialize the DB schema and seed default data:

- Install deps and run DB scripts:
  - `npm ci`
  - `npm run db:install`

This runs, in order:
- `db:generate` (generate SQL if schema changed)
- `db:migrate` (apply migrations)
- `db:seed` (roles/permissions/statuses, studios and mappings)
- `db:seed:admin` (create admin if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set)

## Development

Run API and client separately.

- API dev (port defined by `PORT`, e.g., 9999):
  - `npm run dev`
  - Logs: “RSPKL Atlas API listening at http://localhost:<PORT>`

- Client dev (Vite on 5173 by default):
  - `cd client && npm ci`
  - Set proxy target to your API: `export VITE_API_TARGET=http://localhost:9999`
  - `npm run dev`

Notes:
- In dev, the UI calls `/api/...` and Vite proxies to `${VITE_API_TARGET}/api/...`.
- All API routes are under `/api/...` (no prefix stripping in dev or prod).

## Production – Build & Serve (same origin)

Build the client and server, then serve from a single Node process.

1) Build the client bundle (served as static files by the API):
   - `cd client && npm run build`
2) Build the server (compiles TS → `dist/`):
   - `cd .. && npm run build`
3) Start the compiled server in production mode:
   - `NODE_ENV=production PORT=3333 npm run start:prod`
4) Open the app: `http://localhost:3333`

Convenience script:
- `npm run serve:prod` → runs `npm run build` then starts prod on `PORT` (defaults to 3333)
  - Example: `PORT=5173 npm run serve:prod`

What the server serves in production:
- `client/dist` (built UI) at `/`
- `public/` (additional static assets) without taking over `/`
- SPA fallback for non-API GET requests → `client/dist/index.html`
- API under `/api/...` (e.g., `/api/payments`)

## API Routes (examples)

- Health: `GET /api/healthz`
- Auth: `POST /api/auth/login`, `POST /api/auth/logout`
- Current user: `GET /api/me`
- Payments: `GET /api/payments`, `POST /api/payments`
- Projects V2: `GET /api/v2/projects`, `GET /api/v2/statuses`
- Studios: `GET /api/studios`, `POST /api/studios/:id/teams`, `GET /api/kimai-users`, etc.

## Common Tasks

- Rebuild and restart prod server after backend changes:
  - `npm run build && NODE_ENV=production PORT=3333 npm run start:prod`
- Rebuild client after UI changes:
  - `cd client && npm run build`

## Troubleshooting

- “UI doesn’t reflect latest changes” in prod:
  - Rebuild the client (`client/dist`) and restart the server.
  - Hard refresh the browser to bypass cache (Ctrl+Shift+R).

- “Visiting `/payments` shows JSON instead of the page”:
  - By design in prod, direct API routes are under `/api/...`. The UI page is `/payments` in the client; API data is under `/api/payments`.
  - If you open `/api/payments`, you’ll get JSON; navigate via the UI to view the page.

- Express 5 path-to-regexp errors on wildcard routes:
  - The server uses a middleware SPA fallback (no `app.get('*', ...)`). If you reintroduce wildcard routes, Express 5 may throw.

- Dev `/api` proxy returns 404:
  - Ensure `VITE_API_TARGET` points to your dev API (e.g., `http://localhost:9999`).
  - The client dev proxy preserves the `/api` prefix; the server expects `/api/...`.

- Admin seeding on boot fails DB connection:
  - The server logs a warning and still starts. Ensure `ATLAS_DB_*` vars are correct and DB is reachable.

## Scripts Reference

- Dev API: `npm run dev`
- Build server: `npm run build`
- Start prod server (compiled): `npm run start:prod`
- Build + start prod: `npm run serve:prod` (uses `PORT`, defaults 3333)
- DB install: `npm run db:install`
- Migrate only: `npm run db:migrate`
- Seed only: `npm run db:seed` and `npm run db:seed:admin`

