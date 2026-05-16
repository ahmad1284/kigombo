# Plan 2 — Multiple Wallets & Financial Features

## Sequence

1. **Database** — migrate schema (`be/db.js`)
2. **Backend** — rewrite routes (`be/server.js`)
3. **Frontend** — rewrite views (`fe/app.js`, `fe/index.html`, `fe/style.css`)
4. **Commit** spec + plan, then implementation commits

---

## Phase 1 — Database (`be/db.js`)

### New schema

```sql
CREATE TABLE IF NOT EXISTS users (
  user TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL REFERENCES users(user) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT '$',
  description TEXT NOT NULL DEFAULT '',
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  object TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other'
);
```

### Migration (runs once on startup)

```sql
-- 1. Create users from accounts if not exists
INSERT OR IGNORE INTO users (user, password_hash)
  SELECT user, password_hash FROM accounts;

-- 2. Create wallets from accounts if not exists
INSERT OR IGNORE INTO wallets (id, user, name, currency, description, balance)
  SELECT id, user, 'Default', currency, description, balance FROM accounts;

-- 3. Copy transactions using wallet id (accounts.id matches wallets.id post-insert)
INSERT OR IGNORE INTO transactions (id, wallet_id, date, object, amount, category)
  SELECT t.id, w.id, t.date, t.object, t.amount, 'Other'
  FROM old_transactions t
  JOIN accounts a ON t.account_user = a.user
  JOIN wallets w ON w.user = a.user AND w.name = 'Default';
```

Migration is wrapped in a check: if `users` table already exists and has rows, skip.

---

## Phase 2 — Backend (`be/server.js`)

### Auth routes (unchanged paths)
- `POST /api/accounts` — register → inserts into `users` + creates "Default" wallet
- `POST /api/accounts/login` — verify password, return JWT

### Wallet routes
```
GET    /api/wallets
POST   /api/wallets
GET    /api/wallets/:id          ?page ?limit ?category
PUT    /api/wallets/:id
DELETE /api/wallets/:id
GET    /api/wallets/:id/summary
POST   /api/wallets/:id/transactions
DELETE /api/wallets/:id/transactions/:txId
```

### Running balance calculation
Computed at query time by ordering transactions by date ASC, then accumulating.  
On paginated responses, the starting balance for the page is: wallet.balance adjusted back from all transactions _after_ the page window.  
Simpler approach (chosen for now): fetch all transactions, compute running balances in JS on the server, then slice the page. Acceptable since SQLite is in-process.

### Weekly summary
- Week = Mon–Sun containing today
- `SELECT SUM(amount) FROM transactions WHERE wallet_id=? AND date >= weekStart AND date <= weekEnd`
- Split into income (amount > 0) and expenses (amount < 0)

### Ownership check helper
```js
function getWalletForUser(id, user) {
  return db.prepare('SELECT * FROM wallets WHERE id=? AND user=?').get(id, user);
}
```

---

## Phase 3 — Frontend

### Router update
```js
'/wallets':     { templateId: 'walletList',   init: loadWallets },
'/wallets/:id': { templateId: 'walletDetail', init: loadWallet  },
```
Simple path-param parsing via regex on `window.location.pathname`.

### New API calls
```js
getWallets()
createWallet(data)
updateWallet(id, data)
deleteWallet(id)
getWalletDetail(id, { page, limit, category })
addTransaction(walletId, data)
deleteTransaction(walletId, txId)
getWeeklySummary(walletId)
```

### Templates (in `index.html`)
1. `#wallet-list` — cards grid + create dialog
2. `#wallet-detail` — summary panel + filter tabs + table + pagination + add-transaction dialog

### State shape
```js
{
  user: { user, token },
  wallets: [],                  // list view
  currentWallet: null,          // detail view
  currentPage: 1,
  currentCategory: 'All',
  pagination: {}
}
```

### Style additions
- `.wallet-cards` — flex grid of wallet cards
- `.wallet-card` — individual card (name, balance, currency)
- `.summary-panel` — weekly summary strip
- `.category-tabs` — horizontal tab bar
- `.pagination` — prev/next controls

---

## File changes

| File | Change |
|---|---|
| `be/db.js` | New schema + migration |
| `be/server.js` | Full rewrite of routes |
| `fe/index.html` | Add wallet-list and wallet-detail templates |
| `fe/app.js` | New router, state, and API layer |
| `fe/style.css` | Cards, summary panel, tabs, pagination |

---

## Commit plan

```
[Spec 2] chore: add spec and plan for wallets feature
[Spec 2][Phase: implement] feat: migrate db schema to users + wallets
[Spec 2][Phase: implement] feat: add wallet and transaction API routes
[Spec 2][Phase: implement] feat: rewrite frontend for multi-wallet views
[Spec 2][Phase: review] chore: add review
```
