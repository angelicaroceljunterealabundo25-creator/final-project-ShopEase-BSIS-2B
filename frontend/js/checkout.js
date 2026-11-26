import { api, esc, feedback, icon, imageURL, main, message, money, moneySummary, orderURL, page, pageTitle, paymentName, saveCart, signedIn, state } from './shared.js';

function options(select, choices, prompt, value) {
  select.replaceChildren(new Option(prompt, ''), ...choices.map(item => new Option(item.name, item.code)));
  select.disabled = choices.length === 0;
  select.value = choices.some(item => item.code === value) ? value : '';
}

function paymentChoices() {
  const choices = [['cash_on_delivery', 'cash'], ['credit_card', 'card'], ['e_wallet', 'wallet']];
  return choices.map(([value, symbol], index) => `<label class="payment-choice">
    <input class="form-check-input" type="radio" name="payment_method" value="${value}" ${index === 0 ? 'checked' : ''}>
    <span class="payment-icon">${icon(symbol)}</span><span>${paymentName(value)}</span></label>`).join('');
}

function phoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.replace(/^(?:63|0)(?=9)/, '').slice(0, 10);
}

export async function checkout() {
  if (!signedIn('customer')) return;
  if (!state.cart.length) { page(`${pageTitle('Checkout')}<div class="panel empty-state">${icon('cart')}<h2 class="h4">Your cart is empty.</h2><a class="btn btn-primary" href="/#catalog">Browse the product catalog</a></div>`); return; }
  const { locations, vouchers, delivery_area: serviceArea } = await api('/checkout-options');
  const prefill = /\bpolangui\b/i.test(state.user.address);
  const prefilledAddress = prefill ? state.user.address.split(',').filter(part => !/^(polangui|albay|bicol|bicol region|region v)$/i.test(part.trim())).join(',').trim() : state.user.address;
  const select = (id, name, title, cols) => `<div class="${cols}"><label class="form-label" for="${id}">${title}</label><select class="form-select" id="${id}" name="${name}" required></select></div>`;
  page(`<a href="/cart.html" class="back-link">${icon('arrow-left')} Back to cart</a>${pageTitle('Checkout')}<form class="row g-4" id="checkout-form" action="#" method="POST"><div class="col-lg-7 checkout-sections">
    <section class="panel" aria-labelledby="delivery-heading"><h2 class="h4 mb-3" id="delivery-heading">Delivery details</h2><div class="row g-2 mb-3">${select('shipping-region', 'region_code', 'Region', 'col-12 col-md-6')}${select('shipping-province', 'province_code', 'Province', 'col-12 col-md-6')}${select('shipping-city', 'city_code', 'City or municipality', 'col-12')}</div>
    <p id="delivery-note" class="small mb-3" role="status"></p>
    <label class="form-label" for="shipping-address">Specific address</label><textarea class="form-control mb-3" id="shipping-address" name="shipping_address" autocomplete="street-address" minlength="5" maxlength="300" rows="2" placeholder="House number, street, and barangay" required>${esc(prefilledAddress)}</textarea>
    <div><label class="form-label" for="phone">Mobile number</label><div class="input-group"><span class="input-group-text" id="phone-prefix">+63</span><input class="form-control" id="phone" name="phone" type="tel" inputmode="numeric" pattern="9[0-9]{9}" maxlength="10" minlength="10" value="${phoneDigits(state.user.phone)}" placeholder="9171234567" autocomplete="tel-national" aria-describedby="phone-prefix phone-format" required></div><p class="form-text mb-0" id="phone-format"></p></div></section>
    <section class="panel" aria-labelledby="payment-heading"><h2 class="h4 mb-3" id="payment-heading">Payment and discounts</h2><label class="form-label" for="voucher">Voucher</label><select class="form-select mb-3" id="voucher" name="voucher_code"><option value="">No voucher</option></select>
    <fieldset><legend class="h6 mb-2">Payment method</legend><div class="payment-options">${paymentChoices()}</div>
    <div class="mt-3" id="wallet-options" hidden><label class="form-label" for="wallet-provider">E-wallet provider</label><select class="form-select" id="wallet-provider" name="wallet_provider" disabled required><option value="">Choose an e-wallet</option><option value="gcash">GCash</option><option value="maya">Maya</option></select></div></fieldset></section>
    </div>
    <div class="col-lg-5"><aside class="panel summary sticky-summary"><h2 class="h4">Order summary</h2><ul class="checkout-items list-unstyled" id="checkout-items"></ul><div id="bill" aria-live="polite"></div><button class="btn btn-primary w-100 mt-3" type="submit" disabled>Place order</button>${feedback}</aside></div></form>`);
  const form = main.querySelector('#checkout-form');
  const { region_code: region, province_code: province, city_code: city, shipping_address: address, phone, voucher_code: voucher, wallet_provider: wallet } = form.elements;
  const walletOptions = main.querySelector('#wallet-options');
  const place = form.querySelector('button[type="submit"]');
  const bill = main.querySelector('#bill');
  const note = main.querySelector('#delivery-note');
  const cart = state.cart.map(item => ({ product_id: item.id, quantity: item.quantity }));
  const images = new Map(state.cart.map(item => [item.id, item.image]));
  const quoteInput = () => ({ region_code: region.value, province_code: province.value, city_code: city.value, voucher_code: voucher.value, items: cart });
  const selectedRegion = () => locations.find(item => item.code === region.value);
  const selectedProvince = () => selectedRegion()?.provinces.find(item => item.code === province.value);
  const selectedCity = () => selectedProvince()?.cities.find(item => item.code === city.value);
  const polangui = { region: '0500000000', province: '0500500000', city: '0500514000' };
  let approved;
  let controller;
  let submitting = false;

  function populateProvinces(code) { options(province, selectedRegion()?.provinces || [], 'Choose a province', code); }
  function populateCities(code) { options(city, selectedProvince()?.cities || [], 'Choose a city or municipality', code); }
  function syncPhone() {
    phone.value = phoneDigits(phone.value);
    main.querySelector('#phone-format').textContent = /^9\d{9}$/.test(phone.value) ? `Local format: 0${phone.value}` : 'Enter 10 digits after +63. The local format begins with 09.';
  }
  function syncWallet() {
    const needsWallet = form.elements.payment_method.value === 'e_wallet';
    walletOptions.hidden = !needsWallet;
    wallet.disabled = !needsWallet;
  }
  function syncSubmit() {
    place.disabled = submitting || !approved || !form.checkValidity() || address.value.trim().length < 5;
  }
  function showItems(entries) {
    main.querySelector('#checkout-items').innerHTML = entries.map(item => `<li><img class="thumb" src="${imageURL(images.get(item.product_id || item.id))}" alt=""><div><strong>${esc(item.name)}</strong><div class="small text-body-secondary">Qty ${item.quantity}</div></div><span>${money(item.price_cents * item.quantity)}</span></li>`).join('');
  }
  function showVouchers(subtotal) {
    for (const option of voucher.options) {
      const item = vouchers.find(candidate => candidate.code === option.value);
      if (item) option.disabled = item.minimum_cents > subtotal && option.value !== voucher.value;
    }
  }

  async function refreshQuote() {
    controller?.abort();
    approved = undefined;
    syncSubmit();
    const municipality = selectedCity();
    const eligible = municipality && /\bpolangui\b/i.test(municipality.name) && selectedProvince().name === 'Albay';
    note.className = `delivery-note small mb-3 ${!municipality ? 'text-body-secondary' : eligible ? 'text-success' : 'text-danger'}`;
    note.textContent = !municipality ? 'Select your city or municipality to check delivery.' : eligible ? `Delivery is available in ${serviceArea}.` : `Delivery is currently available in ${serviceArea}.`;
    if (!eligible) { bill.textContent = 'Select an available delivery area to see your total.'; return; }
    controller = new AbortController();
    const { signal } = controller;
    const input = quoteInput();
    bill.textContent = 'Calculating total…';
    try {
      const quote = await api('/orders/quote', { method: 'POST', body: input, signal });
      if (signal.aborted) return;
      approved = quote;
      showItems(approved.items);
      bill.innerHTML = moneySummary(approved);
      showVouchers(approved.subtotal_cents);
    } catch (error) {
      if (signal.aborted) return;
      bill.textContent = error.message;
    } finally {
      if (!signal.aborted) syncSubmit();
    }
  }

  options(region, locations, 'Choose a region', prefill ? polangui.region : '');
  populateProvinces(prefill ? polangui.province : '');
  populateCities(prefill ? polangui.city : '');
  for (const item of vouchers) voucher.add(new Option(`${item.code} — ${item.percent}% off${item.minimum_cents ? ` from ${money(item.minimum_cents)}` : ''}`, item.code));
  showItems(state.cart);
  syncPhone();
  syncWallet();
  phone.addEventListener('input', syncPhone);
  phone.addEventListener('paste', event => {
    event.preventDefault();
    phone.value = event.clipboardData.getData('text');
    syncPhone(); syncSubmit();
  });
  address.addEventListener('input', () => {
    if ((!region.value || region.value === polangui.region) && (!province.value || province.value === polangui.province) &&
        !city.value && /\bpolangui\b/i.test(address.value)) {
      region.value = polangui.region;
      populateProvinces(polangui.province);
      populateCities(polangui.city);
      refreshQuote();
    }
  });
  form.addEventListener('input', syncSubmit);
  form.addEventListener('change', (event) => {
    if (event.target === region) { populateProvinces(); populateCities(); }
    if (event.target === province) populateCities();
    if ([region, province, city, voucher].includes(event.target)) { message(form, ''); refreshQuote(); }
    syncWallet(); syncSubmit();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !approved || !form.reportValidity()) return;
    const body = { ...Object.fromEntries(new FormData(form)), items: cart, expected_total_cents: approved.total_cents };
    submitting = true;
    syncSubmit();
    message(form, '');
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)));
      const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem('shopease-checkout-retry')); } catch { /* Use a new request ID. */ }
      const request_id = saved?.key === key ? saved.request_id : crypto.randomUUID();
      try { sessionStorage.setItem('shopease-checkout-retry', JSON.stringify({ key, request_id })); } catch { /* Continue without storage. */ }
      const order = await api('/orders', { method: 'POST', body: { ...body, request_id } });
      state.cart = [];
      saveCart();
      try { sessionStorage.removeItem('shopease-checkout-retry'); } catch { /* Storage is optional. */ }
      location.assign(`${orderURL(order.id)}&confirmed=1`);
    } catch (error) {
      message(form, error.message);
      if (error.status === 409) await refreshQuote();
    } finally {
      submitting = false;
      syncSubmit();
    }
  });
  await refreshQuote();
}
