# ShopEase Frontend

Plain HTML + CSS + JavaScript with Bootstrap 5 (CDN). No build step.

## Pages

| Page | Who | What it does | JS |
|---|---|---|---|
| `index.html` | Everyone | Home, free weather API (Open-Meteo) | `home.js` |
| `register.html` | Everyone | Register form → `POST /api/users` | `register.js` |
| `login.html` | Everyone | Login → `POST /api/auth/login`, token saved in localStorage | `login.js` |
| `products.html` | Everyone | Product list, search, category filter, IndexedDB offline copy | `products.js` |
| `product-details.html?id=` | Everyone | One product, add to cart | `product-details.js` |
| `cart.html` | Everyone | Cart using localStorage | `cart.js` |
| `checkout.html` | Customer | Place order → `POST /api/orders` | `checkout.js` |
| `orders.html` | Customer | View own orders and cancel | `orders.js` |
| `profile.html` | Logged in | Edit profile and password | `profile.js` |
| `dashboard.html` | Admin, Staff | Counts, recent orders, and users | `dashboard.js` |
| `admin-products.html` | Admin | Create, Read, Update, Delete products | `admin-products.js` |
| `admin-users.html` | Admin | Read, Update, Delete users and search | `admin-users.js` |
| `admin-reports.html` | Admin | Totals and recent orders | `admin-reports.js` |
| `staff-orders.html` | Staff, Admin | Change order status | `staff-orders.js` |
| `staff-inventory.html` | Staff, Admin | Update product stock | `staff-inventory.js` |

## Shared JavaScript

`js/api.js` is shared by the frontend pages. It contains:

- API URL
- `api()` fetch helper
- JWT authentication
- Auth functions
- Cart functions
- ProductCache using IndexedDB
- Navbar login/logout handling

## Main Features

- Responsive Bootstrap 5 interface
- User registration and login
- JWT authentication
- Product browsing and searching
- Category filtering
- Shopping cart using localStorage
- Checkout and order placement
- Customer order management
- Admin product management
- Admin user management
- Staff order management
- Staff inventory management
- Dashboard and reports
- Weather API integration
- IndexedDB offline product copy

## How the Phases Map Here

- **Phase 3** – All HTML and Bootstrap pages, including navigation bars, cards, forms, and modals.
- **Phase 4** – Forms and actions that send data to the API, including registration, login, checkout, and adding products.
- **Phase 5** – Pages that fetch and display data from the API, including products, dashboard, admin pages, and orders.
- **Phase 6** – Edit and delete functions using modals, mainly for admin products and admin users.

## Running Locally

1. Start the backend server.
2. Open `http://localhost:5000`.
3. The backend serves the frontend folder.

The frontend API requests use:

```text
http://localhost:5000/api
