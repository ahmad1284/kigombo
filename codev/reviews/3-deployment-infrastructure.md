# Review 3 — Deployment Infrastructure (Vagrant + serverUrl)

## Summary

Added two remaining items to complete the deployment infrastructure spec:
1. Fixed the hardcoded `serverUrl` in `fe/app.js` so it works in both dev (`:3000`) and Caddy-proxied prod (`:80`/`:8080`)
2. Added a `Vagrantfile` with two named libvirt VMs — `dev` (node --watch + serve) and `prod` (PM2 + Caddy) — for local environment verification

Also added a root `package.json` with `build` and `test` scripts to satisfy porch's CI checks, and added `.vagrant/` to `.gitignore`.

## Spec Compliance

- [x] `fe/app.js` serverUrl derived from `location` at runtime — dev uses `:5000`, prod uses Caddy path
- [x] `dev` VM: `node --experimental-sqlite --watch` backend on :5000, `serve` frontend on :3000
- [x] `prod` VM: PM2 backend + Caddy reverse proxy on :80 (host :8080)
- [x] Provider: libvirt, Box: `generic/ubuntu2204`
- [x] `.vagrant/` excluded from git

## Deviations from Plan

| Item | Deviation | Reason |
|---|---|---|
| Root `package.json` | Added (not in plan) | Porch build/test checks require `npm run build` and `npm test` at root |
| Dev service uses `node --watch` but no live rsync | rsync is one-shot at `vagrant up` | For testing purposes this is fine; live editing requires `vagrant rsync-auto` |
| `pm2 startup` approach | Used grep/sed pipe instead of running returned command verbatim | Works reliably in provision scripts running as root |

## Consultation Feedback

### Specify Phase (Round 1)

#### Gemini
Skipped by user request.

#### Codex
Skipped by user request.

#### Claude (COMMENT)
- **Concern**: `.env.example` might be excluded by `.env*` gitignore glob
  - **Rebutted**: `.gitignore` uses `.env` (exact match only), not `.env*`. No issue.
- **Concern**: serverUrl `location.port === '3000'` is brittle if dev runs on another port
  - **Rebutted**: Dev script always uses port 3000 for this project. Acceptable simplification.
- **Concern**: No production startup guard for default JWT_SECRET
  - **Rebutted**: Out of scope for this spec; the server logs the default on startup which is sufficient warning.

### Plan Phase (Round 1)

#### Gemini / Codex
Skipped by user request.

#### Claude (COMMENT)
- **Concern**: `.vagrant/` not in `.gitignore`
  - **Addressed**: Added `.vagrant/` to `.gitignore` in phase 2 scope.
- **Concern**: Caddyfile written in VM vs repo Caddyfile ambiguity
  - **Addressed**: Added clarifying note to plan.
- **Concern**: Sync type ambiguity (`virtiofs` vs `rsync`)
  - **Addressed**: Defaulted to `rsync` in plan and Vagrantfile.

### Implement Phases (Round 1)

Both phases: Claude APPROVE, Gemini/Codex skipped.

## Architecture Updates

No architecture updates needed. The Vagrantfile is a developer tooling addition (not a new subsystem or data flow). The serverUrl fix is a one-liner frontend constant change. Neither introduces new subsystems, APIs, or architectural patterns.

## Lessons Learned Updates

**Lessons added:**

1. **Porch build checks require a root `npm run build` script** — even in a monorepo where only `be/` has a `package.json`. Always add a root `package.json` with `build` and `test` delegating scripts at project setup time.

2. **Vagrant inline provision heredocs + Ruby SHELL heredoc** — inner heredocs (e.g. `cat > file <<EOF`) work fine inside Ruby's `<<~SHELL` without escaping, as long as the inner terminator (`EOF`, `CADDYEOF`) doesn't conflict with the outer `SHELL` terminator. Using `<<'CADDYEOF'` (single-quoted) for blocks that must not expand variables is the right pattern.

3. **rsync-type synced folders in Vagrant** — files sync once at `vagrant up`. `--watch` in the dev service detects no subsequent changes unless `vagrant rsync-auto` is running on the host. For testing VMs this is fine; document this if the VM is meant for active development.

## Follow-up Items

1. Add a note to README about `vagrant rsync-auto` for live-reload dev workflow
2. Consider `vagrant rsync-auto` wrapper script or Makefile target for dev convenience
3. Playwright e2e tests against the Vagrant VMs (currently manual verification only)
4. Future: EC2 deployment via remote-controlled agent (see `codev/specs/4-ec2-deployment.md`)
