// Admin reports: totals from GET /api/orders and GET /api/users
window.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.require('admin')) return;

  try {
    const [orders, users] = await Promise.all([api('/orders'), api('/users')]);
    const sales = orders
      .filter((o) => o.status !== 'Cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);

    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statSales').textContent = peso(sales);
    document.getElementById('statUsers').textContent = users.length;

    const body = document.getElementById('recentOrders');
    body.innerHTML = orders.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted">No orders yet.</td></tr>'
      : orders.slice(0, 10).map((o) => `
        <tr>
          <td>${shortId(o._id)}</td>
          <td>${formatDate(o.createdAt)}</td>
          <td>${escapeHTML(o.user ? o.user.name : 'Deleted user')}</td>
          <td>${peso(o.totalAmount)}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>`).join('');
  } catch (err) { showAlert(err.message); }
});