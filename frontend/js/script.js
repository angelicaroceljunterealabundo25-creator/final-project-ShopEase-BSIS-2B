/* ShopEase frontend
 * One shared file for every page. Each page sets:
 *   <body data-page="products" data-area="store|staff|admin" data-roles="admin,staff">
 * data-roles is optional: if present, the visitor must be logged in with one of those roles.
 */

/* ---------- Helpers ---------- */

// Works when served by the backend (http://localhost:5000) and when a page
// is opened directly from the folder.
const API_BASE = location.protocol === 'file:' ? 'http://localhost:5000/api' : '/api';

// Escape text before putting it in HTML, so product names or reviews
// can never inject scripts.
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function peso(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function shortId(id) {
    return '#SE-' + String(id).slice(-6).toUpperCase();
}

function statusBadge(status) {
    const styles = {
        Processing: 'bg-warning text-dark',
        Shipped: 'bg-info text-dark',
        Completed: 'bg-success',
        Cancelled: 'bg-secondary'
    };
    return <span class="badge ${styles[status] || 'bg-light text-dark'}">${esc(status)}</span>;
}

function showAlert(message, type = 'danger') {
    let box = document.getElementById('alert-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'alert-box';
        box.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2000;max-width:360px;';
        document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = alert alert-${type} shadow-sm;
    el.textContent = message;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/* ---------- Auth (token kept in localStorage) ---------- */

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
    clear() {
        localStorage.removeItem('shopease_token');
        localStorage.removeItem('shopease_user');
    },
    logout() {
        Auth.clear();
        location.href = 'index.html';
    }
};

async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    let response;
    try {
        response = await fetch(API_BASE + path, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
    } catch (e) {
        throw new Error('Cannot reach the server. Is the backend running?');
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && token) {
        // Token expired or user was deleted
        Auth.clear();
        location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop());
        throw new Error('Please log in again');
    }

    if (!response.ok) throw new Error(data.message || 'Something went wrong');
    return data;
}

/* ---------- Cart (localStorage) ---------- */
// Only used for display. The server re-reads real prices and stock
// when the order is placed.

const Cart = {
    get() {
        try { return JSON.parse(localStorage.getItem('shopease_cart')) || []; }
        catch (e) { return []; }
    },
    set(items) {
        localStorage.setItem('shopease_cart', JSON.stringify(items));
        updateCartBadge();
    },
    add(product, quantity = 1) {
        const items = Cart.get();
        const line = items.find((i) => i.id === product._id);
        const max = product.stock;
        const wanted = (line ? line.quantity : 0) + quantity;

        if (wanted > max) {
            showAlert(Only ${max} in stock, 'warning');
            return false;
        }
        if (line) {
            line.quantity = wanted;
            line.price = product.price;
            line.stock = product.stock;
        } else {
            items.push({
                id: product._id, name: product.name, icon: product.icon,
                price: product.price, stock: product.stock, quantity
            });
        }
        Cart.set(items);
        showAlert(${product.name} added to cart, 'success');
        return true;
    },
    setQuantity(id, quantity) {
        Cart.set(Cart.get().map((i) => i.id === id ? { ...i, quantity } : i));
    },
    remove(id) { Cart.set(Cart.get().filter((i) => i.id !== id)); },
    clear() { Cart.set([]); },
    count() { return Cart.get().reduce((n, i) => n + i.quantity, 0); },
    total() { return Cart.get().reduce((sum, i) => sum + i.price * i.quantity, 0); }
};

function updateCartBadge() {
    const badge = document.getElementById('cart-count');
    if (badge) {
        const n = Cart.count();
        badge.textContent = n;
        badge.classList.toggle('d-none', n === 0);
    }
}

/* ---------- Navbar and access guard ---------- */

function renderNav() {
    const holder = document.getElementById('navbar');
    if (!holder) return;

    const area = document.body.dataset.area || 'store';
    const page = location.pathname.split('/').pop() || 'index.html';
    const user = Auth.getUser();
    const link = (href, label, extra = '') =>
        <a class="nav-link ${page === href ? 'active' : ''}" href="${href}">${label}${extra}</a>;

    let brand = 'ShopEase';
    let links = '';

    if (area === 'admin') {
        brand = 'ShopEase Admin';
        links = link('admin-products.html', 'Products') + link('admin-users.html', 'Users') +
            link('admin-reports.html', 'Reports') + link('index.html', 'Visit Store');
    } else if (area === 'staff') {
        brand = 'ShopEase Staff';
        links = link('staff-orders.html', 'Orders') + link('staff-inventory.html', 'Inventory') +
            link('index.html', 'Visit Store');
    } else {
        links = link('index.html', 'Home') + link('products.html', 'Products') +
            link('cart.html', 'Cart', ' <span id="cart-count" class="badge bg-primary rounded-pill d-none">0</span>');
        if (user) {
            links += link('orders.html', 'My Orders') + link('profile.html', 'Profile');
            if (user.role === 'admin') links += link('admin-products.html', 'Admin');
            if (user.role === 'staff') links += link('staff-orders.html', 'Staff');
        } else {
            links += link('login.html', 'Login') +
                '<a class="btn btn-primary ms-lg-2" href="register.html">Register</a>';
        }
    }

    if (user && area !== 'store') {
        links += <span class="nav-link text-muted">${esc(user.name)}</span>;
    }
    if (user) {
        links += '<a class="nav-link" href="#" id="logout-link">Logout</a>';
    }

    holder.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div class="container">
            <a class="navbar-brand fw-bold" href="index.html">${brand}</a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav-links">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="nav-links">
                <div class="navbar-nav ms-auto align-items-lg-center">${links}</div>
            </div>
        </div>
    </nav>`;

    const logout = document.getElementById('logout-link');
    if (logout) logout.addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
    updateCartBadge();
}

// Returns true if the visitor may stay on this page
function guardPage() {
    const roles = document.body.dataset.roles;
    if (!roles) return true;

    const user = Auth.getUser();
    if (!user || !Auth.getToken()) {
        location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()));
        return false;
    }
    const allowed = roles.split(',').map((r) => r.trim());
    if (roles !== 'any' && !allowed.includes(user.role)) {
        alert('You do not have access to that page.');
        location.replace('index.html');
        return false;
    }
    return true;
}

/* ---------- Shared pieces ---------- */

function productCard(p) {
    const out = p.stock <= 0;
    return `
    <div class="col-md-4 col-sm-6">
        <div class="card h-100">
            <div class="card-body text-center d-flex flex-column">
                <h1>${esc(p.icon)}</h1>
                <h5>${esc(p.name)}</h5>
                <p class="text-muted">${esc(p.description)}</p>
                <p class="fw-bold mb-1">${peso(p.price)}</p>
                <p class="small ${out ? 'text-danger' : 'text-muted'}">${out ? 'Out of stock' : p.stock + ' in stock'}</p>
                <div class="mt-auto">
                    <a href="product-details.html?id=${esc(p._id)}" class="btn btn-outline-primary">View Details</a>
                    <button class="btn btn-primary add-to-cart" data-id="${esc(p._id)}" ${out ? 'disabled' : ''}>Add to Cart</button>
                </div>
            </div>
        </div>
    </div>`;
}

// Wires every .add-to-cart button inside a container
function bindAddToCart(container, products) {
    container.querySelectorAll('.add-to-cart').forEach((btn) => {
        btn.addEventListener('click', () => {
            const product = products.find((p) => p._id === btn.dataset.id);
            if (product) Cart.add(product, 1);
        });
    });
}

function stars(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/* ---------- Pages ---------- */

const pages = {};

pages.index = async function () {
    const grid = document.getElementById('featured');
    try {
        const products = await api('/products?sort=newest');
        const featured = products.slice(0, 3);
        grid.innerHTML = featured.length
            ? featured.map(productCard).join('')
            : '<p class="text-muted">No products yet.</p>';
        bindAddToCart(grid, featured);
    } catch (e) {
        grid.innerHTML = <p class="text-danger">${esc(e.message)}</p>;
    }
};

pages.products = async function () {
    const grid = document.getElementById('product-grid');
    const form = document.getElementById('filter-form');
    const categorySelect = document.getElementById('category');
    const params = new URLSearchParams(location.search);

    try {
        const categories = await api('/products/categories');
        categorySelect.innerHTML = '<option value="">All categories</option>' +
            categories.map((c) => <option value="${esc(c)}">${esc(c)}</option>).join('');
    } catch (e) { /* the grid below will show the error */ }

    document.getElementById('search').value = params.get('search') || '';
    categorySelect.value = params.get('category') || '';

    async function load() {
        const query = new URLSearchParams();
        const values = {
            search: document.getElementById('search').value.trim(),
            category: categorySelect.value,
            sort: document.getElementById('sort').value,
            inStock: document.getElementById('in-stock').checked ? 'true' : ''
        };
        Object.entries(values).forEach(([k, v]) => { if (v) query.set(k, v); });

        grid.innerHTML = '<p class="text-muted">Loading...</p>';
        try {
            const products = await api('/products?' + query.toString());
            grid.innerHTML = products.length
                ? products.map(productCard).join('')
                : '<p class="text-muted">No products found.</p>';
            bindAddToCart(grid, products);
        } catch (e) {
            grid.innerHTML = <p class="text-danger">${esc(e.message)}</p>;
        }
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); load(); });
    ['category', 'sort', 'in-stock'].forEach((id) =>
        document.getElementById(id).addEventListener('change', load));
    load();
};

pages['product-details'] = async function () {
    const id = new URLSearchParams(location.search).get('id');
    const box = document.getElementById('product-box');

    if (!id) { box.innerHTML = '<p class="text-danger">No product selected.</p>'; return; }

    let product;
    try {
        product = await api('/products/' + encodeURIComponent(id));
    } catch (e) {
        box.innerHTML = <p class="text-danger">${esc(e.message)}</p>;
        return;
    }

    const out = product.stock <= 0;
    box.innerHTML = `
    <div class="card p-4">
        <div class="row align-items-center">
            <div class="col-md-5 text-center"><h1 style="font-size:110px;">${esc(product.icon)}</h1></div>
            <div class="col-md-7">
                <h2 class="fw-bold">${esc(product.name)}</h2>
                <p class="text-muted">${esc(product.category)}</p>
                <p>${esc(product.description)}</p>
                <p class="text-warning mb-1">${stars(Math.round(product.averageRating))}
                    <span class="text-muted small">(${product.reviewCount} review${product.reviewCount === 1 ? '' : 's'})</span></p>
                <h3 class="fw-bold">${peso(product.price)}</h3>
                <p class="${out ? 'text-danger' : 'text-muted'}">${out ? 'Out of stock' : product.stock + ' in stock'}</p>
                <div class="d-flex gap-2 align-items-center">
                    <input type="number" id="qty" class="form-control" value="1" min="1" max="${product.stock}" style="width:90px;" ${out ? 'disabled' : ''}>
                    <button class="btn btn-primary" id="add-btn" ${out ? 'disabled' : ''}>Add to Cart</button>
                    <a href="cart.html" class="btn btn-outline-primary">Go to Cart</a>
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('add-btn').addEventListener('click', () => {
        const qty = parseInt(document.getElementById('qty').value, 10);
        if (!Number.isInteger(qty) || qty < 1) return showAlert('Enter a valid quantity', 'warning');
        Cart.add(product, qty);
    });

    // Reviews
    const list = document.getElementById('review-list');
    const formBox = document.getElementById('review-form-box');
    const user = Auth.getUser();

    async function loadReviews() {
        try {
            const reviews = await api(/products/${encodeURIComponent(id)}/reviews);
            list.innerHTML = reviews.length ? reviews.map((r) => `
                <div class="border-bottom py-2">
                    <strong>${esc(r.user ? r.user.name : 'Deleted user')}</strong>
                    <span class="text-warning ms-2">${stars(r.rating)}</span>
                    <div class="small text-muted">${formatDate(r.createdAt)}</div>
                    ${r.comment ? <p class="mb-0">${esc(r.comment)}</p> : ''}
                    ${user && (user.role === 'admin' || (r.user && r.user._id === user.id))
                        ? <button class="btn btn-sm btn-link text-danger p-0 delete-review" data-id="${esc(r._id)}">Delete</button> : ''}
                </div>`).join('') : '<p class="text-muted">No reviews yet.</p>';

            list.querySelectorAll('.delete-review').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    try {
                        await api('/reviews/' + btn.dataset.id, { method: 'DELETE' });
                        loadReviews();
                    } catch (e) { showAlert(e.message); }
                }));
        } catch (e) { list.innerHTML = <p class="text-danger">${esc(e.message)}</p>; }
    }

    if (user) {
        formBox.innerHTML = `
        <form id="review-form" class="mb-3">
            <div class="row g-2">
                <div class="col-md-3">
                    <select id="rating" class="form-select" required>
                        <option value="">Rating</option>
                        <option value="5">5 - Excellent</option><option value="4">4 - Good</option>
                        <option value="3">3 - Okay</option><option value="2">2 - Poor</option>
                        <option value="1">1 - Bad</option>
                    </select>
                </div>
                <div class="col-md-7"><input id="comment" class="form-control" placeholder="Write a comment (optional)"></div>
                <div class="col-md-2"><button class="btn btn-primary w-100">Submit</button></div>
            </div>
        </form>`;
        document.getElementById('review-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await api(/products/${encodeURIComponent(id)}/reviews, {
                    method: 'POST',
                    body: {
                        rating: Number(document.getElementById('rating').value),
                        comment: document.getElementById('comment').value
                    }
                });
                showAlert('Review saved', 'success');
                loadReviews();
            } catch (err) { showAlert(err.message); }
        });
    } else {
        formBox.innerHTML = '<p class="text-muted"><a href="login.html?next=' +
            encodeURIComponent('product-details.html?id=' + id) + '">Log in</a> to write a review.</p>';
    }
    loadReviews();
};

pages.cart = async function () {
    const body = document.getElementById('cart-body');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    // Refresh prices and stock from the server in case they changed
    try {
        const products = await api('/products');
        const items = Cart.get()
            .filter((i) => products.some((p) => p._id === i.id))
            .map((i) => {
                const p = products.find((x) => x._id === i.id);
                return { ...i, name: p.name, icon: p.icon, price: p.price, stock: p.stock,
                    quantity: Math.min(i.quantity, Math.max(p.stock, 1)) };
            })
            .filter((i) => i.stock > 0);
        Cart.set(items);
    } catch (e) { /* show the saved cart if the server is unreachable */ }

    function draw() {
        const items = Cart.get();
        if (!items.length) {
            body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Your cart is empty.</td></tr>';
            checkoutBtn.classList.add('disabled');
        } else {
            checkoutBtn.classList.remove('disabled');
            body.innerHTML = items.map((i) => `
            <tr>
                <td>${esc(i.icon)} ${esc(i.name)}</td>
                <td>${peso(i.price)}</td>
                <td><input type="number" class="form-control qty" data-id="${esc(i.id)}" value="${i.quantity}" min="1" max="${i.stock}" style="width:80px;"></td>
                <td>${peso(i.price * i.quantity)}</td>
                <td><button class="btn btn-sm btn-outline-danger remove" data-id="${esc(i.id)}">Remove</button></td>
            </tr>`).join('');
        }
        totalEl.textContent = peso(Cart.total());

        body.querySelectorAll('.qty').forEach((input) =>
            input.addEventListener('change', () => {
                const item = Cart.get().find((i) => i.id === input.dataset.id);
                let q = parseInt(input.value, 10);
                if (!Number.isInteger(q) || q < 1) q = 1;
                if (item && q > item.stock) { q = item.stock; showAlert(Only ${item.stock} in stock, 'warning'); }
                Cart.setQuantity(input.dataset.id, q);
                draw();
            }));
        body.querySelectorAll('.remove').forEach((btn) =>
            btn.addEventListener('click', () => { Cart.remove(btn.dataset.id); draw(); }));
    }
    draw();
};

pages.checkout = async function () {
    const items = Cart.get();
    if (!items.length) { location.replace('cart.html'); return; }

    const user = Auth.getUser();
    document.getElementById('fullName').value = user.name || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('address').value = user.address || '';

    document.getElementById('summary').innerHTML = items.map((i) => `
        <div class="d-flex justify-content-between mb-3">
            <span>${esc(i.name)} × ${i.quantity}</span><span>${peso(i.price * i.quantity)}</span>
        </div>`).join('');
    document.getElementById('summary-total').textContent = peso(Cart.total());

    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true;
        try {
            await api('/orders', {
                method: 'POST',
                body: {
                    items: Cart.get().map((i) => ({ product: i.id, quantity: i.quantity })),
                    contactName: document.getElementById('fullName').value,
                    contactPhone: document.getElementById('phone').value,
                    deliveryAddress: document.getElementById('address').value,
                    paymentMethod: document.getElementById('payment').value
                }
            });
            Cart.clear();
            alert('Order placed successfully!');
            location.href = 'orders.html';
        } catch (err) {
            showAlert(err.message);
            btn.disabled = false;
        }
    });
};

pages.orders = async function () {
    const box = document.getElementById('orders-box');

    async function load() {
        try {
            const orders = await api('/orders/my');
            if (!orders.length) {
                box.innerHTML = `<div class="card p-4 text-center">
                    <h5>You have no orders yet</h5>
                    <p class="text-muted">Start shopping to place your first order.</p>
                    <div><a href="products.html" class="btn btn-primary">Continue Shopping</a></div></div>`;
                return;
            }
            box.innerHTML = `<div class="card p-4"><div class="table-responsive">
            <table class="table align-middle">
                <thead><tr><th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead>
                <tbody>${orders.map((o) => `
                    <tr>
                        <td>${shortId(o._id)}</td>
                        <td>${formatDate(o.createdAt)}</td>
                        <td>${o.products.map((p) => ${esc(p.name)} × ${p.quantity}).join('<br>')}</td>
                        <td>${peso(o.totalAmount)}</td>
                        <td>${statusBadge(o.status)}</td>
                        <td>${o.status === 'Processing'
                            ? <button class="btn btn-sm btn-outline-danger cancel" data-id="${esc(o._id)}">Cancel</button> : ''}</td>
                    </tr>`).join('')}
                </tbody></table></div></div>`;

            box.querySelectorAll('.cancel').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    if (!confirm('Cancel this order?')) return;
                    try {
                        await api(/orders/${btn.dataset.id}/cancel, { method: 'PUT' });
                        showAlert('Order cancelled', 'success');
                        load();
                    } catch (e) { showAlert(e.message); }
                }));
        } catch (e) { box.innerHTML = <p class="text-danger">${esc(e.message)}</p>; }
    }
    load();
};

pages.profile = async function () {
    const form = document.getElementById('profile-form');
    const field = (id) => document.getElementById(id);

    try {
        const me = await api('/auth/me');
        Auth.saveUser(me);
        field('fullName').value = me.name;
        field('email').value = me.email;
        field('phone').value = me.phone || '';
        field('address').value = me.address || '';
        field('role-label').textContent = me.role.charAt(0).toUpperCase() + me.role.slice(1) + ' Account';
    } catch (e) { showAlert(e.message); }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: field('fullName').value,
            phone: field('phone').value,
            address: field('address').value
        };
        if (field('newPassword').value) {
            body.currentPassword = field('currentPassword').value;
            body.newPassword = field('newPassword').value;
        }
        try {
            const result = await api('/auth/me', { method: 'PUT', body });
            Auth.saveUser(result.user);
            field('currentPassword').value = '';
            field('newPassword').value = '';
            showAlert('Profile updated', 'success');
        } catch (err) { showAlert(err.message); }
    });
};

pages.login = function () {
    if (Auth.getUser() && Auth.getToken()) { location.replace('index.html'); return; }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const data = await api('/auth/login', {
                method: 'POST',
                body: {
                    email: document.getElementById('email').value,
                    password: document.getElementById('password').value
                }
            });
            Auth.save(data.token, data.user);

            // Only follow simple same-site page names, never other websites
            const next = new URLSearchParams(location.search).get('next');
            const safeNext = next && /^[\w\-]+\.html(\?[\w=&%\-]*)?$/.test(next) ? next : null;
            const home = { admin: 'admin-products.html', staff: 'staff-orders.html' }[data.user.role] || 'index.html';
            location.href = safeNext || home;
        } catch (err) { showAlert(err.message); }
    });
};

pages.register = function () {
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        if (password !== document.getElementById('confirm').value) {
            return showAlert('Passwords do not match');
        }
        try {
            const data = await api('/auth/register', {
                method: 'POST',
                body: {
                    name: document.getElementById('name').value,
                    email: document.getElementById('email').value,
                    password
                }
            });
            Auth.save(data.token, data.user);
            location.href = 'index.html';
        } catch (err) { showAlert(err.message); }
    });
};

/* ----- Admin ----- */

pages['admin-products'] = async function () {
    const body = document.getElementById('product-rows');
    const modalEl = document.getElementById('product-modal');
    const modal = new bootstrap.Modal(modalEl);
    const form = document.getElementById('product-form');
    let products = [];

    async function load() {
        try {
            products = await api('/products');
            body.innerHTML = products.length ? products.map((p) => `
            <tr>
                <td>${esc(p._id.slice(-6).toUpperCase())}</td>
                <td>${esc(p.icon)} ${esc(p.name)}</td>
                <td>${esc(p.category)}</td>
                <td>${peso(p.price)}</td>
                <td>${p.stock}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit" data-id="${esc(p._id)}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger delete" data-id="${esc(p._id)}">Delete</button>
                </td>
            </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">No products yet.</td></tr>';

            body.querySelectorAll('.edit').forEach((b) =>
                b.addEventListener('click', () => open(products.find((p) => p._id === b.dataset.id))));
            body.querySelectorAll('.delete').forEach((b) =>
                b.addEventListener('click', async () => {
                    if (!confirm('Delete this product?')) return;
                    try {
                        await api('/products/' + b.dataset.id, { method: 'DELETE' });
                        load();
                    } catch (e) { showAlert(e.message); }
                }));
        } catch (e) { body.innerHTML = <tr><td colspan="6" class="text-danger">${esc(e.message)}</td></tr>; }
    }

    function open(product) {
        form.reset();
        document.getElementById('product-id').value = product ? product._id : '';
        document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
        if (product) {
            ['name', 'description', 'price', 'category', 'stock', 'icon'].forEach((k) => {
                document.getElementById('p-' + k).value = product[k];
            });
        } else {
            document.getElementById('p-icon').value = '📦';
        }
        modal.show();
    }

    document.getElementById('add-product-btn').addEventListener('click', () => open(null));

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;
        const data = {
            name: document.getElementById('p-name').value,
            description: document.getElementById('p-description').value,
            price: Number(document.getElementById('p-price').value),
            category: document.getElementById('p-category').value,
            stock: Number(document.getElementById('p-stock').value),
            icon: document.getElementById('p-icon').value || '📦'
        };
        try {
            await api(id ? '/products/' + id : '/products', { method: id ? 'PUT' : 'POST', body: data });
            modal.hide();
            showAlert(id ? 'Product updated' : 'Product added', 'success');
            load();
        } catch (err) { showAlert(err.message); }
    });

    load();
};

pages['admin-users'] = async function () {
    const body = document.getElementById('user-rows');
    const me = Auth.getUser();

    async function load() {
        try {
            const users = await api('/auth/users');
            body.innerHTML = users.map((u) => {
                const self = u.id === me.id;
                return `
                <tr>
                    <td>${esc(u.name)}</td>
                    <td>${esc(u.email)}</td>
                    <td>
                        <select class="form-select form-select-sm role-select" data-id="${esc(u.id)}" ${self ? 'disabled' : ''}>
                            ${['customer', 'staff', 'admin'].map((r) =>
                                <option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>).join('')}
                        </select>
                    </td>
                    <td>${self ? '<span class="text-muted small">(you)</span>'
                        : `<button class="btn btn-sm btn-outline-danger delete" data-id="${esc(u.id)}">Delete</button>`}</td>
                </tr>`;
            }).join('');

            body.querySelectorAll('.role-select').forEach((sel) =>
                sel.addEventListener('change', async () => {
                    try {
                        await api(/auth/users/${sel.dataset.id}/role, { method: 'PUT', body: { role: sel.value } });
                        showAlert('Role updated', 'success');
                    } catch (e) { showAlert(e.message); load(); }
                }));
            body.querySelectorAll('.delete').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this user?')) return;
                    try {
                        await api('/auth/users/' + btn.dataset.id, { method: 'DELETE' });
                        load();
                    } catch (e) { showAlert(e.message); }
                }));
        } catch (e) { body.innerHTML = <tr><td colspan="4" class="text-danger">${esc(e.message)}</td></tr>; }
    }
    load();
};

pages['admin-reports'] = async function () {
    try {
        const r = await api('/reports/summary');
        document.getElementById('r-products').textContent = r.totalProducts;
        document.getElementById('r-orders').textContent = r.totalOrders;
        document.getElementById('r-users').textContent = r.totalUsers;
        document.getElementById('r-revenue').textContent = peso(r.totalRevenue);

        document.getElementById('r-status').innerHTML = ['Processing', 'Shipped', 'Completed', 'Cancelled']
            .map((s) => <li class="list-group-item d-flex justify-content-between">${statusBadge(s)}<strong>${r.ordersByStatus[s] || 0}</strong></li>).join('');

        document.getElementById('r-lowstock').innerHTML = r.lowStock.length
            ? r.lowStock.map((p) => `<li class="list-group-item d-flex justify-content-between">
                <span>${esc(p.icon)} ${esc(p.name)}</span>
                <strong class="${p.stock === 0 ? 'text-danger' : ''}">${p.stock}</strong></li>`).join('')
            : '<li class="list-group-item text-muted">All products have enough stock.</li>';

        document.getElementById('r-recent').innerHTML = r.recentOrders.length
            ? r.recentOrders.map((o) => `<tr>
                <td>${shortId(o._id)}</td>
                <td>${esc(o.user ? o.user.name : 'Deleted user')}</td>
                <td>${formatDate(o.createdAt)}</td>
                <td>${peso(o.totalAmount)}</td>
                <td>${statusBadge(o.status)}</td></tr>`).join('')
            : '<tr><td colspan="5" class="text-center text-muted">No orders yet.</td></tr>';
    } catch (e) { showAlert(e.message); }
};

/* ----- Staff ----- */

pages['staff-orders'] = async function () {
    const body = document.getElementById('order-rows');

    async function load() {
        try {
            const orders = await api('/orders');
            body.innerHTML = orders.length ? orders.map((o) => `
            <tr>
                <td>${shortId(o._id)}</td>
                <td>${esc(o.user ? o.user.name : 'Deleted user')}</td>
                <td>${o.products.map((p) => ${esc(p.name)} × ${p.quantity}).join(', ')}</td>
                <td>${peso(o.totalAmount)}</td>
                <td>${statusBadge(o.status)}</td>
                <td>
                    <select class="form-select form-select-sm status-select" data-id="${esc(o._id)}" ${o.status === 'Cancelled' ? 'disabled' : ''}>
                        ${['Processing', 'Shipped', 'Completed', 'Cancelled'].map((s) =>
                            <option ${o.status === s ? 'selected' : ''}>${s}</option>).join('')}
                    </select>
                </td>
            </tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">No orders yet.</td></tr>';

            body.querySelectorAll('.status-select').forEach((sel) =>
                sel.addEventListener('change', async () => {
                    if (sel.value === 'Cancelled' && !confirm('Cancel this order? Stock will be returned.')) { load(); return; }
                    try {
                        await api(/orders/${sel.dataset.id}/status, { method: 'PUT', body: { status: sel.value } });
                        showAlert('Order updated', 'success');
                        load();
                    } catch (e) { showAlert(e.message); load(); }
                }));
        } catch (e) { body.innerHTML = <tr><td colspan="6" class="text-danger">${esc(e.message)}</td></tr>; }
    }
    load();
};

pages['staff-inventory'] = async function () {
    const body = document.getElementById('inventory-rows');

    async function load() {
        try {
            const products = await api('/products');
            body.innerHTML = products.map((p) => `
            <tr>
                <td>${esc(p._id.slice(-6).toUpperCase())}</td>
                <td>${esc(p.icon)} ${esc(p.name)}</td>
                <td>${esc(p.category)}</td>
                <td>${p.stock <= 0 ? '<span class="badge bg-danger">Out of stock</span>'
                    : p.stock <= 10 ? <span class="badge bg-warning text-dark">Low (${p.stock})</span>
                    : `<span class="badge bg-success">${p.stock}</span>`}</td>
                <td>
                    <div class="input-group input-group-sm" style="max-width:170px;">
                        <input type="number" min="0" class="form-control stock-input" value="${p.stock}">
                        <button class="btn btn-outline-primary save-stock" data-id="${esc(p._id)}">Save</button>
                    </div>
                </td>
            </tr>`).join('') || '<tr><td colspan="5" class="text-center text-muted">No products.</td></tr>';

            body.querySelectorAll('.save-stock').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    const value = Number(btn.previousElementSibling.value);
                    if (!Number.isInteger(value) || value < 0) return showAlert('Enter a valid stock number', 'warning');
                    try {
                        await api('/products/' + btn.dataset.id, { method: 'PUT', body: { stock: value } });
                        showAlert('Stock updated', 'success');
                        load();
                    } catch (e) { showAlert(e.message); }
                }));
        } catch (e) { body.innerHTML = <tr><td colspan="5" class="text-danger">${esc(e.message)}</td></tr>; }
    }
    load();
};

/* ---------- Start ---------- */

document.addEventListener('DOMContentLoaded', () => {
    if (!guardPage()) return;
    renderNav();
    const init = pages[document.body.dataset.page];
    if (init) init();
});
localhost