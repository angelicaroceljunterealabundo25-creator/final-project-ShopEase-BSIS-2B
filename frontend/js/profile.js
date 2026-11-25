// Profile: GET/PUT /api/auth/me
window.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.require()) return;

  try {
    const me = await api('/auth/me');
    document.getElementById('profileName').value = me.name;
    document.getElementById('profileEmail').value = me.email;
    document.getElementById('profileRole').textContent = me.role;
  } catch (err) { showAlert(err.message); }
});

document.getElementById('profileForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  try {
    const data = await api('/auth/me', {
      method: 'PUT',
      body: {
        name: document.getElementById('profileName').value.trim(),
        email: document.getElementById('profileEmail').value.trim()
      }
    });
    Auth.saveUser({ ...Auth.getUser(), name: data.user.name, email: data.user.email });
    showAlert('Profile updated.', 'success');
  } catch (err) { showAlert(err.message); }
});

document.getElementById('passwordForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const password = document.getElementById('newPassword').value;
  if (password.length < 6) return showAlert('Password must be at least 6 characters.');
  if (password !== document.getElementById('confirmNewPassword').value) return showAlert('Passwords do not match.');
  try {
    await api('/auth/me', { method: 'PUT', body: { password } });
    this.reset();
    showAlert('Password changed.', 'success');
  } catch (err) { showAlert(err.message); }
});