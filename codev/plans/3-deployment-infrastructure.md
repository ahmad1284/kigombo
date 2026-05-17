# Plan 3 — Deployment Infrastructure

## Files changed

| File | Action | Notes |
|---|---|---|
| `be/.env.example` | Create | Committed template |
| `be/.env` | Create | Gitignored dev defaults |
| `be/.env.local` | Create | Gitignored local overrides |
| `be/.env.prod` | Create | Gitignored production values |
| `be/ecosystem.config.js` | Create | PM2 config with `env` / `env_production` targets |
| `be/server.js` | Edit | Add dotenv loading at top (before any other require) |
| `be/package.json` | Edit | Add `dotenv` dep; swap `nodemon` dev script for `node --watch` |
| `Caddyfile` | Create | Static fe/ + /api/* reverse proxy |
| `.gitignore` | Edit | Add `.env.local`, `.env.prod` |
| `README.md` | Rewrite | Dev section + Ubuntu prod section |

## dotenv wiring (`server.js`)

```js
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, `.env.${process.env.NODE_ENV === 'production' ? 'prod' : 'local'}`),
  quiet: true,
});
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
```

Must be the very first lines — before `require('./db')` which reads `DB_PATH`.

## PM2 (`ecosystem.config.js`)

```js
module.exports = {
  apps: [{
    name: 'kigombo',
    script: 'server.js',
    node_args: '--experimental-sqlite',
    env: { NODE_ENV: 'development' },
    env_production: { NODE_ENV: 'production' },
  }],
};
```

Start with: `pm2 start ecosystem.config.js --env production`

## Caddy (`Caddyfile`)

```
your-domain.com {
    root * /opt/kigombo/fe
    file_server
    reverse_proxy /api/* localhost:5000
}
```

Caddy auto-provisions TLS via Let's Encrypt — no certbot needed.

## Dev script

`nodemon` removed from the dev workflow. `node --watch` (built-in since Node 18) is sufficient and removes a dev dependency.
