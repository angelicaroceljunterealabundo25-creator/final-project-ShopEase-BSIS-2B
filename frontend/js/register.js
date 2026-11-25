
100%
// Register form -> POST /api/users
document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword');

  if (confirm && confirm.value !== password) {
    return showAlert('Passwords do not match.');
  }
  if (password.length < 6) {
    return showAlert('Password must be at least 6 characters.');
  }

  try {
    await api('/users', { method: 'POST', body: { name, email, password } });
    alert('User registered successfully!');
    location.href = 'login.html';
  } catch (err) {
    showAlert(`Error: ${err.message}`);
  }
});