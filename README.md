# Kigombo

Banka v2 — a personal finance app. Monorepo with frontend and backend kept as separate sub-projects.

## Structure

```
kigombo/
├── fe/   # Vanilla JS SPA
└── be/   # Express REST API + SQLite
```

---

## Development

### Prerequisites
- Node.js ≥ 22.5 (uses built-in `node:sqlite`)
- Any static file server (e.g. `npx serve`)

### 1. Backend

```bash
cd be
npm install
npm run dev        # watch mode — restarts on file changes
```

Runs on `http://localhost:5000`. The SQLite database (`banka.db`) is created automatically on first start.

### 2. Frontend

```bash
# From repo root — serve the fe/ directory on any port
npx serve fe/ -p 3000
# or
python3 -m http.server 3000 -d fe/
```

Open `http://localhost:3000`. The frontend talks to `http://localhost:5000` by default (see `serverUrl` in `fe/app.js`).

### Environment variables (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `JWT_SECRET` | `change-me-in-production` | Secret for signing JWTs — **change this** |
| `DB_PATH` | `./banka.db` | Path to SQLite database file |

---

## Production (Ubuntu bare metal)

### Prerequisites

```bash
# Node.js 22 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# nginx + git
sudo apt-get install -y nginx git
```

### 1. Clone and install

```bash
cd /opt
sudo git clone https://github.com/ahmad1284/kigombo.git
sudo chown -R $USER:$USER /opt/kigombo
cd /opt/kigombo/be
npm install --omit=dev
```

### 2. Environment file

```bash
sudo mkdir -p /etc/kigombo
sudo tee /etc/kigombo/env <<'EOF'
PORT=5000
JWT_SECRET=<generate a long random string>
DB_PATH=/var/lib/kigombo/banka.db
EOF
sudo chmod 600 /etc/kigombo/env

# Create DB directory
sudo mkdir -p /var/lib/kigombo
sudo chown $USER:$USER /var/lib/kigombo
```

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

### 3. systemd service

```bash
sudo tee /etc/systemd/system/kigombo.service <<'EOF'
[Unit]
Description=Kigombo API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/kigombo/be
EnvironmentFile=/etc/kigombo/env
ExecStart=/usr/bin/node --experimental-sqlite server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R www-data:www-data /var/lib/kigombo
sudo systemctl daemon-reload
sudo systemctl enable --now kigombo
sudo systemctl status kigombo
```

### 4. nginx

Serve the frontend as static files and reverse-proxy `/api` to the backend.

```bash
sudo tee /etc/nginx/sites-available/kigombo <<'EOF'
server {
    listen 80;
    server_name your-domain.com;   # replace or use _ for any

    # Frontend — static files
    root /opt/kigombo/fe;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend — proxy /api to Node
    location /api {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/kigombo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Update `serverUrl` in `fe/app.js` to match your domain:

```js
// fe/app.js
const serverUrl = 'https://your-domain.com/api';
```

### 5. TLS (recommended)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot will auto-update the nginx config and schedule renewal.

### Updating

```bash
cd /opt/kigombo
git pull
cd be && npm install --omit=dev
sudo systemctl restart kigombo
```

---

## API

All routes require `Authorization: Bearer <token>` except register/login.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/accounts` | — | Register — creates user + Default wallet |
| `POST` | `/api/accounts/login` | — | Login, returns JWT |
| `GET` | `/api/wallets` | ✓ | List wallets |
| `POST` | `/api/wallets` | ✓ | Create wallet |
| `GET` | `/api/wallets/:id` | ✓ | Wallet detail + paginated transactions |
| `PUT` | `/api/wallets/:id` | ✓ | Update wallet name/description/currency |
| `DELETE` | `/api/wallets/:id` | ✓ | Delete wallet |
| `GET` | `/api/wallets/:id/summary` | ✓ | Weekly income/expenses/net |
| `POST` | `/api/wallets/:id/transactions` | ✓ | Add transaction |
| `DELETE` | `/api/wallets/:id/transactions/:txId` | ✓ | Remove transaction |

### Pagination & filtering

```
GET /api/wallets/:id?page=1&limit=20&category=Food
```
