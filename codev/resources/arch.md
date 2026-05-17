# Architecture — Kigombo

## Overview

Vanilla JS SPA frontend + Node.js/Express REST API backend. No build step for frontend. SQLite for storage via the built-in `node:sqlite` module.

## Structure

```
kigombo/
├── fe/           Vanilla JS SPA (static files, no build)
├── be/           Express REST API + SQLite
│   ├── server.js Entry point — loads env, mounts routes
│   ├── db.js     SQLite init and schema migrations
│   └── ecosystem.config.js  PM2 config (dev + production targets)
├── Caddyfile     Reverse proxy: static fe/ + /api/* → :5000
└── Vagrantfile   Dev VM (:3000/:5000) + prod VM (Caddy :8080)
```

## Env loading

`server.js` loads env files in priority order using `dotenv`:

| `NODE_ENV` | Files loaded (first wins) |
|---|---|
| `production` | `.env.prod` → `.env` |
| other / unset | `.env.local` → `.env` |

## Frontend API URL

`fe/app.js` derives the API base URL from `location` at runtime:

```js
const serverUrl = location.port === '3000'
  ? 'http://localhost:5000/api'       // dev: served by `serve` on :3000
  : `${location.protocol}//${location.host}/api`;  // prod: Caddy proxies /api/*
```

## Local environments (Vagrant)

| VM | Stack | Host access |
|---|---|---|
| `dev` | node --watch + serve | localhost:3000 (UI), localhost:5000 (API) |
| `prod` | PM2 + Caddy | localhost:8080 (everything via Caddy) |

Provider: libvirt. Box: `generic/ubuntu2204`. Sync: rsync.
