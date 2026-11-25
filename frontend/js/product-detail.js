// One product: GET /api/products/:id
window.addEventListener('DOMContentLoaded', async () => {
  const box = document.getElementById('productDetail');
  const id = new URLSearchParams(location.search).get('id');

  if (!id) {
    box.innerHTML = '<p class="text-danger">No product selected.</p>';
    return;
  }

  try {
    const p = await api('/products/' + encodeURIComponent(id));
    const inStock = p.stock > 0;

    box.innerHTML = `
      <div class="row g-5 align-items-center">
        <div class="col-md-5 text-center"><span style="font-size: 140px;">${productIcon(p)}</span></div>
        <div class="col-md-7">
          <span class="badge text-bg-secondary mb-2">${escapeHTML(p.category)}</span>
          <h2 class="fw-bold">${escapeHTML(p.name)}</h2>
          <h3 class="product-price fw-bold">${peso(p.price)}</h3>
          <p>${escapeHTML(p.description)}</p>
          <p><strong>Availability:</strong>
            <span class="${inStock ? 'text-success' : 'text-danger'}">${inStock ? 'In Stock (' + p.stock + ')' : 'Out of Stock'}</span></p>
          <div class="mb-3" style="max-width:140px;">
            <label for="quantity" class="form-label">Quantity</label>
            <input type="number" id="quantity" class="form-control" value="1" min="1" max="${p.stock}" ${inStock ? '' : 'disabled'}>
          </div>
          <button id="addToCart" class="btn btn-primary" ${inStock ? '' : 'disabled'}>Add to Cart</button>
          <a href="cart.html" class="btn btn-outline-primary">View Cart</a>
        </div>
      </div>`;

    document.getElementById('addToCart').addEventListener('click', () => {
      const qty = Math.max(1, Math.min(Number(document.getElementById('quantity').value) || 1, p.stock));
      Cart.add(p, qty);
      showAlert(`${p.name} added to cart.`, 'success');
    });
  } catch (err) {
    box.innerHTML = `<p class="text-danger">${escapeHTML(err.message)}</p>`;
  }
});