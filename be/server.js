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
// Auth middleware
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const router = express.Router();

router.get('/', (req, res) => res.send('Banka API v2'));

// Register
router.post('/accounts', async (req, res) => {
  const { user, password, currency, description, balance } = req.body;

  if (!user || !password || !currency) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const existing = db.prepare('SELECT user FROM accounts WHERE user = ?').get(user);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  let parsedBalance = parseFloat(balance) || 0;
  if (isNaN(parsedBalance)) {
    return res.status(400).json({ error: 'Balance must be a number' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const desc = description || `${user}'s budget`;

  db.prepare(
    'INSERT INTO accounts (user, password_hash, currency, description, balance) VALUES (?, ?, ?, ?, ?)'
  ).run(user, passwordHash, currency, desc, parsedBalance);

  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '24h' });
  return res.status(201).json({
    user,
    currency,
    description: desc,
    balance: parsedBalance,
    transactions: [],
    token
  });
});

// Login
router.post('/accounts/login', async (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE user = ?').get(user);
  if (!account) {
    return res.status(404).json({ error: 'Username or password does not exist' });
  }

  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Username or password does not exist' });
  }

  const transactions = db
    .prepare('SELECT id, date, object, amount FROM transactions WHERE account_user = ? ORDER BY date ASC')
    .all(user);

  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '24h' });
  return res.json({
    user: account.user,
    currency: account.currency,
    description: account.description,
    balance: account.balance,
    transactions,
    token
  });
});

// Get account (requires auth, can only fetch own account)
router.get('/accounts/:user', requireAuth, (req, res) => {
  if (req.user.user !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE user = ?').get(req.params.user);
  if (!account) {
    return res.status(404).json({ error: 'User does not exist' });
  }

  const transactions = db
    .prepare('SELECT id, date, object, amount FROM transactions WHERE account_user = ? ORDER BY date ASC')
    .all(req.params.user);

  return res.json({
    user: account.user,
    currency: account.currency,
    description: account.description,
    balance: account.balance,
    transactions
  });
});

// Delete account (requires auth)
router.delete('/accounts/:user', requireAuth, (req, res) => {
  if (req.user.user !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const result = db.prepare('DELETE FROM accounts WHERE user = ?').run(req.params.user);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User does not exist' });
  }
  return res.sendStatus(204);
});

// Add transaction (requires auth)
router.post('/accounts/:user/transactions', requireAuth, (req, res) => {
  if (req.user.user !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const account = db.prepare('SELECT * FROM accounts WHERE user = ?').get(req.params.user);
  if (!account) {
    return res.status(404).json({ error: 'User does not exist' });
  }

  const { date, object, amount } = req.body;
  if (!date || !object || amount === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) {
    return res.status(400).json({ error: 'Amount must be a number' });
  }

  const id = crypto.createHash('md5').update(date + object + amount).digest('hex');

  const existing = db.prepare('SELECT id FROM transactions WHERE id = ?').get(id);
  if (existing) {
    return res.status(409).json({ error: 'Transaction already exists' });
  }

  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO transactions (id, account_user, date, object, amount) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.params.user, date, object, parsedAmount);
    db.prepare('UPDATE accounts SET balance = balance + ? WHERE user = ?').run(parsedAmount, req.params.user);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return res.status(201).json({ id, date, object, amount: parsedAmount });
});

// Delete transaction (requires auth)
router.delete('/accounts/:user/transactions/:id', requireAuth, (req, res) => {
  if (req.user.user !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const transaction = db
    .prepare('SELECT * FROM transactions WHERE id = ? AND account_user = ?')
    .get(req.params.id, req.params.user);

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction does not exist' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    db.prepare('UPDATE accounts SET balance = balance - ? WHERE user = ?').run(transaction.amount, req.params.user);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.use(apiPrefix, router);
app.listen(port, () => console.log(`Banka API v2 listening on port ${port}`));
