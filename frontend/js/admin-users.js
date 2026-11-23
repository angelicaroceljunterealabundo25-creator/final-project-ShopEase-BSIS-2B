// PHASE 5: show users from GET /api/users, with search
let users = [];
const container = document.getElementById('userList');

function showUsers(list) {
  container.innerHTML = '';

  if (list.length === 0) {
    container.innerHTML = '<p class="text-center text-muted">No users found.</p>';
    return;
  }

  list.forEach(user => {
    const div = document.createElement('div');
    div.className = 'card mb-2 p-3';
    div.innerHTML = `<h5>${escapeHTML(user.name)}</h5><p class="mb-0">${escapeHTML(user.email)}</p>`;
    container.appendChild(div);
  });
}

window.onload = async function () {
  try {
    const res = await fetch(API_URL + '/users');
    users = await res.json();
    showUsers(users);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="text-danger text-center">Failed to load users.</p>';
  }
};

// Search (Task 4)
document.getElementById('search').addEventListener('input', function () {
  const term = this.value.toLowerCase();
  const filtered = users.filter(u => String(u.name).toLowerCase().includes(term));
  showUsers(filtered);
});
