import { checkout } from './checkout.js';
import { login, register, profile, forgot, reset } from './accounts.js';
import { home, product } from './catalog.js';
import { cart, locator, orderDetail, orderHistory } from './shopping.js';
import { dashboard } from './dashboard.js';
import { setupScrollReveals } from './motion.js';
import { api, avatarMarkup, catalogCategories, catalogSorts, esc, icon, loadCart, main, notify, page, pageTitle, query, saveCart, state } from './shared.js';

const current = document.body.dataset.page;
const routes = { home, product, login, register, profile, forgot, reset, cart, checkout, locator, order: orderDetail, orders: orderHistory, dashboard };

function shell() {
  const customer = state.user?.role === 'customer';
  const management = state.user && !customer;
  const currentPage = (name) => current === name ? 'aria-current="page"' : '';
  document.querySelector('#header').innerHTML = `<div class="site-header">
    <div class="shell nav-shell">
      <a class="brand" href="/" aria-label="ShopEase home"><span class="brand-mark">${icon('book')}</span>ShopEase</a>
      <form id="header-search" class="header-search" action="/#catalog" method="GET" role="search" aria-label="Search the product catalog">
        <label class="visually-hidden" for="header-query">Search products</label><div class="header-query">${icon('search')}<input class="form-control" id="header-query" name="q" type="search" value="${esc(query.get('q') || '')}" placeholder="Search" maxlength="100"></div>
        <label class="visually-hidden" for="header-category">Search category</label><select class="form-select" id="header-category" name="category"><option value="">All categories</option></select>
        <details class="header-filter"><summary class="btn btn-outline-primary" aria-label="Search filters">${icon('filters')}<span class="wide">Filters</span></summary><div class="panel header-filter-panel"><label class="form-label" for="header-max">Maximum price (₱)</label><input id="header-max" class="form-control mb-2" name="max" type="number" value="${esc(query.get('max') || '')}" min="1" max="100000" step="1"><label class="form-label" for="header-sort">Sort by</label><select id="header-sort" class="form-select mb-3" name="sort">${catalogSorts.map(([value, name]) => `<option value="${value}" ${query.get('sort') === value ? 'selected' : ''}>${name}</option>`).join('')}</select><button class="btn btn-primary w-100" type="submit">Apply filters</button></div></details>
        <button class="btn btn-primary" type="submit" aria-label="Search">${icon('search')}<span class="wide">Search</span></button>
      </form>
      <div class="header-actions"><a class="header-action" href="${state.user ? '/profile.html' : '/login.html'}" aria-label="${state.user ? 'My profile' : 'Sign in'}"><span class="${state.user ? 'account-avatar' : 'd-inline-flex'}" id="account-avatar">${avatarMarkup(state.user?.avatar)}</span><span class="wide">${state.user ? 'Profile' : 'Sign in'}</span></a>
      ${management ? '' : `<a class="header-action" href="/cart.html" aria-label="Shopping cart">${icon('cart')}<span class="wide">Cart</span><span class="cart-count" id="cart-count" aria-hidden="true">0</span></a>`}${state.user ? `<button class="header-action" id="logout" aria-label="Sign out">${icon('logout')}<span>Sign out</span></button>` : ''}</div>
      <nav class="nav-links" aria-label="Main navigation"><a href="/#catalog" ${currentPage('home')}>Product Catalog</a><a href="/locator.html" ${currentPage('locator')}>Store locator</a>${customer ? `<a href="/orders.html" ${currentPage('orders')}>My orders</a>` : ''}${state.user ? `<a href="/dashboard.html" ${currentPage('dashboard')}>${customer ? 'My account' : 'Dashboard'}</a>` : ''}</nav>
    </div></div>`;
  document.querySelector('#footer').innerHTML = `<div class="site-footer"><div class="shell footer-content"><div><a class="brand" href="/"><span class="brand-mark">${icon('book')}</span>ShopEase</a><p class="mb-0 mt-2">Stationery and study essentials in Polangui, Albay.</p></div><nav aria-label="Footer navigation"><a href="/#catalog">Browse products</a><a href="/locator.html">Delivery coverage ${icon('arrow-up-right')}</a></nav></div></div>`;
  saveCart();
  const categoryFilter = document.querySelector('#header-category');
  catalogCategories().then(categories => {
    for (const category of categories) categoryFilter.add(new Option(category, category));
    categoryFilter.value = categories.includes(query.get('category')) ? query.get('category') : '';
  }).catch(() => {});
  const filters = document.querySelector('.header-filter');
  document.addEventListener('click', event => { if (filters.open && !filters.contains(event.target)) filters.open = false; });
  filters.addEventListener('keydown', event => { if (event.key === 'Escape') { filters.open = false; filters.querySelector('summary').focus(); } });
  document.addEventListener('profile-avatar-changed', () => {
    document.querySelector('#account-avatar').innerHTML = avatarMarkup(state.user?.avatar);
  });
  document.querySelector('#logout')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try { await api('/logout', { method: 'POST' }); location.assign('/'); }
    catch (error) { notify(error.message); document.querySelector('#logout').disabled = false; }
  });
}

loadCart();
try { state.user = await api('/me'); } catch (error) { if (error.status !== 401) console.warn('Session check failed.'); }
shell();
setupScrollReveals(main);
try { await routes[current](); }
catch (error) { page(`${pageTitle('This page is unavailable')}<p class="alert alert-danger" role="alert">${esc(error.message)}</p><a href="/">Return to shop</a>`); }
