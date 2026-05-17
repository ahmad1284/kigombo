# Plan 3 — Deployment Infrastructure

## Overview

Two remaining items from the deployment infrastructure spec: fix the hardcoded `serverUrl` in the frontend so it works in both dev and Caddy-proxied prod, and add a `Vagrantfile` with `dev` and `prod` VMs for local verification.

## Phases

```json
{
  "phases": [
    {
      "id": "frontend-serverurl-fix",
      "name": "Frontend serverUrl fix",
      "objective": "Make fe/app.js derive the API URL from location so it works in both dev (:3000) and Caddy prod (:80/8080)",
      "files": ["fe/app.js"],
      "dependencies": [],
      "success_criteria": "app.js no longer hardcodes localhost:5000; URL is derived from location.port"
    },
    {
      "id": "vagrantfile",
      "name": "Vagrantfile — dev and prod VMs",
      "objective": "Add a Vagrantfile with two named libvirt VMs: dev (node --watch + serve) and prod (PM2 + Caddy)",
      "files": ["Vagrantfile"],
      "dependencies": ["frontend-serverurl-fix"],
      "success_criteria": "vagrant up dev boots and serves frontend at localhost:3000 and API at localhost:5000; vagrant up prod boots and serves everything via Caddy at localhost:8080"
    }
  ]
}
```

## Phase details

### Phase 1 — Frontend serverUrl fix

**File**: `fe/app.js`

Replace:
```js
const serverUrl = 'http://localhost:5000/api';
```
With:
```js
const serverUrl = location.port === '3000'
  ? 'http://localhost:5000/api'
  : `${location.protocol}//${location.host}/api`;
```

### Phase 2 — Vagrantfile

Provider: `libvirt`. Box: `generic/ubuntu2204`.

**dev VM**
- Forwarded ports: guest 5000 → host 5000 (API), guest 3000 → host 3000 (UI)
- Synced folder: `.` → `/vagrant` (type: `virtiofs` or rsync)
- Provision:
  - Install Node.js 22 via NodeSource
  - `cd /vagrant/be && npm install`
  - Copy `.env.example` → `.env` if `.env` absent
  - `nohup node --experimental-sqlite --watch server.js &` (or via a simple service)
  - `npm install -g serve && nohup serve /vagrant/fe -p 3000 &`

**prod VM**
- Forwarded port: guest 80 → host 8080
- Synced folder: `.` → `/opt/kigombo`
- Provision:
  - Install Node.js 22, PM2, Caddy
  - `cd /opt/kigombo/be && npm install --omit=dev`
  - Generate `.env.prod` (random JWT_SECRET, DB_PATH=/var/lib/kigombo/banka.db)
  - `mkdir -p /var/lib/kigombo`
  - `pm2 start /opt/kigombo/be/ecosystem.config.js --env production`
  - Write `/etc/caddy/Caddyfile` with `:80` block (no domain, for local testing)
  - `systemctl reload caddy`

## Previously implemented (already in codebase)

| File | Status |
|---|---|
| `be/.env.example` | Done |
| `be/ecosystem.config.js` | Done |
| `be/server.js` dotenv wiring | Done |
| `be/package.json` (dotenv, node --watch) | Done |
| `Caddyfile` | Done |
| `.gitignore` | Done |
| `README.md` | Done |
