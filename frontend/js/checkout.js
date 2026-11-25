// Checkout: POST /api/orders (needs login)
window.addEventListener('DOMContentLoaded', () => {
  if (!Auth.require()) return;

  const items = Cart.get();
  const summary = document.getElementById('orderSummary');

  if (items.length === 0) {
    summary.innerHTML = '<li class="list-group-item text-muted">Your cart is empty.</li>';
    document.getElementById('placeOrder').disabled = true;
  } else {
    summary.innerHTML = items.map((i) => `
      <li class="list-group-item d-flex justify-content-between">
        <span>${escapeHTML(i.name)} × ${i.quantity}</span><span>${peso(i.price * i.quantity)}</span>
      </li>`).join('');
  }
  document.getElementById('orderTotal').textContent = peso(Cart.total());
  const user = Auth.getUser();
  const nameField = document.getElementById('fullName');
  if (nameField && user) nameField.value = user.name;
});

document.getElementById('checkoutForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const items = Cart.get();
  if (items.length === 0) return showAlert('Your cart is empty.');

  const deliveryAddress = document.getElementById('address').value.trim();
  const paymentMethod = document.getElementById('paymentMethod').value;
  if (!deliveryAddress) return showAlert('Please enter your delivery address.');

  try {
    await api('/orders', {
      method: 'POST',
      body: {
        items: items.map((i) => ({ product: i.id, quantity: i.quantity })),
        deliveryAddress,
        paymentMethod
      }
    });
    Cart.clear();
    alert('Order placed successfully!');
    location.href = 'orders.html';
  } catch (err) {
    showAlert(err.message);
  }
});