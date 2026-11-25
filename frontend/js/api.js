
/* ShopEase shared helpers - loaded on every page (before the page's own JS) */

// Where the backend lives. When the page is opened from the backend itself
// (http://localhost:5000) or Live Server, we use localhost. After deploying,
// put your Render URL in PRODUCTION_API.
const PRODUCTION_API = 'https://shopease-backend.onrender.com/api';
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
const API_URL = isLocal ? 'http://localhost:5000/api' : PRODUCTION_API;

/* ---------- Small helpers ---------- */

// Escape text before putting it in HTML (prevents script injection)
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function peso(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function shortId(id) {
  return '#SE-' + String(id).slice(-6).toUpperCase();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function statusBadge(status) {
  const colors = { Processing: 'warning text-dark', Completed: 'success', Cancelled: 'secondary' };
  return `<span class="badge text-bg-${colors[status] || 'light'}">${escapeHTML(status)}</span>`;
}

function productIcon(product) {
  const name = (product.name + ' ' + product.category).toLowerCase();
  if (name.includes('notebook')) return '📓';
  if (name.includes('pencil')) return '✏️';
  if (name.includes('bag')) return '🎒';
  if (name.includes('geometry')) return '📐';
  if (name.includes('color')) return '🎨';
  if (name.includes('folder')) return '📁';
  return '🛍️';
}

// Show a message box at the top-right of the page
function showAlert(message, type = 'danger') {
  let box = document.getElementById('alert-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'alert-box';
    box.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2000;max-width:360px;';
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `alert alert-${type} shadow-sm`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ---------- Login session (token kept in localStorage) ---------- */

const Auth = {
  getToken() { return localStorage.getItem('shopease_token'); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('shopease_user')); }
    catch (e) { return null; }
  },
  save(token, user) {
    localStorage.setItem('shopease_token', token);
    localStorage.setItem('shopease_user', JSON.stringify(user));
  },
  saveUser(user) { localStorage.setItem('shopease_user', JSON.stringify(user)); },
  logout() {
    localStorage.removeItem('shopease_token');
    localStorage.removeItem('shopease_user');
  },
  // Page guard: send visitors to login if they are not allowed here
  require(...roles) {
    const user = Auth.getUser();
    if (!Auth.getToken() || !user) {
      location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop());
      return false;
    }
    if (roles.length && !roles.includes(user.role)) {
      alert('You do not have access to this page.');
      location.href = 'index.html';
      return false;
    }
    return true;
  }
};

/* ---------- API calls ---------- */

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers.Authorization = 'Bearer ' + token;

  let response;
  try {
    response = await fetch(API_URL + path, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch (err) {
    throw new Error('Cannot connect to the server. Is the backend running?');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // expired/invalid token -> back to login
    if (response.status === 401 && token) {
      Auth.logout();
    }
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

/* ---------- Shopping cart (localStorage) ---------- */

const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem('shopease_cart')) || []; }
    catch (e) { return []; }
  },
  save(items) {
    localStorage.setItem('shopease_cart', JSON.stringify(items));
    Cart.updateBadge();
  },
  add(product, quantity = 1) {
    const items = Cart.get();
    const found = items.find((i) => i.id === product._id);
    if (found) {
      found.quantity = Math.min(found.quantity + quantity, product.stock);
    } else {
      items.push({ id: product._id, name: product.name, price: product.price, stock: product.stock, icon: productIcon(product), quantity });
    }
    Cart.save(items);
  },
  setQuantity(id, quantity) {
    const items = Cart.get().map((i) => (i.id === id ? { ...i, quantity } : i));
    Cart.save(items);
  },
  remove(id) { Cart.save(Cart.get().filter((i) => i.id !== id)); },
  clear() { Cart.save([]); },
  total() { return Cart.get().reduce((sum, i) => sum + i.price * i.quantity, 0); },
  count() { return Cart.get().reduce((sum, i) => sum + i.quantity, 0); },
  updateBadge() {
    document.querySelectorAll('a[href="cart.html"]').forEach((a) => {
      const base = a.dataset.label || (a.dataset.label = a.textContent.trim().replace(/\s*\(\d+\)$/, ''));
      a.textContent = Cart.count() ? `${base} (${Cart.count()})` : base;
    });
  }
};

/* ---------- IndexedDB: offline copy of the product list ---------- */

const ProductCache = {
  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB not supported'));
      const req = indexedDB.open('shopease-db', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('products', { keyPath: '_id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async save(products) {
    try {
      const db = await ProductCache.open();
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      store.clear();
      products.forEach((p) => store.put(p));
    } catch (e) { /* cache is optional */ }
  },
  async load() {
    try {
      const db = await ProductCache.open();
      return await new Promise((resolve) => {
        const req = db.transaction('products').objectStore('products').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) { return []; }
  }
};

/* ---------- Navbar: show Login / Logout and the right links ---------- */

function initNav() {
  const list = document.querySelector('.navbar-nav');
  if (!list) return;
  const user = Auth.getUser();

  const addItem = (href, label) => {
    if (list.querySelector(`a[href="${href}"]`)) return;
    const li = document.createElement('li');
    li.className = 'nav-item';
    li.innerHTML = `<a class="nav-link" href="${href}">${label}</a>`;
    list.appendChild(li);
  };

  const loginLink = list.querySelector('a[href="login.html"]');

  if (user && Auth.getToken()) {
    if (user.role === 'customer') {
      addItem('orders.html', 'My Orders');
    }
    if (user.role === 'admin' && !list.querySelector('a[href="admin-products.html"]')) {
      addItem('admin-products.html', 'Admin');
    }
    if (user.role === 'staff' && !list.querySelector('a[href="staff-orders.html"]')) {
      addItem('staff-orders.html', 'Staff');
    }
    addItem('profile.html', escapeHTML(user.name.split(' ')[0]));

    const logout = document.createElement('li');
    logout.className = 'nav-item';
    logout.innerHTML = '<a class="nav-link" href="#" id="logoutLink">Logout</a>';
    if (loginLink) loginLink.closest('li').replaceWith(logout); else list.appendChild(logout);

    document.getElementById('logoutLink').addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      location.href = 'login.html';
    });
  }
  Cart.updateBadge();
}

document.addEventListener('DOMContentLoaded', initNav);