
// Admin products - full CRUD
//  READ   GET    /api/products
//  CREATE POST   /api/products
//  UPDATE PUT    /api/products/:id
//  DELETE DELETE /api/products/:id
let products = [];
let deleteId = null;

async function loadProducts() {
  const tbody = document.getElementById('productTableBody');
  try {
    products = await api('/products');

    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No products found.</td></tr>';
      return;
    }

    tbody.innerHTML = products.map((p) => `
      <tr>
        <td>${escapeHTML(shortId(p._id))}</td>
        <td>${escapeHTML(p.name)}</td>
        <td>${escapeHTML(p.category)}</td>
        <td>${peso(p.price)}</td>
        <td>${escapeHTML(p.stock)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${p._id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${p._id}">Delete</button>
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">${escapeHTML(err.message)}</td></tr>`;
  }
}

const productModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('productModal'));
const deleteModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal'));

// Buttons inside the table (works for rows added later too)
document.getElementById('productTableBody').addEventListener('click', (e) => {
  const edit = e.target.closest('.edit-btn');
  const del = e.target.closest('.delete-btn');

  if (edit) {
    // EDIT: fill the modal with the product's current values
    const p = products.find((x) => x._id === edit.dataset.id);
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productId').value = p._id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productCategory').value = p.category;
    document.getElementById('productDescription').value = p.description;
    document.getElementById('productPrice').value = p.price;
    document.getElementById('productStock').value = p.stock;
    productModal().show();
  }

  if (del) {
    deleteId = del.dataset.id;
    const p = products.find((x) => x._id === deleteId);
    document.getElementById('deleteName').textContent = p ? p.name : 'this product';
    deleteModal().show();
  }
});

// ADD: open an empty form
document.getElementById('addProductBtn').addEventListener('click', () => {
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = 'Add Product';
  productModal().show();
});

// Save (POST when new, PUT when editing)
document.getElementById('productForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const id = document.getElementById('productId').value;
  const body = {
    name: document.getElementById('productName').value.trim(),
    category: document.getElementById('productCategory').value.trim(),
    description: document.getElementById('productDescription').value.trim(),
    price: Number(document.getElementById('productPrice').value),
    stock: Number(document.getElementById('productStock').value)
  };

  if (!body.name || !body.category || !body.description) return showAlert('All fields are required.');
  if (body.price <= 0) return showAlert('Price must be greater than 0.');
  if (body.stock < 0) return showAlert('Stock cannot be negative.');

  try {
    await api(id ? '/products/' + id : '/products', { method: id ? 'PUT' : 'POST', body });
    alert(id ? 'Product updated!' : 'Product added successfully!');
    productModal().hide();
    loadProducts();
  } catch (err) {
    showAlert(`Error: ${err.message}`);
  }
});

// DELETE after confirming in the modal
document.getElementById('confirmDelete').addEventListener('click', async () => {
  try {
    await api('/products/' + deleteId, { method: 'DELETE' });
    deleteModal().hide();
    alert('Product deleted');
    loadProducts();
  } catch (err) {
    showAlert(err.message);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (Auth.require('admin')) loadProducts();
});