export const main = document.querySelector('#main');
export const query = new URLSearchParams(location.search);
export const state = { user: null, cart: [] };

export const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
export const money = (cents) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
export const date = (value) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
export const shortId = (value) => `SE-${value.slice(0, 8).toUpperCase()}`;
export const label = (value) => String(value).split('_').map(text => text[0]?.toUpperCase() + text.slice(1)).join(' ');
export const status = (value) => `<span class="status-tag ${esc(value)}">${esc(label(value))}</span>`;
export const paymentName = (method, wallet) => ({ cash_on_delivery: 'Cash on delivery', credit_card: 'Credit card',
  e_wallet: wallet === 'gcash' ? 'GCash' : wallet === 'maya' ? 'Maya' : 'E-wallet', demo_wallet: 'E-wallet' })[method] || label(method);
export const paymentStatus = (value) => value === 'simulated' ? 'Recorded' : label(value);
export const productURL = (item) => `/product.html?id=${encodeURIComponent(item.id || item.product_id)}`;
export const orderURL = (id) => `/order.html?id=${encodeURIComponent(id)}`;
export const imageURL = (image) => /^\/img\/[\w-]+\.\w+$/.test(image) ? image : '/img/notebook.jpg';

const paths = {
  book: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Zm0 13a2 2 0 0 1 2-2h12M9 7h6"/>',
  search: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>',
  cart: '<path d="M3 4h2l2.1 10.1a1 1 0 0 0 1 .9h9.2a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>',
  person: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/>',
  truck: '<path d="M2 6h12v12H2zM14 10h4l4 4v4h-8"/><circle cx="7" cy="19" r="2" fill="white"/><circle cx="18" cy="19" r="2" fill="white"/>',
  shield: '<path d="M12 3 4 6v5c0 4.5 3.4 7.1 8 10 4.6-2.9 8-5.5 8-10V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
  map: '<path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h1m10 0h1"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  wallet: '<path d="M20 8V6a2 2 0 0 0-2-2H7a3 3 0 0 0 0 6h12a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V7m17 6h-5a1 1 0 0 0 0 2h5"/>',
  filters: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="1.5" fill="var(--paper)"/><circle cx="15" cy="12" r="1.5" fill="var(--paper)"/><circle cx="10" cy="17" r="1.5" fill="var(--paper)"/>',
  'arrow-left': '<path d="M19 12H5m7-7-7 7 7 7"/>',
  'arrow-down': '<path d="M12 5v14m-7-7 7 7 7-7"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  logout: '<path d="M10 4H5v16h5m-1-8h11m-4-4 4 4-4 4"/>',
};
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

export const avatarSource = (value) => /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value || '') ? value : '';
export const catalogSorts = [['featured', 'Featured'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['name', 'Name: A to Z'], ['rating', 'Highest rated']];
export function avatarMarkup(value) {
  const source = avatarSource(value);
  return source ? `<img src="${source}" alt="" draggable="false">` : icon('person');
}

export function moneySummary(bill) {
  return `<dl class="bill-totals mb-0"><div class="d-flex justify-content-between"><dt>Subtotal</dt><dd>${money(bill.subtotal_cents)}</dd></div>
    <div class="d-flex justify-content-between"><dt>Delivery</dt><dd>${money(bill.delivery_cents)}</dd></div>
    <div class="d-flex justify-content-between"><dt>Voucher</dt><dd>${bill.discount_cents ? `−${money(bill.discount_cents)}` : money(0)}</dd></div>
    <div class="d-flex justify-content-between border-top pt-2"><dt>Total</dt><dd><strong>${money(bill.total_cents)}</strong></dd></div></dl>`;
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(`/api${path}`, { method, signal, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || 'Could not complete the request. Try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}

let categories;
export function catalogCategories() {
  categories ??= api('/categories').catch(error => { categories = undefined; throw error; });
  return categories;
}

export function loadCart() {
  try {
    const stored = JSON.parse(localStorage.getItem('shopease_cart_v1') || '[]');
    state.cart = Array.isArray(stored) ? stored.filter(item => typeof item?.id === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 50) : [];
  } catch { state.cart = []; }
}

export function saveCart() {
  try { localStorage.setItem('shopease_cart_v1', JSON.stringify(state.cart)); } catch { /* Cart is still available during this page session. */ }
  const counter = document.querySelector('#cart-count');
  if (!counter) return;
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const changed = counter.textContent !== String(count);
  counter.textContent = count;
  counter.parentElement.title = `${count} ${count === 1 ? 'item' : 'items'} in your cart`;
  if (changed && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counter.getAnimations().forEach(animation => animation.cancel());
    counter.animate([{ scale: 1 }, { scale: 1.16 }, { scale: 1 }], { duration: 260, easing: 'ease-out' });
  }
}

export function addToCart(product, quantity = 1) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) return false;
  const existing = state.cart.find(item => item.id === product.id);
  if ((existing?.quantity ?? 0) + quantity > Math.min(product.stock, 50)) { notify('You’ve reached the available quantity.'); return; }
  if (!existing && state.cart.length >= 30) { notify('Your cart can hold up to 30 different products.'); return; }
  const item = { id: product.id, name: product.name, image: product.image, price_cents: product.price_cents, stock: product.stock, quantity: (existing?.quantity ?? 0) + quantity };
  state.cart = [...state.cart.filter(row => row.id !== product.id), item];
  saveCart();
  notify(`${product.name} added to your cart.`);
  return true;
}

let toastTimer;
export function notify(text) {
  let toast = document.querySelector('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast-message';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

export function message(form, text, danger = true) {
  const output = form.querySelector('.form-message');
  if (!output) return;
  output.className = `form-message alert ${danger ? 'alert-danger' : 'alert-success'} mt-3 mb-0`;
  output.textContent = text;
}

export const feedback = '<div class="form-message" role="status" aria-live="polite"></div>';
export function handleForm(form, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;
    message(form, '');
    try { await handler(Object.fromEntries(new FormData(form)), event); }
    catch (error) { message(form, error.message || 'Please try again.'); }
    finally { if (button) button.disabled = false; }
  });
}

export const here = () => `${location.pathname}${location.search}`;
export const loginURL = (next = here()) => `/login.html?next=${encodeURIComponent(next)}`;
export function nextPage() {
  const fallback = '/dashboard.html';
  const next = query.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  const parsed = new URL(next, location.origin);
  return parsed.origin === location.origin && !parsed.pathname.startsWith('/api') ? parsed.pathname + parsed.search : fallback;
}

export function pageTitle(title, text = '') {
  return `<div class="page-title"><h1>${esc(title)}</h1>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

export function page(content) { main.innerHTML = `<div class="shell page">${content}</div>`; }
export function signedIn(...roles) {
  if (!state.user) { location.replace(loginURL()); return false; }
  if (roles.length && !roles.includes(state.user.role)) { page(`${pageTitle('Access restricted')}<p>Your account cannot use this page.</p><a href="/">Return to shop</a>`); return false; }
  return true;
}
