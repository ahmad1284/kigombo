# Review 2 — Multiple Wallets & Financial Features

## Outcome

All acceptance criteria from the spec are met and verified by manual smoke tests. Two post-review additions were made during the same iteration: modal UX improvements and a security dependency upgrade.

## What was built

| Area | Decision | Rationale |
|---|---|---|
| Running balance | Computed server-side over full transaction list, then page-sliced | Simpler than incremental SQL; acceptable since SQLite is in-process and lists are short |
| Weekly summary | Mon–Sun window computed from UTC `new Date()` | Consistent across server timezones; can be made configurable later |
| Categories | Predefined enum on server, validated on insert | Prevents garbage data; "Other" as fallback keeps it flexible |
| Pagination | `?page&limit&category` query params | Standard REST pattern; category filter runs in JS after DB fetch (fast enough for typical wallet sizes) |
| Migration | One-time block guarded by `accounts` table existence check | Safe to run on existing DBs; idempotent |

## Post-review additions (same branch)

### Modal UX overhaul
The initial transaction dialog used a bare number input with an "(use negative for expense)" instruction — poor UX. Replaced with:
- Income / Expense toggle buttons (green / red) that control the sign automatically
- Currency-prefixed amount input (always positive, sign applied on submit)
- Field reordered: type → amount → description → category → date
- Amount field formats to `1,234.56` on blur, strips back to raw on focus
- `Intl.NumberFormat` applied to all monetary displays: wallet cards, header balance, summary panel, transaction table amounts and running balance column

### Security: bcrypt v6
`bcrypt@5` carried three high-severity vulns via `@mapbox/node-pre-gyp → tar`. Upgraded to `bcrypt@6` which replaces that dependency chain entirely — dropped 55 packages, `npm audit` now reports 0 vulnerabilities.

## What was cut
- Category filter runs in JS not SQL — fine for hundreds of transactions, would need an index + SQL `WHERE` for tens of thousands
- Edit wallet dialog still uses `prompt()` — should become a proper inline dialog in a follow-up

## Follow-up items
1. Move category filtering to SQL (`WHERE category = ?`) with an index for scale
2. Replace `prompt()` edit flow with a real dialog
3. Add `created_at` ordering tiebreaker index on transactions for deterministic pagination
4. Consider exposing `weekStart`/`weekEnd` as query params on `/summary` for historical weeks
5. Add toast/snackbar feedback for delete actions instead of `alert()`
