
// Product catalog: GET /api/products with search + category filter.
// The last result is saved in IndexedDB so the list still shows when offline.
let allProducts = [];

function renderProducts() {
  const term = document.getElementById('search').value.trim().toLowerCase();
  const category = document.getElementById('categoryFilter').value;
  const grid = document.getElementById('productGrid');

  const list = allProducts.filter((p) =>
    (!category || p.category === category) &&
    (!term || p.name.toLowerCase().includes(term))
  );

  if (list.length === 0) {
    grid.innerHTML = '<p class="text-center text-muted">No products found.</p>';
    return;
  }

  grid.innerHTML = list.map((p) => `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100 shadow-sm">
        <div class="card-body text-center d-flex flex-column">
          <div class="product-icon mb-3"><span style="font-size: 60px;">${productIcon(p)}</span></div>
          <h5 class="fw-bold">${escapeHTML(p.name)}</h5>
          <p class="text-muted small mb-1">${escapeHTML(p.category)}</p>
          <p class="product-price fw-bold">${peso(p.price)}</p>
          <p class="small ${p.stock > 0 ? 'text-success' : 'text-danger'}">${p.stock > 0 ? p.stock + ' in stock' : 'Out of stock'}</p>
          <a href="product-details.html?id=${encodeURIComponent(p._id)}" class="btn btn-outline-primary mt-auto">View Details</a>
        </div>
      </div>
    </div>`).join('');
}

function fillCategories() {
  const select = document.getElementById('categoryFilter');
  const current = select.value;
  const categories = [...new Set(allProducts.map((p) => p.category))].sort();
  select.innerHTML = '<option value="">All categories</option>' +
    categories.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  select.value = current;
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    allProducts = await api('/products');
    ProductCache.save(allProducts);
  } catch (err) {
    allProducts = await ProductCache.load();
    if (allProducts.length) {
      showAlert('Offline: showing the last saved product list.', 'warning');
    } else {
      document.getElementById('productGrid').innerHTML =
        `<p class="text-center text-danger">${escapeHTML(err.message)}</p>`;
      return;
    }
  }
  fillCategories();
  renderProducts();
});

document.getElementById('search').addEventListener('input', renderProducts);
document.getElementById('categoryFilter').addEventListener('change', renderProducts);