// My orders: GET /api/orders/my, cancel with PUT /api/orders/:id/cancel
async function loadOrders() {
  const box = document.getElementById('orderList');
  try {
    const orders = await api('/orders/my');

    if (orders.length === 0) {
      box.innerHTML = '<p class="text-center text-muted">You have no orders yet. <a href="products.html">Start shopping</a></p>';
      return;
    }

    box.innerHTML = orders.map((o) => `
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <div class="d-flex justify-content-between flex-wrap">
            <h5 class="fw-bold mb-1">${shortId(o._id)}</h5>
            <div>${statusBadge(o.status)}</div>
          </div>
          <p class="text-muted small mb-2">${formatDate(o.createdAt)} · ${escapeHTML(o.paymentMethod)}</p>
          <ul class="mb-2">
            ${o.products.map((i) => `<li>${escapeHTML(i.product ? i.product.name : 'Removed product')} × ${i.quantity}</li>`).join('')}
          </ul>
          <p class="mb-1"><strong>Total:</strong> ${peso(o.totalAmount)}</p>
          <p class="small text-muted mb-2">Deliver to: ${escapeHTML(o.deliveryAddress)}</p>
          ${o.status === 'Processing' ? `<button class="btn btn-sm btn-outline-danger cancel" data-id="${o._id}">Cancel order</button>` : ''}
        </div>
      </div>`).join('');

    box.querySelectorAll('.cancel').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Cancel this order?')) return;
        try {
          await api(`/orders/${btn.dataset.id}/cancel`, { method: 'PUT' });
          loadOrders();
        } catch (err) { showAlert(err.message); }
      });
    });
  } catch (err) {
    box.innerHTML = `<p class="text-center text-danger">${escapeHTML(err.message)}</p>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (Auth.require()) loadOrders();
});