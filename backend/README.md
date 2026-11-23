# ShopEase Backend

## Description
The backend provides the RESTful API for the ShopEase e-commerce system using Node.js, Express.js, and MongoDB.

## Technologies
- Node.js
- Express.js
- MongoDB
- Mongoose
- CORS
- dotenv
- bcryptjs
- jsonwebtoken

## Folder Structure
- config/ - Database connection
- controllers/ - API logic
- models/ - Mongoose schemas
- routes/ - API route definitions
- public/ - Frontend static files
- server.js - Main Express server

## API Routes

### Authentication
- POST /api/auth/register - Register a user
- POST /api/auth/login - Log in a user

### Users
- GET /api/users - Retrieve all users
- POST /api/users - Register a user
- GET /api/users/:id - Retrieve one user
- PUT /api/users/:id - Update a user
- DELETE /api/users/:id - Delete a user

### Products
- GET /api/products - Retrieve all products
- POST /api/products - Create a product
- GET /api/products/:id - Retrieve one product
- PUT /api/products/:id - Update a product
- DELETE /api/products/:id - Delete a product

### Orders
- GET /api/orders - Retrieve all orders
- POST /api/orders - Create an order
- GET /api/orders/:id - Retrieve one order
- PUT /api/orders/:id - Update an order
- DELETE /api/orders/:id - Delete an order

## Database Connection
The database connection is configured in `config/db.js` using Mongoose and the `MONGO_URI` environment variable.

## Environment Variables
Create a `.env` file inside the backend folder with:

- MONGO_URI=your_mongodb_connection_string
- PORT=5000
- JWT_SECRET=your_secret_key

Do not upload the `.env` file to GitHub.

## How to Run Locally

1. Open a terminal in the backend folder.
2. Install dependencies using `npm install`.
3. Configure the `.env` file.
4. Start the server using `npm start`.

The server runs on the port configured in the `.env` file.

## API Testing
API endpoints were tested using Thunder Client, including GET, POST, PUT, and DELETE operations for users, products, and orders.

## Mongoose Models

The backend uses three Mongoose models:

### User Model (`User.js`)
- name - User's name
- email - User's email address (unique and stored in lowercase)
- password - User's hashed password
- role - User's account role (defaults to customer)

### Product Model (`Product.js`)
- name - Product name
- description - Product description
- price - Product price
- category - Product category
- stock - Available product quantity

### Order Model (`Order.js`)
- user - Reference to the User who placed the order
- products - List of ordered products and their quantities
- totalAmount - Total order amount
- deliveryAddress - Order delivery address
- paymentMethod - Selected payment method
- status - Order status (defaults to Processing)

All three models use timestamps to record creation and update dates.
