import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import XLSX from 'xlsx';
import { openDatabase } from '../db.js';
import { createApp } from '../server.js';
import { seedAccounts, seedCatalog } from '../seed.js';

test('ShopEase API persists the catalog, accounts, orders, inventory, reviews and administration in MongoDB', async (t) => {
  const db = await openDatabase({ memory: true });
  t.after(() => db.close());
  const legacy = await db.Product.create({ id: randomUUID(), slug: 'everyday-notebook', name: 'Everyday Notebook', category: 'Notebooks',
    description: 'Former catalog item', stock: 4, price_cents: 12900, image: '/img/notebook.jpg' });
  await seedCatalog(db);
  await seedAccounts(db);
  const outbox = [];
  const server = createApp(db, { sendReset: async (email, url) => outbox.push({ email, url }) }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = 'GET', body, cookie, expect = 200, origin } = {}) {
    const response = await fetch(`${base}${path}`, { method, headers: {
      ...(cookie && { Cookie: cookie }), ...(body && { 'Content-Type': 'application/json' }), ...(origin && { Origin: origin }),
    }, body: body && JSON.stringify(body) });
    assert.equal(response.status, expect, `${method} ${path}: ${response.status === expect ? '' : await response.clone().text()}`);
    return response;
  }

  const session = response => response.headers.get('set-cookie').split(';')[0];
  const login = async (email, password = 'ShopEaseDemo2026!') => session(await request('/api/login', { method: 'POST', body: { email, password } }));
  const body = async (path, options) => (await request(path, options)).json();
  const password = 'StartingPassword2026';
  const account = { email: 'browser@example.test', password, name: 'Local test customer', phone: '09175550101', address: 'Sample address, Polangui, Albay' };

  const health = await body('/api/health');
  assert.equal(health.database, 'mongodb');
  const listing = await body('/api/products?q=Textliner%20%2338&category=Highlighters&sort=price-asc');
  assert.equal(listing.total, 1);
  const original = listing.items[0];
  assert.equal(original.brand, 'Faber Castell');
  assert.equal((await db.Product.findOne({ id: legacy.id })).active, false);
  await request(`/api/products/${legacy.id}`, { expect: 404 });
  assert.ok((await body('/api/products?q=Green%20Apple')).items.every(item => item.brand === 'Green Apple'));
  await request('/api/products?max=0', { expect: 400 });
  assert.equal((await body('/api/products?q=no-such-stationery')).total, 0);
  await request('/api/login', { method: 'POST', origin: 'https://different.example', body: account, expect: 403 });
  const registered = await request('/api/users', { method: 'POST', body: { ...account, role: 'admin' }, expect: 201 });
  let customer = session(registered);
  assert.match(registered.headers.get('set-cookie'), /HttpOnly/i);
  const profile = await registered.json();
  assert.equal(profile.role, 'customer');
  assert.equal(profile.password_hash, undefined);
  await request('/api/users', { method: 'POST', body: account, expect: 409 });
  await request(`/api/users/${profile.id}`, { method: 'PUT', cookie: customer, body: { ...account, name: 'Edited customer' } });
  assert.equal((await body('/api/me', { cookie: customer })).name, 'Edited customer');
  await request('/api/users', { cookie: customer, expect: 403 });
  await request('/api/me/avatar', { method: 'PUT', cookie: customer, body: { avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }, expect: 400 });
  await request('/api/orders', { expect: 401 });
  const staff = await login('staff@shopease.test');
  const admin = await login('admin@shopease.test');
  const teamAccount = { email: 'newstaff@shopease.test', name: 'New staff', password, role: 'staff' };
  for (const [cookie, expect] of [[undefined, 401], [customer, 403], [staff, 403]]) {
    await request('/api/admin/users', { method: 'POST', body: teamAccount, cookie, expect });
  }
  await request('/api/admin/users', { method: 'POST', body: { ...teamAccount, role: 'customer' }, cookie: admin, expect: 400 });
  const teamStaff = await request('/api/admin/users', { method: 'POST', body: teamAccount, cookie: admin, expect: 201 });
  assert.equal(teamStaff.headers.has('set-cookie'), false);
  const teamStaffProfile = await teamStaff.json();
  assert.equal(teamStaffProfile.role, 'staff');
  assert.equal(teamStaffProfile.password_hash, undefined);
  await request('/api/admin/users', { method: 'POST', body: teamAccount, cookie: admin, expect: 409 });
  const teamAdmin = { ...teamAccount, email: 'newadmin@shopease.test', role: 'admin' };
  await request('/api/admin/users', { method: 'POST', body: teamAdmin, cookie: admin, expect: 201 });
  for (const account of [teamAccount, teamAdmin]) {
    const signIn = { email: account.email, password: account.password };
    await request('/api/login', { method: 'POST', body: { ...signIn, access: 'customer' }, expect: 401 });
    const signedIn = await body('/api/login', { method: 'POST', body: { ...signIn, access: 'team' } });
    assert.equal(signedIn.role, account.role);
  }
  await request('/api/login', { method: 'POST', body: { email: account.email, password, access: 'team' }, expect: 401 });

  const checkout = { request_id: randomUUID(), items: [{ product_id: original.id, quantity: 2, price_cents: 1 }],
    region_code: '0500000000', province_code: '0500500000', city_code: '0500514000',
    shipping_address: 'Sample street address', phone: '9175550101', payment_method: 'cash_on_delivery', voucher_code: 'STUDY10' };
  assert.equal((await body('/api/delivery-coverage?municipality=Polangui')).eligible, true);
  assert.equal((await body('/api/delivery-coverage?municipality=Legazpi')).eligible, false);
  const store = await body('/api/stores');
  assert.match(store.embed_url, /^https:\/\//);
  const checkoutOptions = await body('/api/checkout-options', { cookie: customer });
  assert.equal(checkoutOptions.locations.length, 18);
  assert.deepEqual(checkoutOptions.vouchers.map(voucher => voucher.code), ['HELLO5', 'STUDY10', 'SCHOOL15']);
  await request('/api/orders/quote', { method: 'POST', cookie: customer, body: { ...checkout, city_code: '0500506000', shipping_address: 'Polangui' }, expect: 422 });
  await request('/api/orders/quote', { method: 'POST', cookie: customer, body: { ...checkout, voucher_code: 'INVALID' }, expect: 422 });
  const quote = await body('/api/orders/quote', { method: 'POST', cookie: customer, body: checkout });
  assert.equal(quote.discount_cents, 4195);
  assert.equal(quote.total_cents, 42655);
  const orderResults = await Promise.all([fetch(`${base}/api/orders`, { method: 'POST', headers: { Cookie: customer, 'Content-Type': 'application/json' }, body: JSON.stringify(checkout) }),
    fetch(`${base}/api/orders`, { method: 'POST', headers: { Cookie: customer, 'Content-Type': 'application/json' }, body: JSON.stringify(checkout) })]);
  assert.deepEqual(orderResults.map(item => item.status).sort(), [200, 201]);
  const [order, retry] = await Promise.all(orderResults.map(item => item.json()));
  assert.equal(order.id, retry.id);
  assert.equal(order.shipping_address, 'Sample street address, Polangui, Albay, Region V (Bicol Region)');
  assert.equal(order.phone, '+639175550101');
  assert.equal((await body(`/api/products/${original.id}`)).stock, original.stock - 2);
  await request('/api/orders', { method: 'POST', cookie: customer, body: { ...checkout, request_id: randomUUID(), voucher_code: '', items: [{ product_id: original.id, quantity: 50 }] }, expect: 409 });
  assert.equal((await body('/api/orders', { cookie: customer })).length, 1);

  const otherCustomer = await login('customer@shopease.test');
  await request(`/api/orders/${order.id}`, { cookie: otherCustomer, expect: 404 });
  await request(`/api/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'processing' }, cookie: customer, expect: 403 });
  await request(`/api/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'delivered' }, cookie: staff, expect: 409 });
  for (const next of ['processing', 'shipped', 'delivered']) {
    await request(`/api/orders/${order.id}/status`, { method: 'PATCH', body: { status: next }, cookie: staff });
  }
  const delivered = await body(`/api/orders/${order.id}`, { cookie: customer });
  assert.equal(delivered.payment_status, 'received');
  assert.deepEqual(delivered.events.map(event => event.status), ['pending', 'processing', 'shipped', 'delivered']);
  assert.equal((await body('/api/notifications', { cookie: customer })).filter(event => !event.seen_at).length, 4);
  await request('/api/notifications/read', { method: 'PATCH', cookie: customer, expect: 204 });
  const review = { order_id: order.id, rating: 5, comment: 'Useful school supplies.' };
  await request(`/api/products/${original.id}/reviews`, { method: 'POST', cookie: otherCustomer, body: review, expect: 403 });
  await request(`/api/products/${original.id}/reviews`, { method: 'POST', cookie: customer, body: review, expect: 201 });
  assert.equal((await body(`/api/products/${original.id}`)).review_count, 1);

  await request('/api/orders', { method: 'POST', cookie: customer, body: { ...checkout, request_id: randomUUID(), payment_method: 'e_wallet' }, expect: 400 });
  await request('/api/orders', { method: 'POST', cookie: customer, body: { ...checkout, request_id: randomUUID(), expected_total_cents: 1 }, expect: 409 });
  const cancellable = await body('/api/orders', { method: 'POST', cookie: customer, body: { ...checkout, request_id: randomUUID(), payment_method: 'e_wallet', wallet_provider: 'maya' }, expect: 201 });
  assert.equal(cancellable.payment_status, 'recorded');
  assert.equal(cancellable.wallet_provider, 'maya');
  await request(`/api/orders/${cancellable.id}/cancel`, { method: 'PATCH', cookie: customer });
  await request(`/api/orders/${cancellable.id}/cancel`, { method: 'PATCH', cookie: customer });
  assert.equal((await body(`/api/products/${original.id}`)).stock, original.stock - 2);

  const product = { name: 'Checklist Test Product', description: 'A product for the local CRUD acceptance check.', category: 'School Supplies', price_cents: 9900, stock: 8, image: '/img/notebook.jpg' };
  await request('/api/products', { method: 'POST', cookie: staff, body: product, expect: 403 });
  const created = await body('/api/products', { method: 'POST', cookie: admin, body: product, expect: 201 });
  await request(`/api/products/${created.id}`, { method: 'PUT', cookie: admin, body: { ...product, name: 'Edited test product' } });
  await request(`/api/products/${created.id}/stock`, { method: 'PATCH', cookie: staff, body: { stock: 12 } });
  assert.equal((await body(`/api/products/${created.id}`)).stock, 12);
  await request(`/api/products/${created.id}`, { method: 'DELETE', cookie: admin, expect: 204 });
  await request(`/api/products/${created.id}`, { expect: 404 });
  await seedCatalog(db);
  await seedCatalog(db);
  const reviewedProduct = await body(`/api/products/${original.id}`);
  assert.equal(reviewedProduct.review_count, 1);
  assert.equal(reviewedProduct.stock, original.stock - 2);
  assert.equal((await body('/api/products')).total, 18);
  assert.equal((await body('/api/orders', { cookie: admin })).length, 2);
  const stats = await body('/api/admin/dashboard-stats', { cookie: admin });
  assert.equal(stats.orders, 2);
  const exportFile = await request('/api/admin/export-orders', { cookie: admin });
  const workbook = XLSX.read(Buffer.from(await exportFile.arrayBuffer()));
  assert.deepEqual(workbook.SheetNames, ['Order Summary', 'Order Details']);
  await request('/api/admin/vouchers/PAST', { method: 'PUT', cookie: admin, body: { percent: 10, minimum_cents: 0, active: true, expires_at: '2000-01-01' } });
  await request('/api/orders/quote', { method: 'POST', cookie: customer, body: { ...checkout, voucher_code: 'PAST' }, expect: 422 });

  await request('/api/password/forgot', { method: 'POST', body: { email: account.email } });
  assert.equal(outbox[0].email, account.email);
  const reset = { token: new URL(outbox[0].url).hash.slice(1), password: 'ResetPassword2026!' };
  await request('/api/password/reset', { method: 'POST', body: reset });
  await request('/api/password/reset', { method: 'POST', body: reset, expect: 400 });
  await request('/api/me', { cookie: customer, expect: 401 });
  customer = await login(account.email, reset.password);
  await request(`/api/users/${profile.id}/role`, { method: 'PATCH', cookie: admin, body: { role: 'staff' } });
  assert.equal((await body('/api/me', { cookie: customer })).role, 'staff');
  await request(`/api/users/${profile.id}`, { method: 'DELETE', cookie: admin, expect: 204 });
  await request('/api/me', { cookie: customer, expect: 401 });
  await request(`/api/users/${profile.id}/reactivate`, { method: 'POST', cookie: admin, expect: 204 });
  assert.equal((await body('/api/me', { cookie: await login(account.email, reset.password) })).active, true);
});
