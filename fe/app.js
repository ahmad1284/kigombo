// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const serverUrl = 'http://localhost:5000/api';
const storageKey = 'savedAccount';
const tokenKey = 'authToken';

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const routes = {
  '/dashboard': { title: 'My Account', templateId: 'dashboard', init: refresh },
  '/login': { title: 'Login', templateId: 'login' }
};

function navigate(path) {
  window.history.pushState({}, path, window.location.origin + path);
  updateRoute();
}

function updateRoute() {
  const path = window.location.pathname;
  const route = routes[path];

  if (!route) {
    return navigate('/dashboard');
  }

  const template = document.getElementById(route.templateId);
  const view = template.content.cloneNode(true);
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(view);

  if (typeof route.init === 'function') {
    route.init();
  }

  document.title = route.title;
}

// ---------------------------------------------------------------------------
// API interactions
// ---------------------------------------------------------------------------

async function sendRequest(api, method, body) {
  const token = localStorage.getItem(tokenKey);
  const headers = {};

  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(serverUrl + api, {
      method: method || 'GET',
      headers,
      body
    });
    return await response.json();
  } catch (error) {
    return { error: error.message || 'Unknown error' };
  }
}

async function loginRequest(user, password) {
  return sendRequest('/accounts/login', 'POST', JSON.stringify({ user, password }));
}

async function getAccount(user) {
  return sendRequest('/accounts/' + encodeURIComponent(user));
}

async function createAccount(account) {
  return sendRequest('/accounts', 'POST', account);
}

async function createTransaction(user, transaction) {
  return sendRequest('/accounts/' + user + '/transactions', 'POST', transaction);
}

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

let state = Object.freeze({ account: null });

function updateState(property, newData) {
  state = Object.freeze({ ...state, [property]: newData });
  if (property === 'account') {
    if (newData) {
      localStorage.setItem(storageKey, JSON.stringify(newData));
    } else {
      localStorage.removeItem(storageKey);
    }
  }
}

// ---------------------------------------------------------------------------
// Login / Register
// ---------------------------------------------------------------------------

async function login() {
  const form = document.getElementById('loginForm');
  const user = form.user.value;
  const password = form.password.value;

  const data = await loginRequest(user, password);

  if (data.error) {
    return updateElement('loginError', data.error);
  }

  if (data.token) {
    localStorage.setItem(tokenKey, data.token);
  }

  const { token: _token, ...account } = data;
  updateState('account', account);
  navigate('/dashboard');
}

async function register() {
  const form = document.getElementById('registerForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const result = await createAccount(JSON.stringify(data));

  if (result.error) {
    return updateElement('registerError', result.error);
  }

  if (result.token) {
    localStorage.setItem(tokenKey, result.token);
  }

  const { token: _token, ...account } = result;
  updateState('account', account);
  navigate('/dashboard');
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function updateAccountData() {
  const account = state.account;
  if (!account) return logout();

  const data = await getAccount(account.user);
  if (data.error) return logout();

  updateState('account', data);
}

async function refresh() {
  await updateAccountData();
  updateDashboard();
}

function updateDashboard() {
  const account = state.account;
  if (!account) return logout();

  updateElement('description', account.description);
  updateElement('balance', account.balance.toFixed(2));
  updateElement('currency', account.currency);

  const rows = document.createDocumentFragment();
  for (const transaction of account.transactions) {
    rows.appendChild(createTransactionRow(transaction));
  }
  updateElement('transactions', rows);
}

function createTransactionRow(transaction) {
  const template = document.getElementById('transaction');
  const row = template.content.cloneNode(true);
  const tr = row.querySelector('tr');
  tr.children[0].textContent = transaction.date;
  tr.children[1].textContent = transaction.object;
  tr.children[2].textContent = transaction.amount.toFixed(2);
  return row;
}

function addTransaction() {
  const dialog = document.getElementById('transactionDialog');
  dialog.classList.add('show');

  const form = document.getElementById('transactionForm');
  form.reset();
  form.date.valueAsDate = new Date();

  window.addEventListener('keydown', handleEscKey);
}

function handleEscKey(event) {
  if (event.key === 'Escape') cancelTransaction();
}

async function confirmTransaction() {
  const dialog = document.getElementById('transactionDialog');
  dialog.classList.remove('show');
  window.removeEventListener('keydown', handleEscKey);

  const form = document.getElementById('transactionForm');
  const formData = new FormData(form);
  const data = await createTransaction(state.account.user, JSON.stringify(Object.fromEntries(formData)));

  if (data.error) {
    return updateElement('transactionError', data.error);
  }

  updateState('account', {
    ...state.account,
    balance: state.account.balance + data.amount,
    transactions: [...state.account.transactions, data]
  });

  updateDashboard();
}

function cancelTransaction() {
  document.getElementById('transactionDialog').classList.remove('show');
  window.removeEventListener('keydown', handleEscKey);
}

function logout() {
  updateState('account', null);
  localStorage.removeItem(tokenKey);
  navigate('/login');
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function updateElement(id, textOrNode) {
  const element = document.getElementById(id);
  element.textContent = '';
  element.append(textOrNode);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function init() {
  const savedState = localStorage.getItem(storageKey);
  if (savedState) {
    updateState('account', JSON.parse(savedState));
  }

  window.onpopstate = () => updateRoute();
  updateRoute();
}

init();
