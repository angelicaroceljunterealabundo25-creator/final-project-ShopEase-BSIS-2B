
// Admin users - view, search, edit role/name/email, delete
//  READ   GET    /api/users
//  UPDATE PUT    /api/users/:id
//  DELETE DELETE /api/users/:id
let users = [];
let deleteUserId = null;

function showUsers(list) {
  const tbody = document.getElementById('userTableBody');

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No users found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map((u) => `
    <tr>
      <td>${escapeHTML(shortId(u._id).replace('SE', 'USR'))}</td>
      <td>${escapeHTML(u.name)}</td>
      <td>${escapeHTML(u.email)}</td>
      <td class="text-capitalize">${escapeHTML(u.role)}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-btn" data-id="${u._id}">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${u._id}">Delete</button>
      </td>
    </tr>`).join('');
}

async function loadUsers() {
  try {
    users = await api('/users');
    showUsers(users);
  } catch (err) {
    document.getElementById('userTableBody').innerHTML =
      `<tr><td colspan="6" class="text-center text-danger">${escapeHTML(err.message)}</td></tr>`;
  }
}

const userModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal'));
const userDeleteModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal'));

// Search by name or email
document.getElementById('search').addEventListener('input', function () {
  const term = this.value.toLowerCase();
  showUsers(users.filter((u) =>
    u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)));
});

document.getElementById('userTableBody').addEventListener('click', (e) => {
  const edit = e.target.closest('.edit-btn');
  const del = e.target.closest('.delete-btn');

  if (edit) {
    const u = users.find((x) => x._id === edit.dataset.id);
    document.getElementById('editId').value = u._id;
    document.getElementById('editName').value = u.name;
    document.getElementById('editEmail').value = u.email;
    document.getElementById('editRole').value = u.role;
    userModal().show();
  }

  if (del) {
    deleteUserId = del.dataset.id;
    const u = users.find((x) => x._id === deleteUserId);
    document.getElementById('deleteName').textContent = u ? u.name : 'this user';
    userDeleteModal().show();
  }
});

document.getElementById('editForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const updatedData = {
    name: document.getElementById('editName').value.trim(),
    email: document.getElementById('editEmail').value.trim(),
    role: document.getElementById('editRole').value
  };

  try {
    await api('/users/' + id, { method: 'PUT', body: updatedData });
    alert('User updated!');
    userModal().hide();
    loadUsers();
  } catch (err) {
    showAlert(err.message);
  }
});

document.getElementById('confirmDelete').addEventListener('click', async () => {
  const me = Auth.getUser();
  if (me && me.id === deleteUserId) {
    userDeleteModal().hide();
    return showAlert('You cannot delete your own account here.');
  }
  try {
    await api('/users/' + deleteUserId, { method: 'DELETE' });
    userDeleteModal().hide();
    alert('User deleted');
    loadUsers();
  } catch (err) {
    showAlert(err.message);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  if (Auth.require('admin')) loadUsers();
});