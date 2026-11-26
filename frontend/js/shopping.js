import { api, date, esc, feedback, handleForm, icon, imageURL, label, loginURL, main, message, money, moneySummary, orderURL, page, pageTitle, paymentName, paymentStatus, productURL, query, saveCart, shortId, signedIn, state, status } from './shared.js';
import { mountGoogleMap } from './google-map.js';

export async function cart() {
  const showEmpty = () => page(`${pageTitle('Shopping cart')}<div class="panel empty-state">${icon('cart')}<h2 class="h4">Your cart is empty.</h2><a href="/#catalog" class="btn btn-primary">Browse stationery</a></div>`);
  if (!state.cart.length) { showEmpty(); return; }
  page(`${pageTitle('Shopping cart')}<p role="status">Checking prices and stock…</p>`);
  const refreshed = await Promise.all(state.cart.map(async (item) => {
    try { return { ...item, ...await api(`/products/${encodeURIComponent(item.id)}`) }; }
    catch (error) {
      if (error.status !== 404) throw error;
      return { ...item, stock: 0 };
    }
  }));
  state.cart = refreshed.map(({ id, name, image, price_cents, stock, quantity }) => ({ id, name, image, price_cents, stock, quantity }));
  saveCart();

  const render = () => {
    if (!state.cart.length) { showEmpty(); return; }
    const total = state.cart.reduce((sum, item) => sum + item.quantity * item.price_cents, 0);
    const invalid = state.cart.some(item => item.quantity > item.stock);
    page(`${pageTitle('Shopping cart')}<div class="row g-4"><div class="col-lg-8"><ul class="panel cart-list list-unstyled mb-0">
      ${state.cart.map(item => `<li class="cart-item"><div class="cart-product"><img class="thumb" src="${imageURL(item.image)}" alt=""><div><a href="${productURL(item)}">${esc(item.name)}</a><div class="small text-body-secondary">${money(item.price_cents)} each</div>${item.quantity > item.stock ? `<span class="small text-danger">${item.stock ? `Only ${item.stock} available` : 'Unavailable'}</span>` : ''}</div></div>
      <div class="cart-quantity"><label class="form-label small" for="cart-${esc(item.id)}">Quantity</label><input class="form-control" aria-label="Quantity for ${esc(item.name)}" id="cart-${esc(item.id)}" type="number" inputmode="numeric" min="1" max="${Math.max(1, Math.min(item.stock, 50))}" value="${item.quantity}" data-quantity="${esc(item.id)}" ${item.stock ? '' : 'disabled'}></div>
      <div class="cart-line-total"><span>Subtotal</span><strong>${money(item.quantity * item.price_cents)}</strong></div><button class="btn btn-sm btn-outline-secondary" data-remove="${esc(item.id)}" aria-label="Remove ${esc(item.name)}">Remove</button></li>`).join('')}</ul></div>
      <div class="col-lg-4"><aside class="panel summary sticky-summary"><h2 class="h4">Order summary</h2><p class="summary-subtotal"><span>Subtotal</span><strong>${money(total)}</strong></p><p class="text-body-secondary">Delivery and voucher discounts are calculated at checkout.</p>${invalid ? '<p class="text-danger">Adjust unavailable quantities to continue.</p><button class="btn btn-primary w-100" disabled>Proceed to checkout</button>' : `<a class="btn btn-primary w-100" href="${state.user ? '/checkout.html' : loginURL('/checkout.html')}">Proceed to checkout</a>`}<a class="summary-link" href="/#catalog">Continue shopping</a></aside></div></div>`);
    main.querySelectorAll('[data-remove]').forEach((button, index) => button.addEventListener('click', () => {
      state.cart = state.cart.filter(item => item.id !== button.dataset.remove); saveCart(); render();
      const remaining = main.querySelectorAll('[data-remove]');
      (remaining[Math.min(index, remaining.length - 1)] || main.querySelector('.empty-state a'))?.focus();
    }));
    main.querySelectorAll('[data-quantity]').forEach(input => input.addEventListener('change', () => {
      const item = state.cart.find(row => row.id === input.dataset.quantity);
      if (Number.isSafeInteger(input.valueAsNumber) && input.valueAsNumber >= 1 && input.valueAsNumber <= Math.min(item.stock, 50)) item.quantity = input.valueAsNumber;
      saveCart(); render();
      [...main.querySelectorAll('[data-quantity]')].find(node => node.dataset.quantity === item.id)?.focus();
    }));
  };
  render();
}

export async function orderHistory() {
  if (!signedIn('customer')) return;
  page(`${pageTitle('My orders')}<div id="notifications" class="mb-4" aria-live="polite"></div><div id="history" class="d-grid gap-3"><p role="status">Loading orders…</p></div>`);
  const target = main.querySelector('#history');
  const notifications = main.querySelector('#notifications');
  async function refresh() {
    try {
      const [rows, events] = await Promise.all([api('/orders'), api('/notifications')]);
      const orders = rows.length ? rows.map(row => `<article class="panel order-card" data-reveal><div><h2 class="h5"><a href="${orderURL(row.id)}">${shortId(row.id)} ${icon('arrow-up-right')}</a></h2><p class="mb-0 text-body-secondary">${date(row.created_at)} · ${row.items.reduce((count, item) => count + item.quantity, 0)} item(s)</p></div><div class="text-end">${status(row.status)}<div class="fw-bold mt-1">${money(row.total_cents)}</div></div></article>`).join('') : '<div class="panel empty-state"><h2 class="h4">No orders yet</h2><a class="btn btn-outline-primary" href="/#catalog">Browse stationery</a></div>';
      if (target.dataset.last !== orders) { target.innerHTML = orders; target.dataset.last = orders; }
      const unread = events.filter(event => !event.seen_at);
      const updates = unread.length ? `<div class="panel summary"><h2 class="h5">Order updates <span class="status-tag">${unread.length} unread</span></h2><ul>${unread.slice(0, 4).map(event => `<li><a href="${orderURL(event.order_id)}">${shortId(event.order_id)}</a> · ${esc(label(event.status))} · ${date(event.created_at)}</li>`).join('')}</ul><button class="btn btn-sm btn-outline-primary" id="mark-read">Mark as read</button></div>` : '';
      if (notifications.dataset.last !== updates) {
        notifications.innerHTML = updates;
        notifications.dataset.last = updates;
        notifications.querySelector('button')?.addEventListener('click', async () => {
          try { await api('/notifications/read', { method: 'PATCH' }); await refresh(); }
          catch (error) { notifications.insertAdjacentHTML('beforeend', `<p class="text-danger" role="alert">${esc(error.message)}</p>`); }
        });
      }
    } catch (error) { target.dataset.last = ''; target.innerHTML = `<p class="text-danger" role="alert">${esc(error.message)}</p>`; }
  }
  await refresh();
  watchOrderUpdates(refresh);
}

export async function orderDetail() {
  if (!signedIn()) return;
  const id = encodeURIComponent(query.get('id') || '');
  const row = await api(`/orders/${id}`);
  const customer = state.user.role === 'customer';
  const reviewForms = customer && row.status === 'delivered' ? row.items.filter(item => !row.reviewed.includes(item.product_id)).map(item => `<form class="border-top pt-3 mt-3" data-review="${esc(item.product_id)}" action="#" method="POST"><h3 class="h6">Review ${esc(item.name)}</h3><label class="form-label" for="rating-${item.product_id}">Rating</label><select class="form-select mb-2" id="rating-${item.product_id}" name="rating" required><option value="">Select a rating</option>${[5, 4, 3, 2, 1].map(rating => `<option value="${rating}">${rating} / 5</option>`).join('')}</select><label class="form-label" for="comment-${item.product_id}">Comment</label><textarea class="form-control mb-2" id="comment-${item.product_id}" name="comment" minlength="3" maxlength="1000" required></textarea><button class="btn btn-outline-primary">Post review</button>${feedback}</form>`).join('') : '';
  page(`<a href="${customer ? '/orders.html' : '/dashboard.html'}" class="back-link">${icon('arrow-left')} Back to ${customer ? 'my orders' : 'dashboard'}</a>${pageTitle(query.get('confirmed') ? 'Order confirmed' : `Order ${shortId(row.id)}`, `${shortId(row.id)} · ${date(row.created_at)}`)}
  <div class="row g-4"><div class="col-lg-7"><section class="panel"><div class="d-flex justify-content-between align-items-center mb-3 gap-3"><h2 class="h4 mb-0">Order details</h2>${status(row.status)}</div>
    <ul class="list-unstyled">${row.items.map(item => `<li class="d-flex justify-content-between gap-2 mb-1"><span>${esc(item.name)} × ${item.quantity}</span><span>${money(item.price_cents * item.quantity)}</span></li>`).join('')}</ul>${moneySummary(row)}
    <p class="border-top pt-3 mt-3 mb-1"><strong>Delivery</strong> ${esc(row.shipping_address)}</p><p class="mb-1"><strong>Payment</strong> ${esc(paymentName(row.payment_method, row.wallet_provider))} · ${esc(paymentStatus(row.payment_status))}</p>
    <button type="button" id="print-order" class="btn btn-outline-primary mt-2">Print receipt</button>${reviewForms}</section></div>
    <div class="col-lg-5"><section class="panel tracking-panel"><h2 class="h4">Order tracking</h2><ol class="tracking-timeline" id="timeline">${timeline(row)}</ol><p id="tracking-state" class="text-body-secondary" role="status"></p>${customer && row.status === 'pending' ? `<form id="cancel-order" action="#" method="POST"><button class="btn btn-outline-danger">Cancel order</button>${feedback}</form>` : ''}</section></div></div>`);
  main.querySelector('#print-order').addEventListener('click', () => window.print());
  const cancellation = main.querySelector('#cancel-order');
  if (cancellation) handleForm(cancellation, async () => {
    if (!window.confirm('Cancel this order?')) return;
    await api(`/orders/${id}/cancel`, { method: 'PATCH' });
    location.assign(orderURL(row.id));
  });
  for (const form of main.querySelectorAll('[data-review]')) handleForm(form, async body => {
    await api(`/products/${form.dataset.review}/reviews`, { method: 'POST', body: { ...body, rating: Number(body.rating), order_id: row.id } });
    form.querySelectorAll('button, select, textarea').forEach(element => { element.hidden = true; });
    message(form, 'Review posted.', false);
  });
  let current = row.status;
  const refresh = async () => {
    try {
      const fresh = await api(`/orders/${id}`);
      if (fresh.status === current) return;
      current = fresh.status;
      main.querySelector('#timeline').innerHTML = timeline(fresh);
      const badge = main.querySelector('.status-tag');
      badge.outerHTML = status(fresh.status);
      if (fresh.status !== 'pending') cancellation?.remove();
      main.querySelector('#tracking-state').textContent = `Order updated to ${label(fresh.status)}. Reload this page for updated payment details and review options.`;
    } catch { /* Existing order details remain available during a temporary connection failure. */ }
  };
  if (customer) watchOrderUpdates(refresh);
}

function watchOrderUpdates(refresh) {
  const stream = new EventSource('/api/orders/stream');
  stream.addEventListener('order', () => refresh());
  const reserve = setInterval(() => { if (!document.hidden) refresh(); }, 20_000);
  window.addEventListener('pagehide', () => { stream.close(); clearInterval(reserve); }, { once: true });
}

function timeline(row) {
  return row.events.map(event => `<li class="mb-2"><strong>${esc(label(event.status))}</strong><br><time class="text-body-secondary" datetime="${esc(event.created_at)}">${date(event.created_at)}</time></li>`).join('');
}

export async function locator() {
  const store = await api('/stores');
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.location)}`;
  const mapLabel = 'Map of the Polangui service area';
  const embed = `<iframe class="map-frame" src="${esc(store.embed_url)}" title="${mapLabel}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  const googleMap = `<div id="google-map" class="map-frame" role="region" aria-label="${mapLabel}" aria-busy="true"><p class="m-3" role="status">Loading map…</p></div>`;
  page(`${pageTitle('Store locator', 'Check whether ShopEase delivers to your city or municipality.')}<div class="row g-4"><section class="col-lg-7"><div class="panel locator-panel"><div id="locator-map">${store.google_maps ? googleMap : embed}</div><div class="locator-info"><div><h2 class="h4 mb-1">${esc(store.name)}</h2><p class="mb-0">${icon('map')} ${esc(store.location)}</p></div><a class="btn btn-outline-primary" href="${link}" target="_blank" rel="noopener">Open in Google Maps ${icon('arrow-up-right')}</a></div></div></section>
    <section class="col-lg-5"><form id="coverage" class="panel summary" action="#" method="GET"><h2 class="h4">Delivery coverage</h2><label class="form-label" for="locator-municipality">City or municipality</label><input class="form-control mb-3" name="municipality" id="locator-municipality" minlength="2" maxlength="100" placeholder="Polangui" required><button class="btn btn-primary">Check coverage</button>${feedback}</form></section></div>`);
  const form = main.querySelector('#coverage');
  handleForm(form, async body => { const data = await api(`/delivery-coverage?${new URLSearchParams(body)}`); message(form, data.eligible ? `Delivery is available in ${data.area}.` : 'This municipality is outside the demo delivery area.', !data.eligible); });
  if (store.google_maps) {
    mountGoogleMap(main.querySelector('#google-map'), store.google_maps, store.name, () => {
      main.querySelector('#locator-map').innerHTML = embed;
    });
  }
}
