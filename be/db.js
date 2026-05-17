const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'banka.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Core schema
db.exec(`
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
`);

// One-time migration from v1 accounts schema
const hasOldAccounts = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
).get();

if (hasOldAccounts) {
  db.exec(`
    INSERT OR IGNORE INTO users (user, password_hash)
      SELECT user, password_hash FROM accounts;

    INSERT OR IGNORE INTO wallets (user, name, currency, description, balance)
      SELECT user, 'Default', currency, description, balance FROM accounts;
  `);

  // Migrate old transactions (account_user column) to wallet_id
  const oldTxCols = db
    .prepare("PRAGMA table_info(transactions)")
    .all()
    .map(r => r.name);

  if (oldTxCols.includes('account_user')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions_new (
        id TEXT PRIMARY KEY,
        wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        object TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL DEFAULT 'Other'
      );

      INSERT OR IGNORE INTO transactions_new (id, wallet_id, date, object, amount, category)
        SELECT t.id, w.id, t.date, t.object, t.amount, 'Other'
        FROM transactions t
        JOIN wallets w ON w.user = t.account_user AND w.name = 'Default';

      DROP TABLE transactions;
      ALTER TABLE transactions_new RENAME TO transactions;
      DROP TABLE accounts;
    `);
  }
}

module.exports = db;
