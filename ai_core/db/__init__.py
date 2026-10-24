"""
ai_core/db/__init__.py

Public API for the Bank_Buddy database layer.
Import anything you need from here instead of reaching into sub-modules.

Example:
    from ai_core.db import get_db, Customer, Transaction
"""

from .connection import Base, SessionLocal, engine, get_db
from .models import (
    Account,
    AuditLog,
    Card,
    Customer,
    FraudCase,
    Loan,
    Transaction,
    UpcomingPayment,
)

__all__ = [
    # connection utilities
    "engine",
    "SessionLocal",
    "Base",
    "get_db",
    # ORM models
    "Customer",
    "Account",
    "Transaction",
    "Card",
    "Loan",
    "UpcomingPayment",
    "FraudCase",
    "AuditLog",
]
