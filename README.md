# Kigombo

Banka v2 — a personal finance app. Monorepo with frontend and backend as separate sub-projects.

## Structure

```
kigombo/
├── fe/                  # Vanilla JS SPA
├── be/                  # Express REST API + SQLite
│   ├── .env.example     # Committed — copy this to get started
│   ├── .env             # Dev defaults (gitignored)
│   ├── .env.local       # Local overrides (gitignored)
│   └── .env.prod        # Production values (gitignored)
└── Caddyfile            # Caddy reverse proxy config
```

---

## Development

### 1. Environment

```bash
cd be
cp .env.example .env        # base defaults
cp .env.example .env.local  # your local overrides (optional)
```

Edit `.env.local` to override anything in `.env`. Values in `.env.local` take priority.

### 2. Backend

```bash
cd be
npm install
npm run dev   # watch mode — restarts on file changes
```

Runs on `http://localhost:5000`.

### 3. Frontend

```bash
npx serve fe/ -p 3000
```

Open `http://localhost:3000`. The frontend talks to `http://localhost:5000/api` by default (see `serverUrl` in `fe/app.js`).

---

## Production (Ubuntu + PM2 + Caddy)

### Prerequisites

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Caddy
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

### 1. Clone and install

```bash
cd /opt
sudo git clone https://github.com/ahmad1284/kigombo.git
sudo chown -R $USER:$USER /opt/kigombo
cd /opt/kigombo/be
npm install --omit=dev
```

### 2. Production env file

```bash
cp .env.example .env.prod
```

Edit `.env.prod`:

```bash
PORT=5000
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
DB_PATH=/var/lib/kigombo/banka.db
```

Create the DB directory:

```bash
sudo mkdir -p /var/lib/kigombo
sudo chown $USER:$USER /var/lib/kigombo
```

### 3. PM2

```bash
cd /opt/kigombo/be

# Start with production env
pm2 start ecosystem.config.js --env production

# Save process list and enable startup on boot
pm2 save
pm2 startup   # follow the printed command to install the init hook
```

Useful commands:

```bash
pm2 status          # check running processes
pm2 logs kigombo    # tail logs
pm2 restart kigombo # restart after a deploy
```

### 4. Caddy

Edit `/opt/kigombo/Caddyfile` — replace `your-domain.com` with your actual domain:

```
your-domain.com {
    root * /opt/kigombo/fe
    file_server

    reverse_proxy /api/* localhost:5000
}
```

Then:

```bash
sudo cp /opt/kigombo/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy handles TLS automatically via Let's Encrypt — nothing extra needed.

Update `serverUrl` in `fe/app.js` to match your domain:

```js
const serverUrl = 'https://your-domain.com/api';
```

### Updating

```bash
cd /opt/kigombo
git pull
cd be && npm install --omit=dev
pm2 restart kigombo
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port the API listens on |
| `JWT_SECRET` | `dev-secret-...` | Secret for signing JWTs — **always change in prod** |
| `DB_PATH` | `./banka.db` | Path to the SQLite database file |

### Load order

`server.js` loads env files in this order (later values do **not** override earlier ones):

| `NODE_ENV` | Files loaded |
|---|---|
| unset / `development` | `.env.local` → `.env` |
| `production` | `.env.prod` → `.env` |

---

## API

All routes require `Authorization: Bearer <token>` except register and login.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/accounts` | — | Register — creates user + Default wallet |
| `POST` | `/api/accounts/login` | — | Login, returns JWT |
| `GET` | `/api/wallets` | ✓ | List wallets |
| `POST` | `/api/wallets` | ✓ | Create wallet |
| `GET` | `/api/wallets/:id` | ✓ | Wallet detail + paginated transactions |
| `PUT` | `/api/wallets/:id` | ✓ | Update wallet name / description / currency |
| `DELETE` | `/api/wallets/:id` | ✓ | Delete wallet |
| `GET` | `/api/wallets/:id/summary` | ✓ | Weekly income / expenses / net |
| `POST` | `/api/wallets/:id/transactions` | ✓ | Add transaction |
| `DELETE` | `/api/wallets/:id/transactions/:txId` | ✓ | Remove transaction |

Pagination and filtering:

```
GET /api/wallets/:id?page=1&limit=20&category=Food
```
