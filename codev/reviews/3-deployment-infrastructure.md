# Review 3 — Deployment Infrastructure

## Outcome

All files in the plan were created/updated. The server loads env correctly in both dev and production modes. `npm audit` still reports 0 vulnerabilities after adding `dotenv`.

## Decisions

| Decision | Rationale |
|---|---|
| `node --watch` over `nodemon` | Built-in since Node 18, removes a dev dependency; behaviour is identical for this use case |
| `dotenv` v17 with `quiet: true` | Suppresses noisy injection logs that dotenv 17 emits by default |
| Caddy over nginx | Zero config TLS, single binary, simpler reverse proxy syntax |
| PM2 over systemd | Easier log access (`pm2 logs`), built-in restart/reload, no root needed for setup |
| `.env.example` committed | Standard convention; gives new contributors a working starting point without leaking secrets |

## What was not done
- No `dotenv-flow` or `dotenv-vault` — plain `dotenv` with manual file selection is simple enough for this scale
- No Docker setup — out of scope per spec
- `nodemon` left in `devDependencies` in `package.json` as a user-retained dependency; the dev script no longer calls it but it doesn't cause harm

## Follow-up items
1. Remove `nodemon` from `devDependencies` if it is confirmed unused
2. Add a `pm2 logrotate` setup note to the README for long-running servers
3. Consider a `Makefile` or `package.json` root-level scripts for common ops tasks (`deploy`, `logs`, `restart`)
