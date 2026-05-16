// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const serverUrl = 'http://localhost:5000/api';
const tokenKey = 'authToken';
const userKey = 'authUser';

const CATEGORIES = ['All', 'Income', 'Food', 'Transport', 'Housing', 'Health', 'Entertainment', 'Shopping', 'Other'];

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routes = {
  '/login':       { templateId: 'login',         title: 'Login' },
  '/wallets':     { templateId: 'wallet-list',   title: 'My Wallets',  init: initWalletList },
  '/wallet':      { templateId: 'wallet-detail', title: 'Wallet',      init: initWalletDetail },
};

function navigate(path) {
  window.history.pushState({}, path, window.location.origin + path);
  updateRoute();
}

function updateRoute() {
  const raw = window.location.pathname;
  // normalise /wallets/3 → /wallet with id in search
  const walletMatch = raw.match(/^\/wallets\/(\d+)$/);
  const path = walletMatch ? '/wallet' : (raw === '/' ? '/wallets' : raw);
  if (walletMatch) state.currentWalletId = parseInt(walletMatch[1]);

  const route = routes[path];
  if (!route) return navigate(getToken() ? '/wallets' : '/login');

  const template = document.getElementById(route.templateId);
  const view = template.content.cloneNode(true);
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(view);
  document.title = route.title;

  if (typeof route.init === 'function') route.init();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let state = {
  currentWalletId: null,
  currentPage: 1,
  currentCategory: 'All',
};

function getToken() { return localStorage.getItem(tokenKey); }
function getUser()  { return localStorage.getItem(userKey); }

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function api(path, method, body) {
  const token = getToken();
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(serverUrl + path, { method: method || 'GET', headers, body });
    if (res.status === 204) return {};
    return await res.json();
  } catch (e) {
    return { error: e.message || 'Unknown error' };
  }
}

const Auth = {
  login: (user, password) => api('/accounts/login', 'POST', JSON.stringify({ user, password })),
  register: (data)        => api('/accounts', 'POST', JSON.stringify(data)),
};

const Wallets = {
  list:    ()               => api('/wallets'),
  create:  (data)           => api('/wallets', 'POST', JSON.stringify(data)),
  get:     (id, params)     => api(`/wallets/${id}?${new URLSearchParams(params)}`),
  update:  (id, data)       => api(`/wallets/${id}`, 'PUT', JSON.stringify(data)),
  delete:  (id)             => api(`/wallets/${id}`, 'DELETE'),
  summary: (id)             => api(`/wallets/${id}/summary`),
};

const Transactions = {
  add:    (walletId, data) => api(`/wallets/${walletId}/transactions`, 'POST', JSON.stringify(data)),
  delete: (walletId, txId) => api(`/wallets/${walletId}/transactions/${txId}`, 'DELETE'),
};

// ---------------------------------------------------------------------------
// Login / Register page
// ---------------------------------------------------------------------------

async function login() {
  const form = document.getElementById('loginForm');
  const data = await Auth.login(form.user.value, form.password.value);
  if (data.error) return setError('loginError', data.error);
  localStorage.setItem(tokenKey, data.token);
  localStorage.setItem(userKey, data.user);
  navigate('/wallets');
}

async function register() {
  const form = document.getElementById('registerForm');
  const data = await Auth.register(Object.fromEntries(new FormData(form)));
  if (data.error) return setError('registerError', data.error);
  localStorage.setItem(tokenKey, data.token);
  localStorage.setItem(userKey, data.user);
  navigate('/wallets');
}

// ---------------------------------------------------------------------------
// Wallet list page
// ---------------------------------------------------------------------------

async function initWalletList() {
  if (!getToken()) return navigate('/login');
  await renderWalletList();
}

async function renderWalletList() {
  const data = await Wallets.list();
  if (data.error) return logout();

  const grid = document.getElementById('walletGrid');
  grid.innerHTML = '';
  for (const w of data.wallets) {
    const card = document.createElement('div');
    card.className = 'wallet-card';
    card.innerHTML = `
      <div class="wallet-card-name">${esc(w.name)}</div>
      <div class="wallet-card-balance">${esc(w.currency)} ${w.balance.toFixed(2)}</div>
      <div class="wallet-card-desc">${esc(w.description)}</div>
    `;
    card.addEventListener('click', () => {
      state.currentWalletId = w.id;
      state.currentPage = 1;
      state.currentCategory = 'All';
      window.history.pushState({}, '', `/wallets/${w.id}`);
      updateRoute();
    });
    grid.appendChild(card);
  }

  setText('walletListUser', getUser() || '');
}

async function showCreateWalletDialog() {
  const dialog = document.getElementById('createWalletDialog');
  dialog.classList.add('show');
  document.getElementById('createWalletForm').reset();
}

function cancelCreateWallet() {
  document.getElementById('createWalletDialog').classList.remove('show');
}

async function confirmCreateWallet() {
  const form = document.getElementById('createWalletForm');
  const data = await Wallets.create(Object.fromEntries(new FormData(form)));
  cancelCreateWallet();
  if (data.error) return alert(data.error);
  await renderWalletList();
}

// ---------------------------------------------------------------------------
// Wallet detail page
// ---------------------------------------------------------------------------

let currentWalletData = null;

async function initWalletDetail() {
  if (!getToken()) return navigate('/login');
  await renderWalletDetail();
}

async function renderWalletDetail() {
  const id = state.currentWalletId;
  const params = { page: state.currentPage, limit: 20 };
  if (state.currentCategory !== 'All') params.category = state.currentCategory;

  const [detail, summary] = await Promise.all([
    Wallets.get(id, params),
    Wallets.summary(id),
  ]);

  if (detail.error) return navigate('/wallets');
  currentWalletData = detail;

  // Header
  setText('walletName', detail.name);
  setText('walletBalance', `${detail.currency} ${detail.balance.toFixed(2)}`);
  setText('walletDescription', detail.description);

  // Summary panel
  setText('summaryIncome',   `+ ${detail.currency}${summary.income.toFixed(2)}`);
  setText('summaryExpenses', `- ${detail.currency}${Math.abs(summary.expenses).toFixed(2)}`);
  setText('summaryNet',      `${summary.net >= 0 ? '+' : ''}${detail.currency}${summary.net.toFixed(2)}`);
  setText('summaryWeek',     `${summary.weekStart} → ${summary.weekEnd}`);
  document.getElementById('summaryNet').className =
    'summary-value ' + (summary.net >= 0 ? 'positive' : 'negative');

  // Category tabs
  const tabs = document.getElementById('categoryTabs');
  tabs.innerHTML = '';
  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.className = 'tab-btn' + (cat === state.currentCategory ? ' active' : '');
    btn.addEventListener('click', () => {
      state.currentCategory = cat;
      state.currentPage = 1;
      renderWalletDetail();
    });
    tabs.appendChild(btn);
  }

  // Transactions table
  const tbody = document.getElementById('transactions');
  tbody.innerHTML = '';
  for (const tx of detail.transactions) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(tx.date)}</td>
      <td>${esc(tx.object)}</td>
      <td><span class="category-badge cat-${tx.category.toLowerCase()}">${esc(tx.category)}</span></td>
      <td class="${tx.amount >= 0 ? 'positive' : 'negative'}">${tx.amount >= 0 ? '+' : ''}${tx.amount.toFixed(2)}</td>
      <td>${tx.runningBalance.toFixed(2)}</td>
      <td><button class="btn-icon" title="Delete" data-id="${tx.id}">✕</button></td>
    `;
    tr.querySelector('[data-id]').addEventListener('click', () => deleteTransaction(tx.id));
    tbody.appendChild(tr);
  }

  // Pagination
  const pg = detail.pagination;
  setText('pageInfo', `Page ${pg.page} of ${pg.pages}`);
  document.getElementById('btnPrev').disabled = pg.page <= 1;
  document.getElementById('btnNext').disabled = pg.page >= pg.pages;
}

async function deleteTransaction(txId) {
  const data = await Transactions.delete(state.currentWalletId, txId);
  if (data.error) return alert(data.error);
  await renderWalletDetail();
}

function prevPage() {
  if (state.currentPage > 1) { state.currentPage--; renderWalletDetail(); }
}
function nextPage() {
  if (currentWalletData && state.currentPage < currentWalletData.pagination.pages) {
    state.currentPage++;
    renderWalletDetail();
  }
}

function showAddTransactionDialog() {
  const dialog = document.getElementById('transactionDialog');
  dialog.classList.add('show');
  const form = document.getElementById('transactionForm');
  form.reset();
  form.date.valueAsDate = new Date();

  // Populate category select
  const sel = form.querySelector('[name="category"]');
  sel.innerHTML = CATEGORIES.filter(c => c !== 'All')
    .map(c => `<option value="${c}">${c}</option>`).join('');

  window.addEventListener('keydown', handleEsc);
}

function cancelAddTransaction() {
  document.getElementById('transactionDialog').classList.remove('show');
  window.removeEventListener('keydown', handleEsc);
}

async function confirmAddTransaction() {
  cancelAddTransaction();
  const form = document.getElementById('transactionForm');
  const data = await Transactions.add(state.currentWalletId, Object.fromEntries(new FormData(form)));
  if (data.error) return setError('transactionError', data.error);
  state.currentPage = 1;
  await renderWalletDetail();
}

function handleEsc(e) { if (e.key === 'Escape') cancelAddTransaction(); }

// Edit wallet name dialog
async function showEditWalletDialog() {
  if (!currentWalletData) return;
  const name = prompt('Wallet name:', currentWalletData.name);
  if (!name) return;
  const desc = prompt('Description:', currentWalletData.description);
  const data = await Wallets.update(state.currentWalletId, { name, description: desc || '' });
  if (data.error) return alert(data.error);
  await renderWalletDetail();
}

async function deleteWallet() {
  if (!currentWalletData) return;
  if (!confirm(`Delete wallet "${currentWalletData.name}"? This cannot be undone.`)) return;
  await Wallets.delete(state.currentWalletId);
  navigate('/wallets');
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function logout() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
  navigate('/login');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

window.onpopstate = () => updateRoute();
updateRoute();
