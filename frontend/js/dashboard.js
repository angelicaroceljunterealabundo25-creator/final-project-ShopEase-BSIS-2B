import { api, date, esc, feedback, handleForm, imageURL, label, main, message, money, notify, orderURL, page, pageTitle, query, shortId, signedIn, state, status } from './shared.js';

const statuses = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
export async function dashboard() {
  if (!signedIn()) return;
  if (state.user.role === 'customer') { await customerDashboard(); return; }
  const admin = state.user.role === 'admin';
  const views = admin ? ['overview', 'orders', 'inventory', 'users', 'vouchers'] : ['overview', 'orders', 'inventory'];
  const view = views.includes(query.get('view')) ? query.get('view') : views[0];
  const drawn = { overview, orders, inventory, users, vouchers };
  page(`${pageTitle(admin ? 'Admin dashboard' : 'Staff workspace')}<div class="workspace"><nav class="workspace-nav" aria-label="Management pages">${views.map(item => `<a href="/dashboard.html?view=${item}" ${view === item ? 'aria-current="page"' : ''}>${label(item)}</a>`).join('')}</nav>
    <section id="workspace-view" aria-labelledby="dashboard-view-title"><h2 class="h4 mb-3" id="dashboard-view-title">${label(view)}</h2><div id="workspace-content"><p role="status">Loading ${view}…</p></div></section></div>
    <div class="modal fade" id="edit-modal" tabindex="-1" aria-labelledby="edit-title" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h2 class="modal-title h5" id="edit-title"></h2><button class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body" id="edit-content"></div></div></div></div>`);
  const target = main.querySelector('#workspace-content');
  const render = async () => {
    try { await drawn[view](target, admin, render); }
    catch (error) { target.innerHTML = `<p class="alert alert-danger" role="alert">${esc(error.message)}</p>`; }
  };
  await render();
}

async function customerDashboard() {
  page(`${pageTitle('My account', `Welcome, ${state.user.name}.`)}
    <nav class="dashboard-links" aria-label="Account shortcuts"><a class="btn btn-primary" href="/orders.html">Track orders</a><a class="btn btn-outline-primary" href="/cart.html">View cart</a><a class="btn btn-outline-primary" href="/profile.html">Edit profile</a><a class="btn btn-outline-primary" href="/#catalog">Browse catalog</a></nav>
    <section aria-labelledby="dashboard-view-title"><h2 class="h4 mb-3" id="dashboard-view-title">Recent orders</h2><div id="customer-recent-orders"><p role="status">Loading orders…</p></div></section>`);
  const target = main.querySelector('#customer-recent-orders');
  try {
    const records = await api('/orders');
    target.innerHTML = table(['Order', 'Placed', 'Total', 'Status'], records.slice(0, 5).map(order =>
      `<tr><th scope="row"><a href="${orderURL(order.id)}">${shortId(order.id)}</a></th><td>${date(order.created_at)}</td><td>${money(order.total_cents)}</td><td>${status(order.status)}</td></tr>`), 'Your orders will appear here after checkout.');
  } catch (error) { target.innerHTML = `<p class="alert alert-danger" role="alert">${esc(error.message)}</p>`; }
}

function table(headers, rows, empty = 'No records found.') {
  return rows.length ? `<div class="panel table-responsive workspace-table" tabindex="0" role="region" aria-labelledby="dashboard-view-title"><table class="table align-middle mb-0"><thead><tr>${headers.map(name => `<th scope="col">${esc(name)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : `<p class="panel empty-state">${esc(empty)}</p>`;
}

function openModal(title, content, action) {
  const element = main.querySelector('#edit-modal');
  element.querySelector('#edit-title').textContent = title;
  element.querySelector('#edit-content').innerHTML = content;
  const dialog = bootstrap.Modal.getOrCreateInstance(element);
  const form = element.querySelector('form');
  handleForm(form, async values => { await action(values); dialog.hide(); });
  dialog.show();
}

async function overview(target, admin) {
  if (!admin) { await staffOverview(target); return; }
  const stats = await api('/admin/dashboard-stats');
  const cards = [['Active products', stats.products], ['Customers', stats.customers], ['Orders', stats.orders], ['Pending orders', stats.pending], ['Delivered order value', money(stats.revenue_cents)]];
  target.innerHTML = `<dl class="workspace-metrics">${cards.map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    <div class="row g-3"><div class="col-md-6"><section class="panel h-100"><h3 class="h5">Orders by status</h3>${stats.statuses.length ? stats.statuses.map(item => `<div class="mb-2"><div class="d-flex justify-content-between"><span>${esc(label(item.status))}</span><strong>${item.count}</strong></div><progress class="w-100" value="${item.count}" max="${stats.orders}" aria-label="${esc(label(item.status))} orders"></progress></div>`).join('') : '<p class="text-body-secondary">Orders will appear here after checkout.</p>'}<a class="btn btn-outline-primary mt-2" href="/api/admin/export-orders">Export orders to Excel</a></section></div>
    <div class="col-md-6"><section class="panel h-100"><h3 class="h5">Low stock</h3>${stats.low_stock.length ? `<ul class="mb-0">${stats.low_stock.map(item => `<li>${esc(item.name)} · ${item.stock} left</li>`).join('')}</ul>` : '<p class="text-body-secondary">No low-stock products.</p>'}</section></div></div>`;
}

async function staffOverview(target) {
  const [orders, products] = await Promise.all([api('/orders'), api('/inventory')]);
  const open = orders.filter(order => statuses[order.status]?.length);
  const lowStock = products.filter(product => product.active && product.stock <= 5);
  target.innerHTML = `<div class="row g-3">
    <div class="col-md-6"><section class="panel h-100"><h3 class="h5">Order queue</h3><p>${open.length} ${open.length === 1 ? 'order needs' : 'orders need'} fulfillment.</p><a class="btn btn-primary" href="/dashboard.html?view=orders">Manage orders</a></section></div>
    <div class="col-md-6"><section class="panel h-100"><h3 class="h5">Inventory</h3><p>${lowStock.length} ${lowStock.length === 1 ? 'product is' : 'products are'} low on stock.</p><a class="btn btn-outline-primary" href="/dashboard.html?view=inventory">Update stock</a></section></div></div>`;
}

async function orders(target, _admin, redraw) {
  const records = await api('/orders');
  target.innerHTML = table(['Order', 'Customer', 'Total', 'Status', 'Change status'], records.map(order => `<tr><th scope="row"><a href="${orderURL(order.id)}">${shortId(order.id)}</a><div class="small text-body-secondary">${date(order.created_at)}</div></th><td>${esc(order.customer_name)}</td><td>${money(order.total_cents)}</td><td>${status(order.status)}</td><td>
    ${statuses[order.status].length ? `<form data-status="${order.id}" action="#" method="POST"><div class="d-flex gap-2"><select class="form-select" name="status" aria-label="New status for ${shortId(order.id)}" required><option value="">Select status</option>${statuses[order.status].map(item => `<option value="${item}">${label(item)}</option>`).join('')}</select><button class="btn btn-outline-primary">Save</button></div>${feedback}</form>` : 'Complete'}</td></tr>`), 'No orders have been placed.');
  target.querySelectorAll('[data-status]').forEach(form => handleForm(form, async body => {
    if (body.status === 'cancelled' && !window.confirm('Cancel this order and restore its stock?')) return;
    await api(`/orders/${form.dataset.status}/status`, { method: 'PATCH', body });
    notify('Order status updated.');
    await redraw();
  }));
}

const textField = (id, label, value, limit = 100) => `<label class="form-label" for="${id}">${label}</label><input class="form-control mb-3" id="${id}" name="${id}" value="${esc(value)}" required maxlength="${limit}">`;
const numberField = (id, label, value, min, max, step = '1') => `<label class="form-label" for="${id}">${label}</label><input class="form-control mb-3" id="${id}" name="${id}" value="${esc(value)}" type="number" min="${min}" max="${max}" step="${step}" required>`;

function productForm(product, photoChoices) {
  return `<form id="edit-product" action="#" method="POST">${textField('name', 'Product name', product.name)}${textField('brand', 'Brand', product.brand, 80)}${textField('category', 'Category', product.category, 50)}
    <label class="form-label" for="description">Description</label><textarea class="form-control mb-3" id="description" name="description" minlength="5" maxlength="1000" required>${esc(product.description)}</textarea>
    ${numberField('price', 'Price (₱)', product.price_cents ? product.price_cents / 100 : '', '.01', '100000', '.01')}${numberField('stock', 'Available stock', product.stock ?? 0, 0, 100000)}
    <label class="form-label" for="image">Product image</label><select class="form-select mb-3" name="image" id="image" required><option value="">Choose a product photo</option>${[...photoChoices].map(([image, name]) => `<option value="${esc(image)}" ${product.image === image ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><button class="btn btn-primary">Save product</button>${feedback}</form>`;
}

async function inventory(target, admin, redraw) {
  const products = await api('/inventory');
  const photoChoices = new Map(products.filter(product => product.brand || product.active).map(product => [product.image, product.name]));
  const editor = product => openModal(product ? 'Edit product' : 'Add product', productForm(product || {}, photoChoices), async values => {
    const { price, ...fields } = values;
    await api(product ? `/products/${product.id}` : '/products', { method: product ? 'PUT' : 'POST', body: { ...fields, price_cents: Math.round(Number(price) * 100), stock: Number(fields.stock) } });
    notify(product ? 'Product updated.' : 'Product added.');
    await redraw();
  });
  target.innerHTML = `${admin ? '<button class="btn btn-primary mb-3" id="add-product">Add product</button>' : ''}${table(['Product', 'Category', 'Price', 'Stock', 'Actions'], products.map(product => `<tr><th scope="row"><div class="d-flex gap-2 align-items-center"><img class="thumb" src="${imageURL(product.image)}" alt=""><div>${esc(product.name)}${!product.active ? '<div class="text-body-secondary small">Archived</div>' : ''}</div></div></th><td>${esc(product.category)}</td><td>${money(product.price_cents)}</td><td>${product.stock}</td><td>${product.active ? `<div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-outline-primary" data-stock="${product.id}" aria-label="Set stock for ${esc(product.name)}">Set stock</button>${admin ? `<button class="btn btn-sm btn-outline-primary" data-edit="${product.id}" aria-label="Edit ${esc(product.name)}">Edit</button><button class="btn btn-sm btn-outline-danger" data-delete="${product.id}" aria-label="Delete ${esc(product.name)}">Delete</button>` : ''}</div>` : 'Archived'}</td></tr>`))}`;
  target.querySelector('#add-product')?.addEventListener('click', () => editor());
  target.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => editor(products.find(item => item.id === button.dataset.edit))));
  target.querySelectorAll('[data-stock]').forEach(button => button.addEventListener('click', () => {
    const product = products.find(item => item.id === button.dataset.stock);
    openModal(`Set stock for ${product.name}`, `<form action="#" method="POST">${numberField('stock', 'Available stock', product.stock, 0, 100000)}<button class="btn btn-primary">Save stock</button>${feedback}</form>`, async body => {
      await api(`/products/${product.id}/stock`, { method: 'PATCH', body: { stock: Number(body.stock) } });
      notify('Inventory updated.'); await redraw();
    });
  }));
  target.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => {
    const product = products.find(item => item.id === button.dataset.delete);
    openModal('Delete product', `<form action="#" method="POST"><p>Remove ${esc(product.name)} from the catalog? Existing order records will be kept.</p><button class="btn btn-outline-danger">Delete product</button>${feedback}</form>`, async () => {
      await api(`/products/${product.id}`, { method: 'DELETE' }); notify('Product removed from the catalog.'); await redraw();
    });
  }));
}

async function users(target, _admin, redraw) {
  const accounts = await api('/users');
  target.innerHTML = `<button class="btn btn-primary mb-3" id="add-team-account">Create team account</button>${table(['Name', 'Email', 'Role', 'Account', 'Actions'], accounts.map(account => `<tr><th scope="row">${esc(account.name)}</th><td>${esc(account.email)}</td><td>${esc(label(account.role))}</td><td>${account.active ? 'Active' : 'Inactive'}</td><td>${account.role === 'admin' ? 'Administrator' : `<div class="d-flex flex-wrap gap-2"><button class="btn btn-sm btn-outline-primary" data-role="${account.id}">Change role</button><button class="btn btn-sm btn-outline-${account.active ? 'danger' : 'primary'}" data-account="${account.id}">${account.active ? 'Deactivate' : 'Reactivate'}</button></div>`}</td></tr>`))}`;
  target.querySelector('#add-team-account').addEventListener('click', () => {
    openModal('Create team account', `<form action="#" method="POST">
      ${textField('name', 'Full name', '')}
      <label class="form-label" for="email">Email address</label><input class="form-control mb-3" id="email" name="email" type="email" maxlength="254" autocomplete="off" required>
      <label class="form-label" for="role">Account role</label><select class="form-select mb-3" name="role" id="role" required><option value="staff">Staff</option><option value="admin">Administrator</option></select>
      <label class="form-label" for="password">Initial password</label><input class="form-control mb-3" id="password" name="password" type="password" minlength="10" maxlength="72" autocomplete="new-password" required>
      <button class="btn btn-primary">Create account</button>${feedback}</form>`, async values => {
      await api('/admin/users', { method: 'POST', body: values });
      notify('Team account created. They can sign in from Staff & admin.');
      await redraw();
    });
  });
  target.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => {
    const account = accounts.find(item => item.id === button.dataset.role);
    openModal(`Role for ${account.name}`, `<form action="#" method="POST"><label class="form-label" for="role">Account role</label><select class="form-select mb-3" name="role" id="role">${['customer', 'staff'].map(role => `<option value="${role}" ${role === account.role ? 'selected' : ''}>${label(role)}</option>`).join('')}</select><button class="btn btn-primary">Save role</button>${feedback}</form>`, async body => {
      await api(`/users/${account.id}/role`, { method: 'PATCH', body }); notify('Role updated.'); await redraw();
    });
  }));
  target.querySelectorAll('[data-account]').forEach(button => button.addEventListener('click', () => {
    const user = accounts.find(item => item.id === button.dataset.account);
    const action = user.active ? 'Deactivate' : 'Reactivate';
    openModal(`${action} account`, `<form action="#" method="POST"><p>${action} ${esc(user.email)}?</p><button class="btn btn-outline-${user.active ? 'danger' : 'primary'}">${action}</button>${feedback}</form>`, async () => {
      await api(`/users/${user.id}${user.active ? '' : '/reactivate'}`, { method: user.active ? 'DELETE' : 'POST' }); notify('Account updated.'); await redraw();
    });
  }));
}

async function vouchers(target, _admin, redraw) {
  const records = await api('/admin/vouchers');
  target.innerHTML = `<button class="btn btn-primary mb-3" id="add-voucher">Add voucher</button>${table(['Code', 'Discount', 'Minimum subtotal', 'Expiry', 'Active', 'Actions'], records.map(voucher => `<tr><th scope="row">${esc(voucher.code)}</th><td>${voucher.percent}%</td><td>${money(voucher.minimum_cents)}</td><td>${date(voucher.expires_at)}</td><td>${voucher.active ? 'Yes' : 'No'}</td><td><button class="btn btn-sm btn-outline-primary" data-voucher="${esc(voucher.code)}">Edit</button></td></tr>`))}`;
  const editor = (voucher = {}) => {
    const expiry = voucher.expires_at ? new Date(voucher.expires_at) : null;
    const localDate = expiry ? new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
    openModal(voucher.code ? 'Edit voucher' : 'Add voucher', `<form action="#" method="POST">${voucher.code ? `<p>Code <strong>${esc(voucher.code)}</strong></p>` : textField('code', 'Code', '', 30)}${numberField('percent', 'Discount (%)', voucher.percent, 1, 100)}${numberField('minimum', 'Minimum subtotal (₱)', (voucher.minimum_cents || 0) / 100, 0, 100000, '.01')}
      <label class="form-label" for="expires">Expiry date and time</label><input class="form-control mb-3" type="datetime-local" name="expires" id="expires" value="${localDate}" required><div class="form-check mb-3"><input class="form-check-input" id="active" name="active" type="checkbox" ${voucher.active !== false ? 'checked' : ''}><label class="form-check-label" for="active">Active</label></div><button class="btn btn-primary">Save voucher</button>${feedback}</form>`, async body => {
      await api(`/admin/vouchers/${encodeURIComponent(voucher.code || body.code)}`, { method: 'PUT', body: { percent: Number(body.percent), minimum_cents: Math.round(Number(body.minimum) * 100), expires_at: new Date(body.expires).toISOString(), active: body.active === 'on' } });
      notify('Voucher saved.'); await redraw();
    });
  };
  target.querySelector('#add-voucher').addEventListener('click', () => editor());
  target.querySelectorAll('[data-voucher]').forEach(button => button.addEventListener('click', () => editor(records.find(record => record.code === button.dataset.voucher))));
}
