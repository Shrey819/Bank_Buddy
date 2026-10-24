-- =============================================================
-- Bank_Buddy: PostgreSQL Schema Extension
-- Target DB : learnnode
-- Phase     : 1 – Database Layer
-- Run with  : psql -U postgresdb -d learnnode -f schema.sql
-- =============================================================

-- ----------------------------------------------------------------
-- 0. Extend the existing users table with a customer linkage column
-- ----------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(20) UNIQUE;

-- ----------------------------------------------------------------
-- 1. customers – core KYC / profile table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    customer_id  VARCHAR(20)  PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(15),
    email        VARCHAR(100),
    kyc_status   VARCHAR(20)  DEFAULT 'verified',
    created_at   TIMESTAMP    DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. accounts – savings / current / FD accounts per customer
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
    account_id   VARCHAR(20)   PRIMARY KEY,
    customer_id  VARCHAR(20)   REFERENCES customers(customer_id),
    balance      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    currency     VARCHAR(3)    DEFAULT 'INR',
    account_type VARCHAR(20)   DEFAULT 'savings',
    created_at   TIMESTAMP     DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 3. transactions – every debit / credit movement on an account
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    txn_id      VARCHAR(30)   PRIMARY KEY,
    account_id  VARCHAR(20)   REFERENCES accounts(account_id),
    date        DATE          NOT NULL,
    amount      DECIMAL(15,2) NOT NULL,
    category    VARCHAR(50),
    merchant    VARCHAR(100),
    channel     VARCHAR(20)   DEFAULT 'card',
    status      VARCHAR(20)   DEFAULT 'success',
    description TEXT,
    created_at  TIMESTAMP     DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 4. cards – credit / debit cards linked to a customer
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
    card_id           VARCHAR(20)   PRIMARY KEY,
    customer_id       VARCHAR(20)   REFERENCES customers(customer_id),
    card_type         VARCHAR(20)   DEFAULT 'credit',
    card_last4        VARCHAR(4),
    status            VARCHAR(20)   DEFAULT 'active',
    due_date          DATE,
    amount_due        DECIMAL(15,2) DEFAULT 0.00,
    statement_balance DECIMAL(15,2) DEFAULT 0.00,
    credit_limit      DECIMAL(15,2) DEFAULT 100000.00,
    created_at        TIMESTAMP     DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 5. loans – personal / home / auto loan records
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    loan_id        VARCHAR(20)   PRIMARY KEY,
    customer_id    VARCHAR(20)   REFERENCES customers(customer_id),
    loan_type      VARCHAR(30),
    principal      DECIMAL(15,2),
    outstanding    DECIMAL(15,2),
    emi_amount     DECIMAL(15,2),
    interest_rate  DECIMAL(5,2),
    next_due_date  DATE,
    tenure_months  INTEGER,
    created_at     TIMESTAMP     DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 6. upcoming_payments – scheduled bills, EMIs, card dues
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upcoming_payments (
    payment_id   VARCHAR(30)   PRIMARY KEY,
    customer_id  VARCHAR(20)   REFERENCES customers(customer_id),
    payment_type VARCHAR(30),
    description  VARCHAR(100),
    amount       DECIMAL(15,2),
    due_date     DATE,
    status       VARCHAR(20)   DEFAULT 'pending',
    created_at   TIMESTAMP     DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 7. fraud_cases – dispute / fraud investigation tickets
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fraud_cases (
    case_id       VARCHAR(30) PRIMARY KEY,
    txn_id        VARCHAR(30) REFERENCES transactions(txn_id),
    customer_id   VARCHAR(20) REFERENCES customers(customer_id),
    status        VARCHAR(30) DEFAULT 'open',
    flag_reason   TEXT,
    opened_at     TIMESTAMP   DEFAULT NOW(),
    resolved_at   TIMESTAMP,
    ticket_number VARCHAR(30)
);

-- ----------------------------------------------------------------
-- 8. audit_log – immutable trace of every AI agent invocation
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id              SERIAL      PRIMARY KEY,
    trace_id        VARCHAR(50) NOT NULL,
    customer_id     VARCHAR(20),
    agents_invoked  TEXT[],                      -- e.g. ARRAY['BalanceAgent','FraudAgent']
    tools_invoked   TEXT[],                      -- e.g. ARRAY['get_balance','check_fraud']
    decision        VARCHAR(50),
    outcome         VARCHAR(20),
    answer_type     VARCHAR(30),
    timestamp       TIMESTAMP   DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Indexes for common query patterns
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_transactions_account   ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category  ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_accounts_customer      ON accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_cards_customer         ON cards(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_customer         ON loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer      ON upcoming_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_customer         ON fraud_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_trace            ON audit_log(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_customer         ON audit_log(customer_id);

-- end of schema.sql
