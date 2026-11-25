// Dashboard (admin/staff): counts + recent orders + user list
window.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.require('admin', 'staff')) return;

  const isAdmin = Auth.getUser().role === 'admin';
  try {
    const [orders, products, users] = await Promise.all([
      api('/orders'),
      api('/products'),
      isAdmin ? api('/users') : Promise.resolve([])
    ]);

    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statOrders').textContent = orders.length;
    document.getElementById('statUsers').textContent = isAdmin ? users.length : '—';
    document.getElementById('statLow').textContent = products.filter((p) => p.stock <= 5).length;

    document.getElementById('recentOrders').innerHTML = orders.length === 0
      ? '<tr><td colspan="4" class="text-center text-muted">No orders yet.</td></tr>'
      : orders.slice(0, 5).map((o) => `
        <tr>
          <td>${shortId(o._id)}</td>
          <td>${escapeHTML(o.user ? o.user.name : 'Deleted user')}</td>
          <td>${peso(o.totalAmount)}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>`).join('');

    const container = document.getElementById('userList');
    if (isAdmin) {
      container.innerHTML = '';
      users.forEach((user) => {
        const div = document.createElement('div');
        div.className = 'card mb-2 p-3';
        div.innerHTML = `<h5>${escapeHTML(user.name)}</h5><p class="mb-0">${escapeHTML(user.email)}</p>`;
        container.appendChild(div);
      });
    } else {
      container.innerHTML = '<p class="text-muted">Only admins can see the user list.</p>';
    }
  } catch (err) { showAlert(err.message); }
});