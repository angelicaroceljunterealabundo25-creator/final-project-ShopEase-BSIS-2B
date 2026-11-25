ShopEase Frontend
Plain HTML + CSS + JavaScript with Bootstrap 5 (CDN). No build step.
Pages
Page
Who
What it does
JS
index.html
everyone
Home, free weather API (Open-Meteo)
home.js
register.html
everyone
Register form → POST /api/users
register.js
login.html
everyone
Login → POST /api/auth/login, token saved in localStorage
login.js
products.html
everyone
Product list, search, category filter, IndexedDB offline copy
products.js
product-details.html?id=
everyone
One product, add to cart
product-details.js
cart.html
everyone
Cart (localStorage)
cart.js
checkout.html
customer
Place order → POST /api/orders
checkout.js
orders.html
customer
Own orders, cancel
orders.js
profile.html
logged in
Edit profile and password
profile.js
dashboard.html
admin, staff
Counts, recent orders, users
dashboard.js
admin-products.html
admin
Create / Read / Update / Delete products (modals)
admin-products.js
admin-users.html
admin
Read / Update / Delete users, search
admin-users.js
admin-reports.html
admin
Totals and recent orders
admin-reports.js
staff-orders.html
staff, admin
Change order status
staff-orders.js
staff-inventory.html
staff, admin
Update product stock
staff-inventory.js

js/api.js is shared by every page: API URL, api() fetch helper (adds the JWT), Auth, Cart, ProductCache (IndexedDB), and the navbar login/logout handling.
How the phases map here
Phase 3 – all HTML/Bootstrap pages (navbar, cards, forms, modals).
Phase 4 – forms send data to the API (register.js, login.js, checkout.js, add product in admin-products.js).
Phase 5 – pages fetch and display data (products.js, dashboard.js, admin-*.js, orders.js).
Phase 6 – edit and delete with modals (admin-products.js, admin-users.js).
Run locally
Start the backend (see ../backend/README.md) and open http://localhost:5000 – the backend also serves this folder.
Or open any page with VS Code Live Server; api.js automatically calls http://localhost:5000/api.
Deploy
GitHub Pages deploys this folder through .github/workflows/pages.yml. Before deploying, put your Render URL in PRODUCTION_API at the top of js/api.js.
