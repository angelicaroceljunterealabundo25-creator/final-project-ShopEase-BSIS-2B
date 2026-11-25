
// Staff inventory: GET /api/products, update stock with PUT /api/products/:id
async function loadInventory() {
  const body = document.getElementById('inventoryBody');
  try {
    const products = await api('/products');

    body.innerHTML = products.map((p) => `
      <tr>
        <td>${shortId(p._id)}</td>
        <td>${escapeHTML(p.name)}</td>
        <td style="width:130px;"><input type="number" class="form-control form-control-sm stock" min="0" value="${p.stock}"></td>
        <td>${p.stock === 0 ? '<span class="badge text-bg-danger">Out of Stock</span>' : p.stock <= 5 ? '<span class="badge text-bg-warning">Low Stock</span>' : '<span class="badge text-bg-success">In Stock</span>'}</td>
        <td><button class="btn btn-sm btn-primary save" data-id="${p._id}">Save Changes</button></td>
      </tr>`).join('');

    body.querySelectorAll('.save').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const stock = Number(btn.closest('tr').querySelector('.stock').value);
        if (!(stock >= 0)) return showAlert('Stock cannot be negative.');
        try {
          await api('/products/' + btn.dataset.id, { method: 'PUT', body: { stock } });
          showAlert('Stock updated.', 'success');
          loadInventory();
        } catch (err) { showAlert(err.message); }
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escapeHTML(err.message)}</td></tr>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (Auth.require('staff', 'admin')) loadInventory();
});