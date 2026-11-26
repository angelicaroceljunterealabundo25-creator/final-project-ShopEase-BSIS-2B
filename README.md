# ShopEase

**Bicol University Polangui · Group 3 · BSIS 2B**

**First semester, academic year 2026–2027**

ShopEase is an online stationery and study essentials store. It gives students and educators one place to find school supplies, check delivery coverage, and follow their orders. Staff use the same system to manage fulfillment and inventory. Administrators oversee the product catalog, accounts, vouchers, and reports.

## System features

| Role | Available functions |
| --- | --- |
| Customer | Register, browse and filter products, save a cart in the browser, place an order, print a receipt, track status, and review items after delivery. |
| Staff | Review the fulfillment queue, update order status, and adjust inventory. |
| Administrator | Maintain products, fulfill orders, create staff and administrator accounts, manage users and vouchers, and export orders to Excel. |

Every role can update its profile and photo. On the sign-in page, choose **Customer** or **Staff & admin**. Customers can register through the website. Administrators create team accounts through **Dashboard → Users → Create team account**.

The catalog includes 18 school supplies sourced from SM Stationery. Delivery eligibility is based on the selected municipality in Polangui, Albay. Checkout applies valid vouchers automatically and records the selected payment method. Available options are cash on delivery, credit card, GCash, and Maya.

## Technology and repository structure

The frontend uses HTML5, CSS3, Bootstrap 5, and JavaScript. Node.js and Express serve the frontend and API from the same origin. MongoDB Atlas stores records through Mongoose. The project uses Git and GitHub for version control.

| Folder | Contents |
| --- | --- |
| [frontend](frontend/) | HTML pages, stylesheet, JavaScript modules, and catalog photographs |
| [backend](backend/) | Express server, domain route modules, Mongoose models, configuration, seed data, and integration tests |
| [database](database/) | Philippine address data and legacy migration schema |
| [docs](docs/) | Original course submissions, updated phase reports, and local verification notes |

## Local installation

1. Install Node.js 22 or newer. From the repository root, run `npm ci --prefix backend`.
2. Copy [the environment template](backend/.env.example) to `backend/.env.local`. Set `MONGO_URI` and `MONGO_DB_NAME` for a development database. Keep the file local.
3. Run `npm start`, then open [ShopEase on port 35174](http://127.0.0.1:35174/). Use `npm run dev` for automatic restarts and `npm test` for the integration suite.
4. For local sign-in, use `customer@shopease.test`, `staff@shopease.test`, or `admin@shopease.test` with the local demo password `ShopEaseDemo2026!`. Use the first account under **Customer** and the other two under **Staff & admin**.

The integration suite runs against a separate MongoDB replica set. See the [backend reference](backend/README.md) for routes, environment variables, and the local password reset outbox.

## Deployment

The Render deployment and live URL are pending. Configure a Node web service from the repository root with build command `npm ci --omit=dev --prefix backend` and start command `npm start`. Use health check path `/api/health`. Set `HOST=0.0.0.0`, `NODE_ENV=production`, `APP_ORIGIN`, `MONGO_URI`, `MONGO_DB_NAME`, and a private `JWT_SECRET` of at least 32 characters. Configure SMTP for password recovery and provision the production catalog, vouchers, and initial administrator before the live acceptance test. Use a separate hosted database with production credentials.

## Phase submissions

- [Original course materials and updated phase evidence](docs/README.md)
- [Test coverage and final release checks](docs/local-verification.md)
- [Catalog photo sources](frontend/img/ATTRIBUTION.md)

## Contributors

| Member | Role in the proposal |
| --- | --- |
| Jayceline Mae G. Roaring | Project Manager |
| Mikalyn R. Nomo | Frontend Manager |
| Jammel A. Paniurotan | Backend Manager |
| Aron John R. Velasco | Database Manager |
| Angelica Rocel J. Abundo | GitHub Manager |
