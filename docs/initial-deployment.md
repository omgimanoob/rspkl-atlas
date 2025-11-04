# Initial Deployment

Concise checklist for first-time deployment of RSPKL Atlas to a VM over SSH (same-origin serving with PM2).

## Prereqs
- Node 20+ and PM2 on the server.
- Reachable MySQL for Atlas and Kimai replicas.
- SSH access to the host (e.g., `ssh do-rspkl-atlas`).

## Deployment Progress (Runbook)
- [x] SSH to host: `ssh do-rspkl-atlas`
- [x] Add NodeSource repo: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`
- [x] Install Node.js: `sudo apt-get install -y nodejs build-essential`
- [x] Install PM2 globally: `sudo npm i -g pm2`
- [x] Initialize PM2 at boot: `pm2 startup`
  - Result: systemd unit `pm2-root.service` enabled for the root user (PM2 home `/root/.pm2`). No extra command required.
  - After starting the app, run `pm2 save` to freeze the process list for reboot.
- [x] Generate GitHub deploy key: `ssh-keygen -t ed25519 -C "rspkl-atlas@do-rspkl-atlas"`
- [x] Add public key to repo Deploy Keys: contents of `~/.ssh/id_ed25519.pub`
- [x] Verify GitHub SSH: `ssh -T git@github.com` (success message)
- [x] Clone repository into `/root/atlas`: `git clone git@github.com:omgimanoob/rspkl-atlas.git .`

- [x] MySQL (Atlas DB): created app user and grant on localhost
  - `CREATE USER 'atlas'@'localhost' IDENTIFIED BY 'super_secret_password';`
  - `GRANT ALL PRIVILEGES ON atlas.* TO 'atlas'@'localhost';`

- [x] Kimai DB connectivity check
  - `npm run kimai:check`
  - Output summary: Basic query OK; `kimai2_projects count=173`

- [x] Atlas DB install and seed
  - `npm run db:install`
  - Result: Drizzle migrations applied; default project statuses, studios/teams/directors seeded; admin user seeded.
  - Admin seeded: `nickcys@gmail.com`

- [x] Install deps and build
  - `npm ci`
  - `cd client && npm ci && npm run build && cd ..`
  - `npm run build`

- [x] Start API with PM2 (PORT from .env)
  - `.env`: `PORT=9999`
  - `NODE_ENV=production pm2 start /root/atlas/dist/src/index.js --name atlas-api --cwd /root/atlas --update-env`
  - `pm2 save`

- [x] Verify API health
  - `curl http://localhost:9999/api/healthz` → `{ "ok": true, "db": true }`

## One-Time Server Setup
- If you prefer a non-root service (recommended), undo and re-create under a normal user:
  - As root: `pm2 unstartup systemd`
  - Create/switch user (example `atlas`): `adduser atlas && su - atlas`
  - As root: `sudo pm2 startup systemd -u atlas --hp /home/atlas`
  - Continue the steps below as `atlas` instead of `root`.

## App Checkout
- Create location and clone (adjust for SSH or HTTPS):
  - `mkdir -p ~/atlas && cd ~/atlas`
  - SSH: `git clone git@github.com:omgimanoob/rspkl-atlas.git .`  (cloned into the current directory)
  - Path note: repo root is now `~/atlas` (no subfolder), keep this in mind for later commands.

## Environment
- Create `.env` at repo root with required vars:
  - API: `PORT`, `AUTH_JWT_SECRET`, `AUTH_COOKIE_NAME`, `AUTH_TOKEN_TTL_SECONDS`
  - Atlas DB: `ATLAS_DB_HOST`, `ATLAS_DB_PORT`, `ATLAS_DB_USER`, `ATLAS_DB_PASSWORD`, `ATLAS_DB_DATABASE`
  - Kimai DB: `KIMAI_DB_HOST`, `KIMAI_DB_PORT`, `KIMAI_DB_USER`, `KIMAI_DB_PASSWORD`, `KIMAI_DB_DATABASE`
  - Optional admin seed: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`
  - Optional mail: `MAILER_URL` (e.g., `dev://log`), `MAILER_FROM`, `MAILER_FROM_NAME`
  - Optional links: `PASSWORD_RESET_ALLOWED_ORIGINS`, `RESET_PATH`

### MySQL Setup (Atlas DB)
Simple steps to install and provision the Atlas database. Choose local or remote.

- Install MySQL Server (Ubuntu):
  - `sudo apt-get update && sudo apt-get install -y mysql-server`
  - Secure defaults: `sudo mysql_secure_installation`

- Create database and user (run in MySQL shell):
  - `sudo mysql`
  - Then execute:
    - `CREATE DATABASE atlas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    - Local-only user (recommended if app runs on same host):
      - `CREATE USER 'atlas'@'localhost' IDENTIFIED BY 'super_secret_password';`
      - `GRANT ALL PRIVILEGES ON atlas.* TO 'atlas'@'localhost';`
    - Or remote-access user (if app connects from another host):
      - `CREATE USER 'atlas'@'%' IDENTIFIED BY 'super_secret_password';`
      - `GRANT ALL PRIVILEGES ON atlas.* TO 'atlas'@'%';`
    - `FLUSH PRIVILEGES;`
  - Exit the MySQL shell.

- Networking (only if remote access is needed):
  - Edit MySQL bind address to listen beyond localhost: `/etc/mysql/mysql.conf.d/mysqld.cnf`
    - Set `bind-address = 0.0.0.0` (or specific interface) and restart: `sudo systemctl restart mysql`
  - Firewall: allow 3306 only from the app server IP (UFW example):
    - `sudo ufw allow from <APP_SERVER_IP> to any port 3306`

- Test connectivity from the app server:
  - `mysql -h <DB_HOST> -u atlas -p -D atlas -e "SELECT 1;"`

- Example .env (Atlas DB):
  - Local DB on same host:
    - `ATLAS_DB_HOST=127.0.0.1`
    - `ATLAS_DB_USER=atlas`
    - `ATLAS_DB_PASSWORD=super_secret_password`
    - `ATLAS_DB_DATABASE=atlas`
    - `ATLAS_DB_PORT=3306`
  - Remote DB (e.g., `mysql.wsl`):
    - `ATLAS_DB_HOST=mysql.wsl`
    - `ATLAS_DB_USER=atlas`
    - `ATLAS_DB_PASSWORD=super_secret_password`
    - `ATLAS_DB_DATABASE=atlas`
    - `ATLAS_DB_PORT=3306`

## Install & Build
- Root deps: `npm ci`
- Client deps+build: `cd client && npm ci && npm run build && cd ..`
- API build: `npm run build`

## Database Init
- Apply schema and seed (idempotent):
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run db:seed:admin` (only if admin envs set)

## Start With PM2
- Quick start:
  - `NODE_ENV=production PORT=${PORT:-3333} pm2 start dist/src/index.js --name atlas-api --cwd $(pwd) --update-env`
  - `pm2 save`
- Or use an ecosystem file (recommended):
  - Create `ecosystem.config.js`:
    - `module.exports = { apps: [{ name: 'atlas-api', script: 'dist/src/index.js', env: { NODE_ENV: 'production', PORT: 3333 } }] };`
  - `pm2 start ecosystem.config.js && pm2 save`
  - If you initialized PM2 as root earlier, your boot unit is `pm2-root`. Verify with `systemctl status pm2-root`.

## Verify
- Health: `curl http://localhost:${PORT}/api/healthz` (use `PORT` from `.env`) → expect `{ "ok": true, "db": true }`
- Open: `http://<server-ip>:${PORT}` (or your domain if proxied)

## Next Deploys
- Pull, rebuild, migrate, reload:
  - `ssh do-rspkl-atlas && cd ~/atlas`
  - `git pull`
  - `cd client && npm ci && npm run build && cd ..`
  - `npm ci && npm run build`
  - `npm run db:migrate`
  - `pm2 reload atlas-api`

## Optional Reverse Proxy
- Put Nginx in front of `127.0.0.1:9999` for TLS; keep port 9999 private.

### Nginx Setup (Runbook)
- [x] Create DNS A record (Cloudflare): `rspkl-atlas.ghostcoders.net → 163.47.10.241` (Proxied)
- [x] Install Nginx and allow firewall
- [x] Create site config for domain (proxy to `127.0.0.1:9999`)
  - Domain: `rspkl-atlas.ghostcoders.net`
  - Config:

```nginx
server {
  listen 80;
  server_name rspkl-atlas.ghostcoders.net;
  client_max_body_size 10m;
  location / {
    proxy_pass http://127.0.0.1:9999;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # Preserve original client scheme from Cloudflare for cookie/security logic
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

- [x] Enable site and reload Nginx
  - `sudo ln -s /etc/nginx/sites-available/atlas /etc/nginx/sites-enabled/atlas`
  - `sudo nginx -t && sudo systemctl reload nginx`

- [x] Obtain TLS with Certbot and enable redirect to HTTPS
  - `sudo apt-get install -y certbot python3-certbot-nginx`
  - `sudo certbot --nginx -d rspkl-atlas.ghostcoders.net --redirect`
  - Result: Certificate issued and deployed to `/etc/nginx/sites-enabled/atlas`; HTTP→HTTPS redirect enabled.
  - Cloudflare: SSL/TLS mode kept at “Flexible” to avoid impacting other ghostcoders.net subdomains; origin still serves HTTPS so cookies marked `Secure` remain valid.

- [x] Verify HTTPS health
  - `curl -I http://rspkl-atlas.ghostcoders.net/api/healthz` → `200 OK` (served via Cloudflare)
  - `curl -I https://rspkl-atlas.ghostcoders.net/api/healthz` → `200 OK`

Note: If you want HTTP→HTTPS redirects at the edge, enable “Always Use HTTPS” in Cloudflare. When using Flexible, ensure origin does not force HTTP→HTTPS to avoid loops. With a valid LE cert installed, you can switch to “Full (strict)” later when other subdomains are ready.

## Nginx Reverse Proxy (HTTPS)
Set up Nginx to serve your domain over HTTPS and proxy to the API on 127.0.0.1:9999.

1) Install Nginx (Ubuntu):
   - `sudo apt-get update && sudo apt-get install -y nginx`
   - Firewall (UFW): `sudo ufw allow 'Nginx Full'`

2) Create a site config (replace YOUR_DOMAIN):
   - Create file: `sudo nano /etc/nginx/sites-available/atlas` and paste:

```nginx
server {
  listen 80;
  server_name YOUR_DOMAIN;
  client_max_body_size 10m;
  location / {
    proxy_pass http://127.0.0.1:9999;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```
   - `sudo ln -s /etc/nginx/sites-available/atlas /etc/nginx/sites-enabled/atlas`
   - `sudo nginx -t && sudo systemctl reload nginx`

3) Obtain TLS certs with Certbot (recommended):
   - `sudo apt-get install -y certbot python3-certbot-nginx`
   - `sudo certbot --nginx -d YOUR_DOMAIN --redirect`
   - Auto-renewal is installed; test with: `sudo certbot renew --dry-run`

4) Verify
   - Open: `https://YOUR_DOMAIN` (login requires HTTPS because cookies are `Secure` in production)
   - Health: `curl -I https://YOUR_DOMAIN/api/healthz`

Example config to copy: `docs/nginx-atlas.conf`
