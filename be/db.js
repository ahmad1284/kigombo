const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'banka.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT '$',
    description TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_user TEXT NOT NULL REFERENCES accounts(user) ON DELETE CASCADE,
    date TEXT NOT NULL,
    object TEXT NOT NULL,
    amount REAL NOT NULL
  );
`);

module.exports = db;
