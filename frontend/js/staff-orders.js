// Staff orders: GET /api/orders, change status with PUT /api/orders/:id
async function loadOrders() {
  const body = document.getElementById('orderTableBody');
  try {
    const orders = await api('/orders');

    body.innerHTML = orders.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted">No orders yet.</td></tr>'
      : orders.map((o) => `
        <tr>
          <td>${shortId(o._id)}</td>
          <td>${escapeHTML(o.user ? o.user.name : 'Deleted user')}</td>
          <td>${o.products.map((i) => escapeHTML((i.product ? i.product.name : 'Removed') + ' × ' + i.quantity)).join(', ')}</td>
          <td>${peso(o.totalAmount)}</td>
          <td>
            <select class="form-select form-select-sm status" data-id="${o._id}">
              ${['Processing', 'Completed', 'Cancelled'].map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('');

    body.querySelectorAll('.status').forEach((sel) => {
      sel.addEventListener('change', async () => {
        try {
          await api('/orders/' + sel.dataset.id, { method: 'PUT', body: { status: sel.value } });
          showAlert('Order status updated.', 'success');
        } catch (err) { showAlert(err.message); loadOrders(); }
      });
    });
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="text-center text-danger">${escapeHTML(err.message)}</td></tr>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (Auth.require('staff', 'admin')) loadOrders();
});