"""
models.py – SQLAlchemy ORM models for all Bank_Buddy banking tables.

Each class maps 1-to-1 with a table defined in schema.sql.
Column types, names, and defaults match the SQL schema exactly.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    ARRAY,
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Text,
    func,
)

from .connection import Base


# ---------------------------------------------------------------------------
# 1. Customer
# ---------------------------------------------------------------------------
class Customer(Base):
    """Core KYC / profile record for a bank customer."""

    __tablename__ = "customers"

    customer_id: str = Column(String(20), primary_key=True)
    name:        str = Column(String(100), nullable=False)
    phone:       str = Column(String(15))
    email:       str = Column(String(100))
    kyc_status:  str = Column(String(20), default="verified")
    created_at: datetime = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 2. Account
# ---------------------------------------------------------------------------
class Account(Base):
    """Savings / current / FD account belonging to a customer."""

    __tablename__ = "accounts"

    account_id:   str     = Column(String(20), primary_key=True)
    customer_id:  str     = Column(String(20), nullable=False)      # FK → customers
    balance:      Decimal = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    currency:     str     = Column(String(3), default="INR")
    account_type: str     = Column(String(20), default="savings")
    created_at: datetime  = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 3. Transaction
# ---------------------------------------------------------------------------
class Transaction(Base):
    """Every debit / credit movement recorded against an account."""

    __tablename__ = "transactions"

    txn_id:      str     = Column(String(30), primary_key=True)
    account_id:  str     = Column(String(20), nullable=False)       # FK → accounts
    date:        date    = Column(Date, nullable=False)
    amount:      Decimal = Column(Numeric(15, 2), nullable=False)
    category:    str     = Column(String(50))
    merchant:    str     = Column(String(100))
    channel:     str     = Column(String(20), default="card")
    status:      str     = Column(String(20), default="success")
    description: str     = Column(Text)
    created_at: datetime = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 4. Card
# ---------------------------------------------------------------------------
class Card(Base):
    """Credit or debit card linked to a customer."""

    __tablename__ = "cards"

    card_id:           str     = Column(String(20), primary_key=True)
    customer_id:       str     = Column(String(20), nullable=False)  # FK → customers
    card_type:         str     = Column(String(20), default="credit")
    card_last4:        str     = Column(String(4))
    status:            str     = Column(String(20), default="active")
    due_date:          date    = Column(Date)
    amount_due:        Decimal = Column(Numeric(15, 2), default=Decimal("0.00"))
    statement_balance: Decimal = Column(Numeric(15, 2), default=Decimal("0.00"))
    credit_limit:      Decimal = Column(Numeric(15, 2), default=Decimal("100000.00"))
    created_at: datetime       = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 5. Loan
# ---------------------------------------------------------------------------
class Loan(Base):
    """Personal / home / auto loan record."""

    __tablename__ = "loans"

    loan_id:       str     = Column(String(20), primary_key=True)
    customer_id:   str     = Column(String(20), nullable=False)      # FK → customers
    loan_type:     str     = Column(String(30))
    principal:     Decimal = Column(Numeric(15, 2))
    outstanding:   Decimal = Column(Numeric(15, 2))
    emi_amount:    Decimal = Column(Numeric(15, 2))
    interest_rate: Decimal = Column(Numeric(5, 2))
    next_due_date: date    = Column(Date)
    tenure_months: int     = Column(Integer)
    created_at: datetime   = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 6. UpcomingPayment
# ---------------------------------------------------------------------------
class UpcomingPayment(Base):
    """Scheduled bills, EMIs, and card dues awaiting payment."""

    __tablename__ = "upcoming_payments"

    payment_id:   str     = Column(String(30), primary_key=True)
    customer_id:  str     = Column(String(20), nullable=False)       # FK → customers
    payment_type: str     = Column(String(30))
    description:  str     = Column(String(100))
    amount:       Decimal = Column(Numeric(15, 2))
    due_date:     date    = Column(Date)
    status:       str     = Column(String(20), default="pending")
    created_at: datetime  = Column(DateTime, default=func.now())


# ---------------------------------------------------------------------------
# 7. FraudCase
# ---------------------------------------------------------------------------
class FraudCase(Base):
    """Dispute or fraud investigation ticket tied to a transaction."""

    __tablename__ = "fraud_cases"

    case_id:       str      = Column(String(30), primary_key=True)
    txn_id:        str      = Column(String(30))                     # FK → transactions
    customer_id:   str      = Column(String(20))                     # FK → customers
    status:        str      = Column(String(30), default="open")
    flag_reason:   str      = Column(Text)
    opened_at: datetime     = Column(DateTime, default=func.now())
    resolved_at: datetime   = Column(DateTime, nullable=True)
    ticket_number: str      = Column(String(30))


# ---------------------------------------------------------------------------
# 8. AuditLog
# ---------------------------------------------------------------------------
class AuditLog(Base):
    """
    Immutable trace of every AI agent invocation.

    agents_invoked / tools_invoked are stored as PostgreSQL TEXT[] arrays,
    making it easy to query which agents handled a given customer session.
    """

    __tablename__ = "audit_log"

    id:             int      = Column(Integer, primary_key=True, autoincrement=True)
    trace_id:       str      = Column(String(50), nullable=False)
    customer_id:    str      = Column(String(20))
    agents_invoked: list     = Column(ARRAY(String))
    tools_invoked:  list     = Column(ARRAY(String))
    decision:       str      = Column(String(50))
    outcome:        str      = Column(String(20))
    answer_type:    str      = Column(String(30))
    timestamp: datetime      = Column(DateTime, default=func.now())
