// PHASE 5: show products from GET /api/products
async function loadProducts() {
  const tbody = document.getElementById('productTableBody');
  try {
    const res = await fetch(API_URL + '/products');
    const products = await res.json();

    tbody.innerHTML = '';

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No products found.</td></tr>';
      return;
    }

    products.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHTML(String(p._id || p.id).slice(-6).toUpperCase())}</td>
        <td>${escapeHTML(p.name)}</td>
        <td>${escapeHTML(p.category)}</td>
        <td>₱${escapeHTML(p.price)}</td>
        <td>${escapeHTML(p.stock)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#editModal">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-bs-toggle="modal" data-bs-target="#deleteModal">Delete</button>
        </td>`;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load products.</td></tr>';
  }
}

window.onload = loadProducts;

// PHASE 4: Add Product form -> POST /api/products
document.getElementById('productForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const name = document.getElementById('productName').value.trim();
  const category = document.getElementById('productCategory').value.trim();
  const price = Number(document.getElementById('productPrice').value);
  const stock = Number(document.getElementById('productStock').value);

  // Validation
  if (!name || !category) return alert('All fields are required.');
  if (price <= 0) return alert('Price must be greater than 0.');
  if (stock < 0) return alert('Stock cannot be negative.');

  try {
    const response = await fetch(API_URL + '/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, price, stock })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Product added successfully!');
      this.reset();
      bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
      loadProducts();
    } else {
      alert(`Error: ${data.message || 'Failed to add product'}`);
    }
  } catch (err) {
    console.error(err);
    alert('Cannot connect to the server. Is the backend running?');
  }
});
