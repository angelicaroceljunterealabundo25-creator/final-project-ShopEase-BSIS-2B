# ShopEase API

`server.js` configures Express and serves the HTML5, CSS3, Bootstrap, and JavaScript frontend from the same origin as the API. `accounts.js`, `catalog.js`, `orders.js`, and `reports.js` organize routes and handlers by domain. `db.js` connects to Atlas, and `models.js` defines the Mongoose schemas and indexes. MongoDB assigns document ObjectIds. The application also keeps stable public IDs for URLs and records imported from the previous local database.

From `backend`, use `.env.example` to create an ignored `.env.local` with `MONGO_URI` and `MONGO_DB_NAME`. Then run `npm ci` and `npm start` or `npm run dev`. Run `npm test` to exercise the Express API against a separate MongoDB replica set. The test runner downloads a MongoDB binary on first use. To import an older local installation, stop the previous server and run `npm run db:migrate-legacy` against the intended Atlas database. The import preserves public IDs and inserts records whose keys are absent. Pending password-reset links stay in the old installation.

## Routes

| Domain | Routes |
| --- | --- |
| Authentication | `POST /api/users` or `/api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, and `POST /api/password/forgot` or `/api/password/reset` |
| Profiles and users | `PUT /api/users/:id` for self, `PUT` and `DELETE /api/me/avatar`, admin `GET /api/users`, `POST /api/admin/users` for staff or admin creation, and admin `PATCH /api/users/:id/role`, `DELETE /api/users/:id`, `POST /api/users/:id/reactivate` |
| Catalog and stock | `GET /api/categories`, `GET /api/products`, `GET /api/products/:id`, admin `POST /api/products`, `PUT` and `DELETE /api/products/:id`, and staff/admin `GET /api/inventory`, `PATCH /api/products/:id/stock` |
| Reviews | `POST /api/products/:id/reviews` after delivery, displayed by `GET /api/products/:id` |
| Checkout and orders | `GET /api/checkout-options`, `POST /api/orders/quote`, `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `PATCH /api/orders/:id/cancel`, and staff/admin `PATCH /api/orders/:id/status` |
| Tracking | `GET /api/orders/stream`, `GET /api/notifications`, and `PATCH /api/notifications/read` for customers |
| Delivery | `GET /api/stores` and `GET /api/delivery-coverage?municipality=Polangui` |
| Reports and promos | Admin `GET /api/admin/dashboard-stats`, `GET /api/admin/export-orders`, `GET /api/admin/vouchers`, and `PUT /api/admin/vouchers/:code` |
| Health | `GET /api/health` pings MongoDB |

The application sets a same-origin HTTP-only session cookie. Test login with a client that stores cookies. Locally, reset links are written to `backend/.data/outbox`. Set `SMTP_URL` and `MAIL_FROM` to deliver reset email through a configured provider. Checkout checks the selected PSGC destination and records the typed street address. The mobile number is stored with the `+63` country code.

Set `GOOGLE_MAPS_DEMO_KEY` in `backend/.env.local` to enable the [Google Maps JavaScript API](https://developers.google.com/maps/demo-key) in the local locator. The locator uses [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Export_tab) when the key is absent or the map cannot load. `GOOGLE_MAPS_EMBED_KEY` accepts a regular Google Cloud key for the separate Maps Embed API. The Demo key is only loaded in development.

Before a later hosted rollout, provide the target database credentials, a persistent `JWT_SECRET`, `APP_ORIGIN`, production SMTP configuration, and a provisioned administrator. Disable demo seeding on the live instance. Archive or sanitize the inherited tracked `server/.env` before sharing the repository and rotate any real credentials previously tracked there.
