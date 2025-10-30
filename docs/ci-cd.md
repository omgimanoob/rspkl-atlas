# CI/CD Guide

This guide outlines a practical CI/CD pipeline for RSPKL Atlas, covering installs, build, tests, database migrations, and deployment.

## Key Principles

- Use `npm ci` for deterministic installs.
- Split client and API builds: client (Vite) → `client/dist`; API (tsc) → `dist/`.
- Run Drizzle migrations on deploy; keep migration artifacts in `drizzle/` under version control.
- All API endpoints are under `/api/...`; the API statically serves `client/dist` in production and provides SPA fallback.

## Environment Variables

Required for API during build/run/test stages:
- `PORT` — runtime port
- Atlas DB: `ATLAS_DB_HOST`, `ATLAS_DB_PORT`, `ATLAS_DB_USER`, `ATLAS_DB_PASSWORD`, `ATLAS_DB_DATABASE`
- Kimai DB: `KIMAI_DB_HOST`, `KIMAI_DB_PORT`, `KIMAI_DB_USER`, `KIMAI_DB_PASSWORD`, `KIMAI_DB_DATABASE`
- Auth: `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_TOKEN_TTL_SECONDS`
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` (admin seeding)

Client dev proxy only (not prod):
- `VITE_API_TARGET` — e.g., `http://localhost:9999`

## Build Outputs

- API build (root): `npm run build` → compiles TS to `dist/`
- Client build (client): `npm run build` → emits `client/dist`

## Database Migrations & Seed

In CI/CD, run migrations against the target DB before starting the app:
- `npm run db:generate` (optional if schema changed; otherwise no-op)
- `npm run db:migrate`
- `npm run db:seed` (idempotent)
- `npm run db:seed:admin` (if admin envs set; idempotent)

These scripts use the `ATLAS_DB_*` vars and rely on network access to the DB.

## GitHub Actions Example

`.github/workflows/ci.yml` (example):

```yaml
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install root deps
        run: npm ci

      - name: Install client deps
        working-directory: client
        run: npm ci

      - name: Type check API
        run: npm run build

      - name: Type check client
        working-directory: client
        run: npm run build -- --emptyOutDir=false

      - name: Run tests
        env:
          PORT: 9998
          ATLAS_DB_HOST: 127.0.0.1
          ATLAS_DB_PORT: 3306
          ATLAS_DB_USER: root
          ATLAS_DB_PASSWORD: password
          ATLAS_DB_DATABASE: atlas_ci
        run: |
          # optional: spin up a DB service before this step
          npm test
```

> Note: For integration tests requiring MySQL, add a DB service (e.g., with `services:` mysql) or use a cloud DB for CI.

## GitHub Actions – Deploy Example

If deploying to a VM (SSH) or Platform-as-a-Service, use a second workflow that:

1. Checks out code on target host (or uploads an artifact).
2. Installs deps with `npm ci` (root + client).
3. Builds client & API.
4. Applies DB migrations + seed (pointed at production DB).
5. Restarts the process manager (pm2 or systemd).

Example pseudo-steps (implementation depends on your infra):

```yaml
name: Deploy
on:
  workflow_dispatch:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: cd client && npm ci && npm run build && cd ..
      - run: npm run build
      - name: Run migrations & seed
        env:
          ATLAS_DB_HOST: ${{ secrets.ATLAS_DB_HOST }}
          ATLAS_DB_PORT: ${{ secrets.ATLAS_DB_PORT }}
          ATLAS_DB_USER: ${{ secrets.ATLAS_DB_USER }}
          ATLAS_DB_PASSWORD: ${{ secrets.ATLAS_DB_PASSWORD }}
          ATLAS_DB_DATABASE: ${{ secrets.ATLAS_DB_DATABASE }}
        run: |
          npm run db:migrate
          npm run db:seed
      - name: Restart service
        run: |
          # example with pm2
          npx pm2 startOrReload ecosystem.config.js
```

> If you deploy via SSH to a remote VM, replace build/seed/restart steps with SSH commands; or build artifacts and upload them.

## PM2 / Systemd

Use a process manager in production:

- PM2 (ecosystem example):

```js
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'atlas-api',
      script: 'dist/src/index.js',
      env: { NODE_ENV: 'production', PORT: 3333 },
    },
  ],
};
```

- Start: `npx pm2 start ecosystem.config.js && npx pm2 save`
- Restart on deploy: `npx pm2 startOrReload ecosystem.config.js`

## Docker (Optional)

A minimal Docker pattern (multi-stage) can be used. Ensure DB creds are supplied via secrets.

```dockerfile
# client build
FROM node:20-alpine AS client
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
RUN cd client && npm run build

# server build
FROM node:20-alpine AS server
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server /app/dist ./dist
COPY --from=client /app/client/dist ./client/dist
COPY public ./public
EXPOSE 3333
CMD ["node", "dist/src/index.js"]
```

## Release Checklist

- [ ] All tests passing in CI
- [ ] Client built (`client/dist`), API built (`dist/`)
- [ ] Drizzle migrations applied on target environment
- [ ] Secrets configured (DB, auth, mail)
- [ ] Health check `/api/healthz` green
- [ ] Smoke test key pages (Projects, Payments, Studios)

## Frequently Asked Questions

- Q: Do I need to rebuild the client for backend-only changes?
  - A: No. Rebuild client only for UI changes. Backend changes need server rebuild and restart.
- Q: Where do I point the client to the API in dev?
  - A: Set `VITE_API_TARGET` to your API dev URL (e.g., `http://localhost:9999`). The Vite proxy preserves `/api`.
- Q: How do I avoid serving JSON when visiting `/payments` in prod?
  - A: All API routes are under `/api`. Visiting `/payments` hits the SPA; `/api/payments` returns JSON.

