const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const port = process.env.PORT || 5000;
const apiPrefix = '/api';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const SALT_ROUNDS = 10;

const CATEGORIES = ['Income', 'Food', 'Transport', 'Housing', 'Health', 'Entertainment', 'Shopping', 'Other'];

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = [
  /http:\/\/(127(\.\d){3}|localhost)/,
  'https://banka-chi.vercel.app',
  'https://kigombo.live',
  'https://kigombo.vercel.app',
  'https://kigombo.gohimma.xyz'
];
app.use(cors({ origin: allowedOrigins }));
app.options('*', cors());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function getWalletForUser(walletId, user) {
  return db.prepare('SELECT * FROM wallets WHERE id = ? AND user = ?').get(walletId, user);
}

// Compute running balances for a transaction list ordered oldest→newest.
// startingBalance is the balance before the first transaction in the list.
function withRunningBalance(transactions, startingBalance) {
  let running = startingBalance;
  return transactions.map(tx => {
    running += tx.amount;
    return { ...tx, runningBalance: Math.round(running * 100) / 100 };
  });
}

// ISO week Mon–Sun containing a given YYYY-MM-DD date string
function currentWeekBounds() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + diffToMon);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return {
    start: mon.toISOString().slice(0, 10),
    end: sun.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = express.Router();

router.get('/', (req, res) => res.send('Banka API v2'));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// Register
router.post('/accounts', async (req, res) => {
  const { user, password, currency, description, balance } = req.body;

  if (!user || !password || !currency) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  if (db.prepare('SELECT user FROM users WHERE user = ?').get(user)) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const parsedBalance = parseFloat(balance) || 0;
  if (isNaN(parsedBalance)) return res.status(400).json({ error: 'Balance must be a number' });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const desc = description || `${user}'s budget`;

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO users (user, password_hash) VALUES (?, ?)').run(user, passwordHash);
    db.prepare(
      'INSERT INTO wallets (user, name, currency, description, balance) VALUES (?, ?, ?, ?, ?)'
    ).run(user, 'Default', currency, desc, parsedBalance);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const wallet = db.prepare('SELECT * FROM wallets WHERE user = ? AND name = ?').get(user, 'Default');
  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '24h' });
  return res.status(201).json({ user, token, defaultWalletId: wallet.id });
});

// Login
router.post('/accounts/login', async (req, res) => {
  const { user, password } = req.body;
  if (!user || !password) return res.status(400).json({ error: 'Missing parameters' });

  const record = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
  if (!record) return res.status(404).json({ error: 'Username or password does not exist' });

  const valid = await bcrypt.compare(password, record.password_hash);
  if (!valid) return res.status(401).json({ error: 'Username or password does not exist' });

  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '24h' });
  return res.json({ user, token });
});

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

// List wallets
router.get('/wallets', requireAuth, (req, res) => {
  const wallets = db
    .prepare('SELECT id, name, currency, description, balance, created_at FROM wallets WHERE user = ? ORDER BY created_at ASC')
    .all(req.user.user);
  return res.json({ wallets });
});

// Create wallet
router.post('/wallets', requireAuth, (req, res) => {
  const { name, currency, description, balance } = req.body;
  if (!name || !currency) return res.status(400).json({ error: 'Missing parameters' });

  const parsedBalance = parseFloat(balance) || 0;
  if (isNaN(parsedBalance)) return res.status(400).json({ error: 'Balance must be a number' });

  const result = db.prepare(
    'INSERT INTO wallets (user, name, currency, description, balance) VALUES (?, ?, ?, ?, ?)'
  ).run(req.user.user, name, currency, description || '', parsedBalance);

  const wallet = db.prepare('SELECT * FROM wallets WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(wallet);
});

// Get wallet detail with paginated + filtered transactions
router.get('/wallets/:id', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const category = req.query.category && req.query.category !== 'All' ? req.query.category : null;
  const offset = (page - 1) * limit;

  // All transactions ordered oldest→newest for running balance
  const allTx = db.prepare(
    'SELECT * FROM transactions WHERE wallet_id = ? ORDER BY date ASC, rowid ASC'
  ).all(wallet.id);

  // Filter by category if requested
  const filtered = category ? allTx.filter(tx => tx.category === category) : allTx;
  const total = filtered.length;

  // Compute running balance across ALL transactions (unfiltered) to get correct balance at each point
  let runningMap = {};
  let running = 0;
  for (const tx of allTx) {
    running += tx.amount;
    runningMap[tx.id] = Math.round(running * 100) / 100;
  }

  // Slice page from filtered list and attach running balance
  const pageTx = filtered.slice(offset, offset + limit).map(tx => ({
    id: tx.id,
    date: tx.date,
    object: tx.object,
    amount: tx.amount,
    category: tx.category,
    runningBalance: runningMap[tx.id],
  }));

  return res.json({
    id: wallet.id,
    name: wallet.name,
    currency: wallet.currency,
    description: wallet.description,
    balance: wallet.balance,
    transactions: pageTx,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  });
});

// Update wallet
router.put('/wallets/:id', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const name = req.body.name || wallet.name;
  const currency = req.body.currency || wallet.currency;
  const description = req.body.description !== undefined ? req.body.description : wallet.description;

  db.prepare('UPDATE wallets SET name = ?, currency = ?, description = ? WHERE id = ?')
    .run(name, currency, description, wallet.id);

  return res.json({ ...wallet, name, currency, description });
});

// Delete wallet
router.delete('/wallets/:id', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  db.prepare('DELETE FROM wallets WHERE id = ?').run(wallet.id);
  return res.sendStatus(204);
});

// Weekly summary
router.get('/wallets/:id/summary', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const { start, end } = currentWeekBounds();

  const rows = db.prepare(
    'SELECT amount FROM transactions WHERE wallet_id = ? AND date >= ? AND date <= ?'
  ).all(wallet.id, start, end);

  let income = 0, expenses = 0;
  for (const r of rows) {
    if (r.amount > 0) income += r.amount;
    else expenses += r.amount;
  }

  return res.json({
    weekStart: start,
    weekEnd: end,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    net: Math.round((income + expenses) * 100) / 100,
  });
});

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

// Add transaction
router.post('/wallets/:id/transactions', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const { date, object, amount, category } = req.body;
  if (!date || !object || amount === undefined) return res.status(400).json({ error: 'Missing parameters' });

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) return res.status(400).json({ error: 'Amount must be a number' });

  const cat = CATEGORIES.includes(category) ? category : 'Other';
  const id = crypto.createHash('md5').update(date + object + amount + wallet.id).digest('hex');

  if (db.prepare('SELECT id FROM transactions WHERE id = ?').get(id)) {
    return res.status(409).json({ error: 'Transaction already exists' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO transactions (id, wallet_id, date, object, amount, category) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, wallet.id, date, object, parsedAmount, cat);
    db.prepare('UPDATE wallets SET balance = balance + ? WHERE id = ?').run(parsedAmount, wallet.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return res.status(201).json({ id, date, object, amount: parsedAmount, category: cat });
});

// Delete transaction
router.delete('/wallets/:id/transactions/:txId', requireAuth, (req, res) => {
  const wallet = getWalletForUser(req.params.id, req.user.user);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND wallet_id = ?').get(req.params.txId, wallet.id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(tx.id);
    db.prepare('UPDATE wallets SET balance = balance - ? WHERE id = ?').run(tx.amount, wallet.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return res.sendStatus(204);
});

// Expose available categories
router.get('/categories', (req, res) => res.json({ categories: CATEGORIES }));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.use(apiPrefix, router);
app.listen(port, () => console.log(`Banka API v2 listening on port ${port}`));
