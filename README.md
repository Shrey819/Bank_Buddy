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
- **Full Banking Frontend Suite**:
  - **Net Banking Login (`index.html`)**: Kotak Mahindra Bank spec login with CRN/Username/Card auth, password toggle, scrambled virtual keypad, A/A+/A++ font scaling, high-contrast dark mode, and 2FA OTP step-up modal.
  - **Desktop Wealth Dashboard (`desktop.html`)**: Minimalist daily banking workspace with Bank Buddy Trust Shield logo, interactive spending graphs, donut allocation chart, virtual cards, and floating AI Banking Co-Pilot.
  - **AI Swarm Chat Workspace (`chat.html`)**: Autonomous multi-agent orchestrator with real-time agent dispatcher ribbon, interactive card freeze toggle, safe spending calculations, and prompt suggestion pills.
- **Automated Integration Tests**:
  - 8-point automated test suite verifying signup, signin, 2FA OTP step-up, token guard, and CRUD actions.

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
│   │   ├── user.js             # User model (id, name, username, email, password, crn, card, role)
│   │   └── product.js          # Product/Services model (id, name, price, isDeleted)
│   ├── routes/
│   │   ├── user-routes.js      # /api/v1/signup, /api/v1/signin, and /api/v1/verify-otp routes
│   │   └── product-routes.js   # JWT-protected routes (/api/auth/*)
│   ├── services/
│   │   ├── user-services.js    # User authentication, OTP verification & seed logic
│   │   └── product-services.js # CRUD business logic
│   ├── package.json            # Backend dependencies and test scripts
│   ├── server.js               # Express application entry point & static file routing
│   └── test-server.js          # 8-point automated integration test suite runner
├── frontend/
│   ├── index.html              # Net Banking Login Page & 2FA OTP Modal (Kotak spec)
│   ├── desktop.html            # Minimalist Daily Banking Home & Executive Wealth Dashboard
│   └── chat.html               # Autonomous AI Swarm Orchestrator Workspace
├── images/                     # API documentation screenshots
├── .env                        # Root environment variables
├── .env.example                # Example environment template
├── .gitignore                  # Git exclusion rules
└── package.json                # Root automation scripts (npm start, npm test)
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

### 2. User Signin (2-Step MFA Authentication)
* **Step 1: Credentials Verification**: `POST /api/v1/signin`
  * Supports login using CRN (`98234105`), Username (`elena`), Card Number (`4441`), or Email.
  * **Body**:
    ```json
    {
      "identifier": "98234105",
      "password": "BankBuddy@2026"
    }
    ```
  * **Response**:
    ```json
    {
      "step": "OTP_REQUIRED",
      "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "maskedPhone": "+91 ••••••3210"
    }
    ```
* **Step 2: 2FA OTP Step-Up**: `POST /api/v1/verify-otp`
  * **Body**:
    ```json
    {
      "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "otp": "123456"
    }
    ```
  * **Response**:
    ```json
    {
      "id": 1,
      "name": "Elena Rostova",
      "username": "elena",
      "email": "elena@bankbuddy.internal",
      "crn": "98234105",
      "cardNumber": "4441",
      "role": "Private Wealth Client",
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
