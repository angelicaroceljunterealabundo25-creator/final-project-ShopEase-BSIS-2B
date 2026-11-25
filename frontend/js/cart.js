
// Shopping cart (kept in localStorage)
function renderCart() {
  const items = Cart.get();
  const body = document.getElementById('cartItems');
  const checkout = document.getElementById('checkoutBtn');

  if (items.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Your cart is empty. <a href="products.html">Browse products</a></td></tr>';
    document.getElementById('cartTotal').textContent = peso(0);
    checkout.classList.add('disabled');
    Cart.updateBadge();
    return;
  }

  checkout.classList.remove('disabled');
  body.innerHTML = items.map((i) => `
    <tr>
      <td>${i.icon || ''} ${escapeHTML(i.name)}</td>
      <td>${peso(i.price)}</td>
      <td style="width:110px;"><input type="number" class="form-control form-control-sm qty" data-id="${escapeHTML(i.id)}" value="${i.quantity}" min="1" max="${i.stock}"></td>
      <td>${peso(i.price * i.quantity)}</td>
      <td><button class="btn btn-sm btn-outline-danger remove" data-id="${escapeHTML(i.id)}">Remove</button></td>
    </tr>`).join('');
  document.getElementById('cartTotal').textContent = peso(Cart.total());

  body.querySelectorAll('.qty').forEach((input) => {
    input.addEventListener('change', () => {
      const max = Number(input.max);
      const qty = Math.max(1, Math.min(Number(input.value) || 1, max));
      Cart.setQuantity(input.dataset.id, qty);
      renderCart();
    });
  });
  body.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', () => { Cart.remove(btn.dataset.id); renderCart(); });
  });
}

window.addEventListener('DOMContentLoaded', renderCart);