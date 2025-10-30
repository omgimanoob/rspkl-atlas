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
  - Optional links: `APP_BASE_URL`, `RESET_PATH`

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
- Health: `curl http://localhost:3333/api/healthz` → expect `{ "ok": true, "db": true }`
- Open: `http://<server-ip>:3333` (or your domain if proxied)

## Next Deploys
- Pull, rebuild, migrate, reload:
  - `ssh do-rspkl-atlas && cd ~/atlas`
  - `git pull`
  - `cd client && npm ci && npm run build && cd ..`
  - `npm ci && npm run build`
  - `npm run db:migrate`
  - `pm2 reload atlas-api`

## Optional Reverse Proxy
- Put Nginx/Caddy in front of `localhost:3333` for TLS; keep port 3333 private.
