# Review 2 — Multiple Wallets & Financial Features

## Outcome

All five acceptance criteria from the spec are met and verified by manual smoke tests.

## What was built

| Area | Decision | Rationale |
|---|---|---|
| Running balance | Computed server-side over full transaction list, then page-sliced | Simpler than incremental SQL; acceptable since SQLite is in-process and lists are short |
| Weekly summary | Mon–Sun window computed from UTC `new Date()` | Consistent across server timezones; can be made configurable later |
| Categories | Predefined enum on server, validated on insert | Prevents garbage data; "Other" as fallback keeps it flexible |
| Pagination | `?page&limit&category` query params | Standard REST pattern; category filter runs in JS after DB fetch (fast enough for typical wallet sizes) |
| Migration | One-time block guarded by `accounts` table existence check | Safe to run on existing DBs; idempotent |

## What was cut
- Category filter runs in JS not SQL — fine for hundreds of transactions, would need an index + SQL WHERE clause for tens of thousands
- Edit wallet dialog uses `prompt()` — quick but not polished; should become a proper form in a future iteration
- No toast/snackbar feedback on delete — errors surfaced via `alert()` for now

## Follow-up items
1. Move category filtering to SQL (`WHERE category = ?`) with an index for scale
2. Replace `prompt()` edit flow with an inline dialog like the create-wallet dialog
3. Add `created_at` ordering tiebreaker index on transactions for deterministic pagination
4. Consider exposing `weekStart`/`weekEnd` as query params on `/summary` for historical weeks
