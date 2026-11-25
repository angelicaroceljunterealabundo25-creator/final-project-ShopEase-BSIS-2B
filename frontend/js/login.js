// Login form -> POST /api/auth/login
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    Auth.save(data.token, data.user);

    const next = new URLSearchParams(location.search).get('next');
    const home = { admin: 'dashboard.html', staff: 'staff-orders.html' }[data.user.role] || 'products.html';
    location.href = next || home;
  } catch (err) {
    showAlert(err.message);
  }
});