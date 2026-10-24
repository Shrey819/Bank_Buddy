# 🏦 Bank Buddy - Secure Node.js & PostgreSQL JWT Authentication System

> Active Development Branch: `shrey`

A secure, modular, token-based authentication backend system with PostgreSQL and Sequelize for **Bank Buddy**.

---

## 🚀 Features

- **User Registration & Login**:
  - Secure password hashing with `bcryptjs` (salt rounds = 8).
  - Unique username and email verification middleware (`verifyUser`).
  - RFC 7519 JSON Web Token (`jsonwebtoken`) issuance on login (24-hour expiration).
- **JWT Protection Middleware**:
  - `verifyToken` middleware guarding protected endpoints via `Authorization: Bearer <token>`.
- **Database ORM**:
  - Relational database management using **Sequelize v5** with **PostgreSQL**.
  - Automatic table creation and model synchronization on startup.
- **Interactive Web Console**:
  - Built-in UI served at `http://localhost:8080` to test user registration, JWT generation, and protected resources in real-time.
- **Automated Integration Tests**:
  - 8-point automated test suite verifying signup, signin, token guard, and CRUD actions.

---

## 📂 Project Structure

```text
Bank_Buddy/
├── backend_gateway_node/
│   ├── config/
│   │   ├── config-db.js        # PostgreSQL & Sequelize connection configuration
│   │   └── config-jwt.js       # JWT Secret key configuration
│   ├── middleware/
│   │   ├── index.js            # Middleware aggregator
│   │   ├── jwtAuth.js          # Token verification middleware (verifyToken)
│   │   └── verifyUser.js       # Duplicate username & email check middleware
│   ├── models/
│   │   ├── index.js            # Sequelize database initialization & model association
│   │   ├── user.js             # User model (id, username, email, password)
│   │   └── product.js          # Product/Services model (id, name, price, isDeleted)
│   ├── routes/
│   │   ├── user-routes.js      # /api/v1/signup and /api/v1/signin routes
│   │   └── product-routes.js   # JWT-protected routes (/api/auth/*)
│   └── services/
│       ├── user-services.js    # User authentication business logic
│       └── product-services.js # CRUD business logic
├── frontend/
│   └── index.html              # Interactive browser testing dashboard
├── .env                        # Environment variables (port, db credentials, jwt secret)
├── .env.example                # Example environment variables
├── .gitignore                  # Excluded files for git
├── package.json                # Dependencies and npm scripts
├── server.js                   # Express application entry point
└── test-server.js              # Integration test suite runner
```

---

## 🛠️ Quick Start

### 1. Prerequisites
Ensure PostgreSQL is running on your machine:
- Default DB: `learnnode`
- Default User: `postgresdb`
- Default Password: `Yuhu123`
- Host: `localhost:5432`

*(You can customize these in `.env`)*

### 2. Install Dependencies
```powershell
npm install
```

### 3. Start the Server
```powershell
npm start
```

Output:
```text
PostgreSQL database synced successfully.
====================================================
Server is running on port 8080
Open in browser: http://localhost:8080
====================================================
```

### 4. Run Automated Tests
```powershell
npm test
```

---

## 📡 API Endpoints

### 1. User Signup
* **Endpoint**: `POST /api/v1/signup`
* **Body**:
  ```json
  {
    "username": "shrey",
    "email": "shrey@example.com",
    "password": "Password123"
  }
  ```
* **Response**:
  ```json
  { "message": "User successfully registered" }
  ```

### 2. User Signin
* **Endpoint**: `POST /api/v1/signin`
* **Body**:
  ```json
  {
    "username": "shrey",
    "password": "Password123"
  }
  ```
* **Response**:
  ```json
  {
    "id": 1,
    "username": "shrey",
    "email": "shrey@example.com",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### 3. Protected Operations (Require `Authorization: Bearer <accessToken>`)

* **Add Product/Service**: `POST /api/auth/addproduct`
  ```json
  { "name": "Savings Account Tier 1", "price": 0.00 }
  ```
* **List Products/Services**: `GET /api/auth/getproducts`
* **Find By ID**: `POST /api/auth/getproductbyid` with `{ "id": 1 }`
* **Update Product/Service**: `POST /api/auth/update` with `{ "id": 1, "name": "Premium Savings", "price": 10.00 }`
* **Delete Product/Service**: `POST /api/auth/delete` with `{ "id": 1 }`
