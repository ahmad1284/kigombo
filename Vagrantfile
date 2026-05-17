# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "generic/ubuntu2204"

  config.vm.provider :libvirt do |v|
    v.memory = 1024
    v.cpus = 2
  end

  # ─────────────────────────────────────────────────────────────────────────
  # dev: node --watch backend on :5000, serve frontend on :3000
  # Access: http://localhost:3000 (UI), http://localhost:5000/api (API)
  # ─────────────────────────────────────────────────────────────────────────
  config.vm.define "dev" do |dev|
    dev.vm.hostname = "kigombo-dev"
    dev.vm.network "forwarded_port", guest: 5000, host: 5000, host_ip: "127.0.0.1"
    dev.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "127.0.0.1"
    dev.vm.synced_folder ".", "/vagrant", type: "rsync",
      rsync__exclude: [".git/", ".vagrant/", "be/node_modules/", "be/banka.db*"]

    dev.vm.provision "shell", privileged: true, inline: <<~SHELL
      set -euo pipefail
      export DEBIAN_FRONTEND=noninteractive

      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs

      cd /vagrant/be
      npm install
      [ -f .env ] || cp .env.example .env

      npm install -g serve
      NODE_BIN=$(which node)
      SERVE_BIN=$(which serve)

      cat > /etc/systemd/system/kigombo-be.service <<EOF
[Unit]
Description=Kigombo backend (dev)
After=network.target

[Service]
WorkingDirectory=/vagrant/be
ExecStart=${NODE_BIN} --experimental-sqlite --watch server.js
Restart=on-failure
Environment=NODE_ENV=development

[Install]
WantedBy=multi-user.target
EOF

      cat > /etc/systemd/system/kigombo-fe.service <<EOF
[Unit]
Description=Kigombo frontend (serve)
After=network.target

[Service]
ExecStart=${SERVE_BIN} /vagrant/fe -p 3000 -s
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

      systemctl daemon-reload
      systemctl enable kigombo-be kigombo-fe
      systemctl start kigombo-be kigombo-fe

      echo "==> Dev VM ready: http://localhost:3000 (UI) | http://localhost:5000/api (API)"
    SHELL
  end

  # ─────────────────────────────────────────────────────────────────────────
  # prod: PM2 backend + Caddy reverse proxy on :80
  # Access: http://localhost:8080 (everything via Caddy)
  # ─────────────────────────────────────────────────────────────────────────
  config.vm.define "prod" do |prod|
    prod.vm.hostname = "kigombo-prod"
    prod.vm.network "forwarded_port", guest: 80, host: 8080, host_ip: "127.0.0.1"
    prod.vm.synced_folder ".", "/opt/kigombo", type: "rsync",
      rsync__exclude: [".git/", ".vagrant/", "be/node_modules/", "be/banka.db*"]

    prod.vm.provision "shell", privileged: true, inline: <<~SHELL
      set -euo pipefail
      export DEBIAN_FRONTEND=noninteractive

      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
      npm install -g pm2

      # Caddy
      apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
        gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
        tee /etc/apt/sources.list.d/caddy-stable.list
      apt-get update && apt-get install -y caddy

      # Backend
      cd /opt/kigombo/be
      npm install --omit=dev

      # Production env (fresh random JWT secret each provision)
      JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
      mkdir -p /var/lib/kigombo
      cat > /opt/kigombo/be/.env.prod <<EOF
PORT=5000
JWT_SECRET=${JWT}
DB_PATH=/var/lib/kigombo/banka.db
EOF

      # PM2 with systemd startup
      pm2 start /opt/kigombo/be/ecosystem.config.js --env production
      pm2 save
      pm2 startup systemd -u root --hp /root 2>&1 | grep 'env PATH' | sed 's/sudo //' | bash || true
      systemctl enable pm2-root 2>/dev/null || true

      # Caddy: :80 (no domain) for local testing
      cat > /etc/caddy/Caddyfile <<'CADDYEOF'
:80 {
    root * /opt/kigombo/fe
    file_server
    reverse_proxy /api/* localhost:5000
}
CADDYEOF

      systemctl reload caddy

      echo "==> Prod VM ready: http://localhost:8080"
    SHELL
  end
end
