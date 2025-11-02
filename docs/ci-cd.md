# CI/CD Guide

This runbook captures the end-to-end build, test, and deploy process for RSPKL Atlas. Follow it before shipping any production change.

## Key Principles

- Use `npm ci` everywhere for deterministic installs.
- Build API (`npm run build` → `dist/`) and client (`client/npm run build` → `client/dist/`) separately.
- Run Drizzle migrations (and seeds) on the target DB before restarting the app.
- Deploy from the server (git pull → install → build → migrate → reload) instead of copying local artifacts.
- All API endpoints are under `/api/...`; the API statically serves `client/dist` in production and provides SPA fallback.

## Recommended Production Deploy Workflow

1. **Connect & sync**
   ```bash
   ssh do-rspkl-atlas
   cd ~/atlas
   git pull origin main
   ```
2. **Install and build on the droplet**
   ```bash
   npm ci
   cd client && npm ci && npm run build && cd ..
   npm run build
   ```
3. **Apply migrations and seeds**
   ```bash
   npm run db:migrate
   npm run db:seed
   npm run db:seed:admin   # optional, only if ADMIN_* envs set
   ```
   > Production note (Nov 2 2025): live environment skips the seed scripts to avoid overwriting MySQL data; we only run `npm run db:migrate` during routine deploys.
4. **Restart & persist**
   ```bash
   pm2 reload atlas-api
   pm2 save
   ```
5. **Verify**
   - Hit `https://rspkl-atlas.ghostcoders.net/` in a browser to confirm the login view and build label.
   - Optional: run `curl -I https://rspkl-atlas.ghostcoders.net/api/healthz` for a manual spot-check (it’s no longer part of the automated workflow because Cloudflare occasionally returned transient `502` responses immediately after reload).
6. **Document anomalies** in this file or `docs/initial-deployment.md`.

## Local / CI Build & Test Checklist

Run locally or in CI before merging to keep the pipeline green:

```bash
npm ci
npm run build
npm test                      # or targeted suites
cd client
npm ci
# Optional: export build metadata for local previews
export VITE_BUILD_VERSION=$(node -p "require('./package.json').version")
export VITE_BUILD_ID=$(git rev-parse --short HEAD)
npm run build
```

## Environment Variables

Required for API during build/run/test stages:
- `PORT` — runtime port
- Atlas DB: `ATLAS_DB_HOST`, `ATLAS_DB_PORT`, `ATLAS_DB_USER`, `ATLAS_DB_PASSWORD`, `ATLAS_DB_DATABASE`
- Kimai DB: `KIMAI_DB_HOST`, `KIMAI_DB_PORT`, `KIMAI_DB_USER`, `KIMAI_DB_PASSWORD`, `KIMAI_DB_DATABASE`
- Auth: `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_TOKEN_TTL_SECONDS`
- Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME` (admin seeding)
- Optional mailer: `MAILER_URL`, `MAILER_FROM`, `MAILER_FROM_NAME`, `DEVELOPER_EMAIL`
- Optional build metadata: set `VITE_BUILD_VERSION` (semantic version) and/or `VITE_BUILD_ID` (commit or timestamp) before running the client build to show the “Build …” label in the UI.

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

## Why Not `scp` Local Builds?

- **Parity:** native dependencies (e.g., `mysql2`) link against your local OS/architecture; building on macOS and running on Linux can break.
- **Secrets:** server builds read `.env` in-place; local artifacts risk embedding secrets or relying on stale variables.
- **Repeatability:** the server-side workflow (`git pull` → `npm ci` → `npm run build`) is easy to audit and reproduce.
- **Diff hygiene:** you avoid copying stray dev files (e.g., `.env.local`, caches) into production.

If you ever must upload artifacts (e.g., emergency recovery), archive `dist/` and `client/dist/`, note the commit SHA, and rebuild natively at the first opportunity.

## GitHub Actions Automation

The repository includes `.github/workflows/ci.yml`, which mirrors this runbook in two jobs:

1. **Build & Test** (runs on every push/PR to `main`):
   - Installs root dependencies (`npm ci`).
   - Builds the API (`npm run build`) and runs Jest tests.
   - Installs and builds the client (`client/npm ci`, `client/npm run build`).

2. **Deploy to Droplet** (runs only on pushes to `main`):
   - SSHs into the production droplet.
   - Resets `/root/atlas` to the pushed commit.
   - Re-runs the build + migrate + `pm2 reload` sequence.
   - Hits `https://rspkl-atlas.ghostcoders.net/api/healthz` and fails the job if the health check is not `200`.

### Required GitHub Secrets

Set these repository secrets before enabling the deploy step:

- `DEPLOY_HOST` — Droplet IP or hostname (e.g., `206.189.47.158`).
- `DEPLOY_USER` — SSH user with rights to run the deploy script (currently `root`).
- `DEPLOY_KEY` — Private key matching the droplet’s deploy key (use the PEM contents).

Optional: add `known_hosts` handling if strict host checking is enabled; by default the action accepts the host fingerprint on first run.
Once secrets are present, every merge to `main` automatically rebuilds and redeploys using the same commands documented above. The workflow still reuses PM2 reload; the automated `curl` against `/api/healthz` was removed after a transient Cloudflare `502` (Nov 2 2025), so do a quick manual check post-deploy.

> Add secrets via **GitHub → Settings → Secrets and variables → Actions → New repository secret**. Paste the private key (including `-----BEGIN`/`END-----`) into `DEPLOY_KEY`.

### Automation Setup Notes (Nov 2 2025)

1. Added `.github/workflows/ci.yml` with “Build & Test” and “Deploy to Droplet” jobs that mirror the manual runbook.
2. Updated this document with the secret requirements and explanation of the deploy job’s health check.
3. Refreshed `docs/AGENTS.md` so future agents know the workflow expects SSH secrets and will no-op without them.
4. Repository secrets `DEPLOY_HOST`, `DEPLOY_USER`, and `DEPLOY_KEY` were added (private key copied from `/root/.ssh/id_ed25519`) so the deploy job can connect to the droplet.
5. Workflow exports `VITE_BUILD_VERSION` (from `client/package.json`) and `VITE_BUILD_ID` (short Git SHA) so the frontend displays the exact release tag visible in the team switcher.
6. Automatic `/api/healthz` verification was removed after Cloudflare responded with a transient `502`; perform manual checks until a retry/backoff strategy is introduced.

## Branch Workflow Cheat Sheet

Mid-development backup (no deploy):
```bash
git checkout -b feature-a          # or stay on existing feature branch
git add <files>
git commit -m "WIP feature-a"
git push origin feature-a          # no CI deploy runs because main is untouched
```

Ready to ship:
```bash
git checkout feature-a
git fetch origin
git rebase origin/main             # optional to keep history linear
git checkout main
git merge feature-a                # or fast-forward
npm run build && npm test          # recommended pre-push checks
git push origin main               # triggers CI build + deploy
git branch -d feature-a            # optional cleanup
git push origin --delete feature-a
```

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
- Q: Can I deploy by uploading my local `dist/` via SCP?
  - A: Avoid it. Build on the droplet so binaries match, secrets stay server-side, and the procedure stays scripted.
