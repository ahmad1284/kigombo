# Kigombo

Banka v2 — a simple personal banking app. Monorepo with frontend and backend kept as separate sub-projects.

## Structure

```
kigombo/
├── fe/   # Vanilla JS SPA
└── be/   # Express REST API + SQLite
```

## Backend (`be/`)

Node.js + Express. Uses the built-in `node:sqlite` module (Node.js ≥ 22.5) — no native compilation needed.

### Setup

```bash
cd be
npm install
npm start        # production
npm run dev      # watch mode
```

Runs on port `5000` by default. Set `PORT` to override.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port |
| `JWT_SECRET` | `change-me-in-production` | Secret used to sign JWTs |
| `DB_PATH` | `./banka.db` | Path to SQLite database file |

### API

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/accounts` | — | Register a new account |
| `POST` | `/api/accounts/login` | — | Login, returns JWT |
| `GET` | `/api/accounts/:user` | Bearer | Get account + transactions |
| `DELETE` | `/api/accounts/:user` | Bearer | Delete account |
| `POST` | `/api/accounts/:user/transactions` | Bearer | Add a transaction |
| `DELETE` | `/api/accounts/:user/transactions/:id` | Bearer | Remove a transaction |

## Frontend (`fe/`)

Plain HTML/CSS/JS — no build step. Serves as static files.

### Setup

```bash
# Any static file server works, e.g.:
npx serve fe/
# or
python3 -m http.server 8080 -d fe/
```

Point the `serverUrl` constant in `fe/app.js` at your backend URL before deploying.

## Development

```bash
# Terminal 1 — backend
cd be && npm run dev

# Terminal 2 — frontend
npx serve fe/
```
