# Spec 2 — Multiple Wallets & Financial Features

## Problem

The current app gives every user exactly one account. There is no way to separate money for different purposes, no transaction categories, no running balance, and no summary view. It is a bare ledger with no financial insight.

## Goal

Let each user own multiple named wallets. Add categories, running balance, and a weekly summary to make the wallet view useful as a lightweight personal finance tool.

## Scope

### In scope
- Multiple wallets per user (CRUD)
- Paginated transaction list (20/page, filterable by category)
- Transaction category field (predefined list + "Other")
- Running balance column per transaction
- Weekly summary panel (income / expenses / net for the current Mon–Sun week)
- Schema migration that preserves existing accounts as wallets

### Out of scope
- Budgets / budget targets
- Recurring transactions
- Charts / graphs
- Multi-currency conversion
- Export to CSV

## Data model

### Users table (unchanged)
Holds login credentials. One row per user.

### Wallets table (new — replaces `accounts`)
| column | type | notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| user | TEXT FK → users.user | owner |
| name | TEXT | "Savings", "Daily", etc. |
| currency | TEXT | "$", "€", … |
| description | TEXT | optional label |
| balance | REAL | maintained by server |
| created_at | TEXT | ISO-8601 |

### Transactions table (updated)
| column | type | notes |
|---|---|---|
| id | TEXT PK | md5 hash |
| wallet_id | INTEGER FK → wallets.id | replaces account_user |
| date | TEXT | YYYY-MM-DD |
| object | TEXT | description |
| amount | REAL | positive = credit, negative = debit |
| category | TEXT | one of the predefined set, default "Other" |

### Predefined categories
`Income`, `Food`, `Transport`, `Housing`, `Health`, `Entertainment`, `Shopping`, `Other`

## API surface

All routes require `Authorization: Bearer <token>` except register/login.

### Wallets
```
GET    /api/wallets                 list user's wallets
POST   /api/wallets                 create wallet
GET    /api/wallets/:id             get wallet + paginated transactions
PUT    /api/wallets/:id             update wallet name/description/currency
DELETE /api/wallets/:id             delete wallet (cascades transactions)
```

### Transactions
```
POST   /api/wallets/:id/transactions        add transaction
DELETE /api/wallets/:id/transactions/:txId  remove transaction
```

### Summary
```
GET    /api/wallets/:id/summary     weekly summary (income, expenses, net)
```

### Pagination query params
`GET /api/wallets/:id?page=1&limit=20&category=Food`

### Response: wallet detail
```json
{
  "id": 1,
  "name": "Daily spending",
  "currency": "$",
  "description": "...",
  "balance": 120.50,
  "transactions": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 47, "pages": 3 }
}
```

### Response: transaction row
```json
{
  "id": "abc123",
  "date": "2026-05-16",
  "object": "Coffee",
  "amount": -4.50,
  "category": "Food",
  "runningBalance": 116.00
}
```

### Response: weekly summary
```json
{
  "weekStart": "2026-05-12",
  "weekEnd": "2026-05-18",
  "income": 500.00,
  "expenses": -84.50,
  "net": 415.50
}
```

## Frontend views

### 1. Login / Register (unchanged UX, same page)

### 2. Wallet list (`/wallets`)
- Cards for each wallet showing name, currency, balance
- "+ New wallet" button → inline form or dialog
- Click wallet → navigate to `/wallets/:id`

### 3. Wallet detail (`/wallets/:id`)
- Header: wallet name, balance, currency, edit/delete buttons
- Weekly summary panel (income / expenses / net)
- Category filter tabs (All | Income | Food | Transport | …)
- Transaction table: Date | Object | Category | Amount | Balance
- Pagination controls (prev / next / page n of N)
- "+ Add transaction" button → dialog (date, object, category, amount)

## Migration strategy

Existing `accounts` rows become wallets. A `users` table is created from `accounts` (keeping `user` + `password_hash`). The old `transactions.account_user` becomes `transactions.wallet_id` via a join. Category defaults to `"Other"`.

## Non-goals / constraints
- No breaking change to the JWT auth mechanism
- Frontend stays vanilla JS, no framework introduced
- No build step
