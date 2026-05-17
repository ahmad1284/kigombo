# Spec 3 — Deployment Infrastructure

## Problem

The project had no structured way to manage environment configuration across dev/local/production contexts, no process manager config, and no reverse proxy config. The README was also missing concrete deployment steps.

## Goal

Add lightweight, reproducible infrastructure for running the app on a bare Ubuntu server using PM2 (process manager) and Caddy (reverse proxy + TLS).

## Scope

### In scope
- Dotenv-based env file hierarchy (`.env`, `.env.local`, `.env.prod`, `.env.example`)
- PM2 `ecosystem.config.js` with dev and production env targets
- `Caddyfile` for static frontend serving + `/api` reverse proxy
- Updated `.gitignore` to exclude private env files, keep `.env.example` tracked
- `node --watch` replaces `nodemon` as the dev watcher (built-in, no extra dep)
- README rewritten with a dev section and a production (Ubuntu) section

### Out of scope
- Docker / containerisation
- CI/CD pipeline
- Database backups
- Multi-server / load balancing

## Env file hierarchy

| File | Committed | Purpose |
|---|---|---|
| `.env.example` | ✓ | Template — copy to get started |
| `.env` | ✗ | Base dev defaults |
| `.env.local` | ✗ | Local overrides (highest priority in dev) |
| `.env.prod` | ✗ | Production values (highest priority in prod) |

Load order in `server.js`:
- `NODE_ENV=production` → `.env.prod` then `.env`
- otherwise → `.env.local` then `.env`

First file wins; `dotenv` does not override already-set vars.

## Variables

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default 5000) |
| `JWT_SECRET` | JWT signing secret — must be changed in prod |
| `DB_PATH` | Path to SQLite database file |
