# Lessons Learned — Kigombo

## Tooling

### Porch requires root-level npm scripts
Porch's `build` and `test` checks run `npm run build` and `npm test` from the project root. In a monorepo where only a subdirectory has `package.json`, add a root `package.json` with delegating scripts at project setup time — not as an afterthought when checks fail.

### Vagrant inline provision heredocs in Ruby
Inner heredocs (`cat > file <<EOF`) work fine inside Ruby's `<<~SHELL` inline provision. Use `<<'CADDYEOF'` (single-quoted) for config blocks that must not expand shell variables. Choose terminator names that won't conflict with `SHELL`.

## Vagrant

### rsync sync type: one-shot at `vagrant up`
Files sync once when the VM is created. `--watch` in a dev service sees no file changes unless `vagrant rsync-auto` runs on the host. For smoke-test VMs this is fine; document it if the VM is meant for live editing.

### PM2 startup in provision scripts
In a root-provisioned Vagrant shell, use:
```bash
pm2 startup systemd -u root --hp /root 2>&1 | grep 'env PATH' | sed 's/sudo //' | bash || true
```
The `|| true` prevents failure if pm2 is already registered.

## Frontend

### Dynamic API URL for multi-environment frontends
Avoid hardcoding API base URLs in frontend JS. For simple SPAs without a build step, derive the URL from `location` at runtime. The dev-vs-prod split (`location.port === '3000'`) is fragile for arbitrary port configs but works reliably when the dev script always uses a fixed port.
