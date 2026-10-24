# 🏦 Bank Buddy - Autonomous Multi-Agent Net Banking & Wealth Orchestrator

[![Architecture: 3-Tier Multi-Agent](https://img.shields.io/badge/Architecture-3--Tier%20Distributed-00C48C?style=for-the-badge)](#-system-architecture)
[![Frontend: React 18 + Vite](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Lucide-61DAFB?style=for-the-badge&logo=react)](file:///d:/HCL/Bank_Buddy/frontend)
[![Gateway: Node.js + Express](https://img.shields.io/badge/Gateway-Node.js%20%7C%20Express%20%7C%20Sequelize-339933?style=for-the-badge&logo=node.js)](file:///d:/HCL/Bank_Buddy/backend_gateway_node)
[![AI Engine: LangGraph + FastAPI](https://img.shields.io/badge/AI%20Core-FastAPI%20%7C%20LangGraph%20%7C%20OpenAI%20Spec-009688?style=for-the-badge&logo=fastapi)](file:///d:/HCL/Bank_Buddy/ai_core)
[![Database: PostgreSQL / Neon / SQLite](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Neon%20%7C%20SQLite3-4169E1?style=for-the-badge&logo=postgresql)](file:///d:/HCL/Bank_Buddy/ai_core/db)

> **Bank Buddy** is a next-generation enterprise autonomous banking platform. It pairs a **Kotak-inspired Net Banking and Wealth Management React dashboard** with a **Node.js security gateway** and a **LangGraph-driven multi-agent AI engine** capable of deterministic financial arithmetic, autonomous multi-specialist routing, grounding verification against hallucination, step-up two-factor authentication, and human-in-the-loop safeguards for irreversible financial actions.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Agent Swarm & LangGraph Orchestration](#-agent-swarm--langgraph-orchestration)
- [Human-in-the-Loop & Confirmation Flow](#-human-in-the-loop--confirmation-flow)
- [Database & Data Flow](#-database--data-flow)
- [Key Features](#-key-features)
- [Directory Layout](#-directory-layout)
- [API Reference](#-api-reference)
- [Setup & Getting Started](#-setup--getting-started)
- [Running Automated Tests](#-running-automated-tests)
- [Security & Compliance](#-security--compliance)

---

## 🏛️ System Architecture

Bank Buddy operates across three tightly integrated tiers:

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Browser / React SPA)"]
        UI["React 18 + Vite SPA<br/>(Tailwind/Vanilla CSS, Lucide-React)"]
        LP["LoginPage<br/>CRN / Card / NetBanking + 2FA OTP"]
        DP["DashboardPage<br/>Ledger, Cards, Spending Donut, Vault"]
        CP["ChatPage<br/>Swarm Ribbon, Action Prompts, Token Dialog"]
        UI --> LP
        UI --> DP
        UI --> CP
    end

    subgraph GatewayLayer ["Security & Routing Layer (:8080)"]
        GW["Node.js / Express Gateway"]
        M_AUTH["JWT Auth Middleware<br/>(verifyToken, verifyUser)"]
        R_USER["User Routes (/api/v1/signup, signin, verify-otp)"]
        R_BANK["Banking Routes (/api/v1/dashboard-data, ledger)"]
        R_CHAT["Chat Proxy (/api/v1/chat, /api/v1/chat/confirm)"]
        
        GW --> M_AUTH
        M_AUTH --> R_USER
        M_AUTH --> R_BANK
        M_AUTH --> R_CHAT
    end

    subgraph AICoreLayer ["Multi-Agent AI Core (:8000)"]
        FASTAPI["FastAPI AI Engine<br/>(JWT Token Extraction, customer_id verification)"]
        SUPERVISOR["Supervisor Agent<br/>(Routing + Deterministic Composition)"]
        GRAPH["LangGraph Orchestration Pipeline"]
        
        FASTAPI --> SUPERVISOR
        SUPERVISOR --> GRAPH
    end

    subgraph StorageLayer ["Persistence Layer"]
        PG["PostgreSQL / Neon Database<br/>(users, products, accounts, transactions,<br/>cards, loans, upcoming_payments, audit_log)"]
        SQLITE["Local SQLite (banking.db fallback)"]
    end

    CP -- "HTTP / JWT Bearer" --> R_CHAT
    DP -- "HTTP / JWT Bearer" --> R_BANK
    LP -- "HTTP / Public & OTP" --> R_USER

    R_CHAT -- "Internal HTTP Proxy (Forward JWT)" --> FASTAPI
    R_BANK -- "Sequelize ORM" --> PG
    R_USER -- "Sequelize ORM" --> PG
    GRAPH -- "SQLAlchemy Engine" --> PG
    GRAPH -. "Local Fallback" .-> SQLITE
```

---

## 🤖 Agent Swarm & LangGraph Orchestration

Requests dispatched to `/api/v1/chat` enter the **FastAPI AI Core** and run through **LangGraph** where the **Supervisor Agent** coordinates 5 domain specialists with strict arithmetic grounding:

```mermaid
flowchart TD
    Q(["Customer Query: 'How much money do I have after paying all upcoming bills?'"])
    
    SUB_SUP["Supervisor Agent (route_query)"]
    Q --> SUB_SUP

    subgraph SwarmAgents ["Specialist Agent Swarm"]
        direction TB
        A_ACC["account_agent<br/>tools: get_balance, analyze_expenses"]
        A_LOAN["loan_agent<br/>tools: get_loan_details, get_upcoming_payments"]
        A_CARD["card_agent<br/>tools: get_credit_card_details, block_card (High-Risk)"]
        A_PAY["payment_agent<br/>tools: get_upi_status"]
        A_FRAUD["fraud_agent<br/>tools: fraud_verification, raise_dispute (High-Risk)"]
    end

    SUB_SUP -->|"Identifies Balance Need"| A_ACC
    SUB_SUP -->|"Identifies Bills / EMIs"| A_LOAN
    SUB_SUP -->|"Identifies Card Dues"| A_CARD

    subgraph ToolExecution ["Tool Execution & Grounding Check"]
        T_BAL["get_balance()<br/>➜ balance: ₹45,250.00"]
        T_LOAN["get_upcoming_payments()<br/>➜ dues: ₹12,500.00"]
        T_CARD["get_credit_card_details()<br/>➜ amount_due: ₹4,200.00"]
        
        A_ACC --> T_BAL
        A_LOAN --> T_LOAN
        A_CARD --> T_CARD

        GC{"Grounding Verification<br/>(check_grounding)"}
        T_BAL --> GC
        T_LOAN --> GC
        T_CARD --> GC
    end

    subgraph Composition ["Deterministic Synthesis"]
        ARITH["Supervisor Compose Answer<br/>Deterministic Python Arithmetic:<br/>safe_surplus = balance - (dues + card_due)<br/>(Hallucination Proof)"]
        GC -->|"All figures trace to DB"| ARITH
    end

    AUDIT["Append-Only Audit Log<br/>(trace_id, agents_invoked, tools_invoked, outcome)"]
    ARITH --> AUDIT
    AUDIT --> RESP(["Structured JSON Response + UI Trace"])
```

### Specialized Agents & Tooling Matrix

| Agent | Responsibility | Bound Tools | Risk Profile |
| :--- | :--- | :--- | :--- |
| **`account_agent`** | Balance checks, monthly spending categorization, net ledger queries | `get_balance`, `analyze_expenses` | Read-Only (Low) |
| **`payment_agent`** | UPI status, settlement logs, recent remittance inquiry | `get_upi_status` | Read-Only (Low) |
| **`loan_agent`** | Personal/home loan principal, EMI schedules, upcoming bill calendar | `get_loan_details`, `get_upcoming_payments` | Read-Only (Low) |
| **`card_agent`** | Credit limits, billing statements, card blocking | `get_credit_card_details`, `block_card` | **High-Risk** (`block_card` mutates DB) |
| **`fraud_agent`** | Flagged anomalies, transaction disputes, safety advisories | `fraud_verification`, `raise_dispute` | **High-Risk** (`raise_dispute` opens ticket) |

---

## 🛡️ Human-in-the-Loop & Confirmation Flow

Any irreversible action (such as locking a credit card or raising a formal fraud investigation) requires human consent. Bank Buddy enforces a cryptographic token confirmation loop before modifying state:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as User (React UI)
    participant Gateway as Node.js Gateway (:8080)
    participant AI as FastAPI AI Core (:8000)
    participant Graph as LangGraph & Card Agent
    participant DB as PostgreSQL Database

    Customer->>Gateway: POST /api/v1/chat {"message": "Block my credit card ending in 4242"}
    Gateway->>AI: Forward /chat (with Bearer JWT)
    AI->>Graph: run_banking_graph()
    Graph->>Graph: card_agent checks tool is_high_risk: True
    Graph->>AI: Generate UUID confirmation_token<br/>Cache action payload in pending_confirmations
    AI-->>Gateway: HTTP 200 {requires_confirmation: true, confirmation_token: "CONF-98a12..."}
    Gateway-->>Customer: Render Modal: "Confirm blocking card ending 4242?"

    alt Customer clicks 'Confirm'
        Customer->>Gateway: POST /api/v1/chat/confirm {confirmation_token: "CONF-98a12...", decision: "yes"}
        Gateway->>AI: Forward /chat/confirm
        AI->>Graph: resume_banking_graph(decision="yes")
        Graph->>DB: Execute block_card() -> UPDATE cards SET status='blocked'
        Graph->>DB: write_audit(outcome='success')
        AI-->>Gateway: {answer: "Card ending 4242 blocked successfully", answer_type: "action"}
        Gateway-->>Customer: Display Success confirmation pill & update UI state
    else Customer clicks 'Cancel'
        Customer->>Gateway: POST /api/v1/chat/confirm {confirmation_token: "CONF-98a12...", decision: "no"}
        Gateway->>AI: Forward /chat/confirm
        AI->>Graph: resume_banking_graph(decision="no")
        Graph->>DB: write_audit(outcome='cancelled')
        AI-->>Gateway: {answer: "Action cancelled. Card remains active.", answer_type: "action"}
        Gateway-->>Customer: Display Cancellation Notice
    end
```

---

## 🗄️ Database & Data Flow

Bank Buddy supports a dual persistence setup: enterprise PostgreSQL (local or cloud Neon DB) orchestrated via Sequelize on Node and SQLAlchemy on Python, backed by a portable SQLite fallback for local development:

```mermaid
erDiagram
    USERS ||--o{ ACCOUNTS : "owns"
    CUSTOMERS ||--o{ ACCOUNTS : "holds"
    CUSTOMERS ||--o{ CARDS : "issued"
    CUSTOMERS ||--o{ LOANS : "borrower"
    CUSTOMERS ||--o{ UPCOMING_PAYMENTS : "scheduled"
    CUSTOMERS ||--o{ FRAUD_CASES : "reports"
    ACCOUNTS ||--o{ TRANSACTIONS : "ledger"
    CUSTOMERS ||--o{ AUDIT_LOG : "triggers"

    USERS {
        int id PK
        string name
        string username UK
        string email UK
        string password
        string crn UK
        string card
        string role
        string customer_id FK
    }

    CUSTOMERS {
        string customer_id PK
        string name
        string phone
        string email
        string kyc_status
        timestamp created_at
    }

    ACCOUNTS {
        string account_id PK
        string customer_id FK
        decimal balance
        string currency
        string account_type
    }

    TRANSACTIONS {
        string txn_id PK
        string account_id FK
        date date
        decimal amount
        string category
        string merchant
        string channel
        string status
    }

    CARDS {
        string card_id PK
        string customer_id FK
        string card_type
        string card_last4
        string status
        date due_date
        decimal amount_due
        decimal statement_balance
        decimal credit_limit
    }

    LOANS {
        string loan_id PK
        string customer_id FK
        string loan_type
        decimal principal
        decimal outstanding
        decimal emi_amount
        decimal interest_rate
        date next_due_date
        int tenure_months
    }

    UPCOMING_PAYMENTS {
        string payment_id PK
        string customer_id FK
        string payment_type
        string description
        decimal amount
        date due_date
        string status
    }

    FRAUD_CASES {
        string case_id PK
        string customer_id FK
        string txn_id
        decimal amount
        string reason
        string status
        timestamp created_at
    }

    AUDIT_LOG {
        int id PK
        string trace_id
        string customer_id
        json agents_invoked
        json tools_invoked
        string decision
        string outcome
        string answer_type
        timestamp timestamp
    }
```

---

## ✨ Key Features

- **Kotak Net Banking UX Standards**:
  - Virtual scrambled keypad for PIN security.
  - Multi-identifier authentication: **CRN, Username, Card Number, or Email**.
  - Dynamic accessibility controls: Instant A/A+/A++ font scaling and high-contrast dark theme toggle.
  - Step-up Two-Factor Authentication (OTP simulation via modal).
- **Executive Wealth & Everyday Banking Hub**:
  - Real-time ledger computation (balance recalculation with instant debits/credits).
  - Safe Surplus auto-calculation: `Current Balance - (Upcoming EMIs + Credit Card Dues)`.
  - One-click **Sweep to Sovereign Vault** to lock excess liquidity into high-yield deposits.
  - Interactive spending distribution donut and transaction feed.
- **Autonomous Multi-Agent AI Assistant**:
  - **Supervisor-driven dispatch**: Natural language queries intelligently routed to `account`, `loan`, `card`, `payment`, or `fraud` specialists.
  - **Deterministic math over LLM hallucination**: Financial calculations (e.g. net worth, disposable liquidity) are calculated deterministically in Python rather than generated by the model.
  - **Grounding verification (`check_grounding`)**: Answers are checked against raw database outputs before delivery to eliminate hallucinated amounts.
  - **Append-only trace logging**: Audited trail containing trace IDs (`BANK-XXXXXXXX`), active agents, and tool outcomes.

---

## 📁 Directory Layout

```text
Bank_Buddy/
├── ai_core/                            # Python LangGraph Multi-Agent Service
│   ├── agents/                         # Agent definitions & system prompts
│   │   ├── account_agent.py            # Account balance & expense analysis agent
│   │   ├── base_agent.py               # LLM factory & grounding verification check
│   │   ├── card_agent.py               # Credit card manager & block card handler
│   │   ├── fraud_agent.py              # Suspicious activity & dispute ticket agent
│   │   ├── loan_agent.py               # Loan details & upcoming payments agent
│   │   ├── payment_agent.py            # UPI settlement agent
│   │   └── supervisor.py               # Routing classifier & arithmetic composer
│   ├── audit/                          # Append-only audit logger
│   │   └── logger.py                   # Writes trace logs to PostgreSQL audit_log
│   ├── auth/                           # Security layer for AI Core
│   │   └── jwt_verify.py               # Validates JWT tokens forwarded by Node.js
│   ├── db/                             # AI Core persistence layer
│   │   ├── connection.py               # SQLAlchemy engine (PostgreSQL + SQLite)
│   │   ├── models.py                   # Declarative models
│   │   ├── schema.sql                  # PostgreSQL table initialization script
│   │   └── seed.py                     # Demo data population
│   ├── graph/                          # LangGraph state machine & graph runner
│   │   └── banking_graph.py            # Multi-agent graph pipeline
│   ├── tools/                          # Read/write tools bound to database queries
│   │   ├── account_tools.py
│   │   ├── card_tools.py
│   │   ├── fraud_tools.py
│   │   ├── loan_tools.py
│   │   └── payment_tools.py
│   ├── main.py                         # FastAPI server (:8000)
│   └── requirements.txt                # Python dependencies
│
├── backend_gateway_node/               # Express Security Gateway & API
│   ├── config/                         # Configuration
│   │   ├── config-db.js                # PostgreSQL & Sequelize config
│   │   └── config-jwt.js               # JWT Secret & expiration parameters
│   ├── db/seed.js                      # Gateway database seeding script
│   ├── middleware/                     # Express middlewares
│   │   ├── jwtAuth.js                  # verifyToken middleware
│   │   └── verifyUser.js               # Signup validation & duplicate checking
│   ├── models/                         # Sequelize models
│   │   ├── user.js                     # User entity
│   │   └── product.js                  # Services & products
│   ├── routes/                         # Express API route endpoints
│   │   ├── banking-routes.js           # Dashboard, ledger adjustment, card freeze
│   │   ├── chat-routes.js              # Proxy to Python AI Core (:8000)
│   │   ├── product-routes.js           # Protected catalog routes
│   │   └── user-routes.js              # Authentication (signup, signin, OTP, me)
│   ├── services/                       # Business logic services
│   ├── server.js                       # Express app entrypoint (:8080)
│   └── test-server.js                  # 8-point automated integration test runner
│
├── frontend/                           # React 18 Single Page Application
│   ├── src/
│   │   ├── components/                 # UI components (Sidebar, TopNav, Modals)
│   │   ├── context/                    # AuthContext (state, JWT storage, logout)
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx           # Net Banking & Virtual Keypad login
│   │   │   ├── DashboardPage.jsx       # Daily Banking & Wealth Dashboard
│   │   │   └── ChatPage.jsx            # Multi-Agent Swarm Chat workspace
│   │   ├── App.jsx                     # Client-side router configuration
│   │   └── main.jsx                    # Application root
│   ├── legacy/                         # Standalone HTML versions
│   └── package.json                    # Frontend dependencies (Vite, React, Lucide)
│
├── package.json                        # Root automation scripts
├── .env.example                        # Environment configuration template
└── README.md                           # Project documentation
```

---

## 🔌 API Reference

### 1. Authentication & Session (`backend_gateway_node`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/signup` | Registers a new user with CRN generation | No |
| `POST` | `/api/v1/signin` | Validates credentials and generates 2FA challenge | No |
| `POST` | `/api/v1/verify-otp` | Validates OTP and issues 24-hr Bearer JWT | No |
| `GET` | `/api/v1/me` | Fetches active authenticated user profile | Bearer JWT |
| `POST` | `/api/v1/logout` | Revokes the current session token | Bearer JWT |

### 2. Core Banking Operations (`backend_gateway_node`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/dashboard-data` | Aggregates balances, cards, loans, bills, and txns | Optional / Demo |
| `POST` | `/api/v1/accounts/adjust-balance`| Debits or credits account balance with ledger audit | Bearer JWT |
| `POST` | `/api/v1/sweep-surplus` | Sweeps safe surplus funds to Sovereign Vault | Bearer JWT |
| `POST` | `/api/v1/cards/toggle-freeze` | Instant debit card lock/unlock | Bearer JWT |

### 3. AI Core & LangGraph (`ai_core` via Gateway Proxy)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Heartbeat & service health check | No |
| `GET` | `/tools` | Returns registered tool schema & risk profiles | No |
| `POST` | `/api/v1/chat` | Main conversational query endpoint | Bearer JWT |
| `POST` | `/api/v1/chat/confirm` | Confirms or cancels pending high-risk action token | Bearer JWT |

---

## 🚀 Setup & Getting Started

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: 3.10, 3.11, or 3.12
- **PostgreSQL**: (or local Neon connection string / SQLite fallback)

### 2. Environment Configuration
Create a `.env` in the root and in `ai_core`:

```bash
# Root .env / backend_gateway_node/.env
PORT=8080
DATABASE_URL=postgres://postgresdb:Yuhu123@localhost:5432/learnnode
JWT_SECRET=super-secure-bank-buddy-secret-key-32chars
AI_CORE_URL=http://127.0.0.1:8000
```

```bash
# ai_core/.env
DATABASE_URL=sqlite:///./banking.db
JWT_SECRET=super-secure-bank-buddy-secret-key-32chars
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openrouter/free
```

### 3. Install Dependencies

```powershell
# Install root & backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
npm run build
cd ..

# Install Python AI Core requirements
cd ai_core
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python run_seed.py
cd ..
```

### 4. Running the Complete System

Run both the Node.js API Gateway (serving the React UI on `:8080`) and the Python AI Core (`:8000`) simultaneously:

```powershell
npm run dev:all
```

Or run each service individually:

```powershell
# Terminal 1: Node.js Gateway & Web Server (:8080)
npm start

# Terminal 2: FastAPI AI Engine (:8000)
npm run start:ai
```

Once running, navigate to **http://localhost:8080** in your browser.

---

## 🧪 Running Automated Tests

Run the backend integration test suite to verify user registration, login, 2FA step-up authentication, token guards, and CRUD endpoints:

```powershell
npm test
```

Expected output:
```text
===================================================
Bank Buddy Integration Test Suite
===================================================
[PASS] Test 1: User Signup (/api/v1/signup)
[PASS] Test 2: User Signin (/api/v1/signin)
[PASS] Test 3: OTP Step-Up Authentication (/api/v1/verify-otp)
[PASS] Test 4: Token-Guarded Route Access (/api/v1/me)
[PASS] Test 5: Ledger Balance Adjustment (/api/v1/accounts/adjust-balance)
[PASS] Test 6: AI Core Heartbeat & Tool Inspection (/tools)
[PASS] Test 7: Multi-Agent Reasoning Query Dispatch
[PASS] Test 8: High-Risk Action Confirmation Safeguard
===================================================
8/8 Tests Passed (100% Success)
```

---

## 🔒 Security & Compliance

- **OWASP Compliant Input Validation**: Strictly sanitizes input for CRN, usernames, emails, and passwords before database ingestion.
- **Stateless RFC 7519 JWT Authentication**: Cryptographically signed access tokens with custom claims (`user_id`, `customer_id`, `role`) validated on both Node.js and FastAPI layers.
- **Anti-Hallucination Grounding Checks**: Every numeric datum uttered by an AI agent must be verified against actual tool outputs before response release.
- **Append-Only Audit Logging**: Every autonomous action generates an unmodifiable database record with a `BANK-XXXXXXXX` trace ID for compliance reporting.
- **Zero Inadvertent Mutation**: Destructive or irreversible state updates require an explicit confirmation token exchange (`POST /chat/confirm`).
