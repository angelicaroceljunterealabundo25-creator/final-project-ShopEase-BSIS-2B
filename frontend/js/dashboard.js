window.onload = async function () {
  const res = await fetch('http://localhost:5000/api/users');
  const users = await res.json();

  const container = document.getElementById('userList');
  users.forEach(user => {
    const div = document.createElement('div');
    div.className = 'card mb-2 p-3';
    div.innerHTML = `<h5>${user.name}</h5><p>${user.email}</p>`;
    container.appendChild(div);
  });
};