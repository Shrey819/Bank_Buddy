"""
seed.py – Idempotent demo-data seeder for Bank_Buddy (customer C1001).

Run directly:
    python -m ai_core.db.seed
  or:
    python ai_core/db/seed.py

Key demo numbers (must never change):
  • Account balance        : ₹1,25,000.00
  • Credit card amount_due : ₹15,000  (due in 5 days)
  • Loan EMI               : ₹12,000  (due in 10 days)
  • Upcoming payments sum  : ₹35,000  (card 15k + EMI 12k + utilities 8k)
  • Transactions           : 30 total across 5 categories
  • Suspicious txn         : merchant='UNKNOWN_ONLINE_9821', ₹4,500
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text

from .connection import SessionLocal
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

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TODAY = date.today()


def _txn_id() -> str:
    """Short UUID-based transaction ID."""
    return "TXN-" + uuid.uuid4().hex[:16].upper()


def _pay_id() -> str:
    return "PAY-" + uuid.uuid4().hex[:12].upper()


def _case_id() -> str:
    return "CASE-" + uuid.uuid4().hex[:12].upper()


def _days(n: int) -> date:
    return TODAY + timedelta(days=n)


def _ago(n: int) -> date:
    return TODAY - timedelta(days=n)


# ---------------------------------------------------------------------------
# Seed blocks
# ---------------------------------------------------------------------------

def _seed_customer(session) -> None:
    print("  [customers] Checking C1001 …")
    exists = session.get(Customer, "C1001")
    if exists:
        print("  [customers] Already exists – skipping.")
        return
    session.add(
        Customer(
            customer_id="C1001",
            name="Shreyansh Bhupaney",
            phone="+91-9876543210",
            email="shrey@bankbuddy.in",
            kyc_status="verified",
        )
    )
    session.flush()
    print("  [customers] ✓ Inserted C1001.")


def _seed_account(session) -> None:
    print("  [accounts] Checking ACC-C1001 …")
    if session.get(Account, "ACC-C1001"):
        print("  [accounts] Already exists – skipping.")
        return
    session.add(
        Account(
            account_id="ACC-C1001",
            customer_id="C1001",
            balance=Decimal("125000.00"),   # ₹1,25,000 – canonical demo value
            currency="INR",
            account_type="savings",
        )
    )
    session.flush()
    print("  [accounts] ✓ Inserted ACC-C1001 (balance ₹1,25,000).")


def _seed_card(session) -> None:
    print("  [cards] Checking CARD-01 …")
    if session.get(Card, "CARD-01"):
        print("  [cards] Already exists – skipping.")
        return
    session.add(
        Card(
            card_id="CARD-01",
            customer_id="C1001",
            card_type="credit",
            card_last4="4242",
            status="active",
            due_date=_days(5),             # due in 5 days
            amount_due=Decimal("15000.00"),
            statement_balance=Decimal("18500.00"),
            credit_limit=Decimal("100000.00"),
        )
    )
    session.flush()
    print("  [cards] ✓ Inserted CARD-01 (due ₹15,000 in 5 days).")


def _seed_loan(session) -> None:
    print("  [loans] Checking LOAN-01 …")
    if session.get(Loan, "LOAN-01"):
        print("  [loans] Already exists – skipping.")
        return
    session.add(
        Loan(
            loan_id="LOAN-01",
            customer_id="C1001",
            loan_type="personal",
            principal=Decimal("500000.00"),
            outstanding=Decimal("320000.00"),
            emi_amount=Decimal("12000.00"),  # ₹12,000 EMI – canonical demo value
            interest_rate=Decimal("10.50"),
            next_due_date=_days(10),         # due in 10 days
            tenure_months=48,
        )
    )
    session.flush()
    print("  [loans] ✓ Inserted LOAN-01 (EMI ₹12,000 in 10 days).")


def _seed_upcoming_payments(session) -> None:
    print("  [upcoming_payments] Checking …")
    existing = (
        session.query(UpcomingPayment)
        .filter(UpcomingPayment.customer_id == "C1001")
        .count()
    )
    if existing >= 3:
        print("  [upcoming_payments] Already seeded – skipping.")
        return

    # Total must equal ₹35,000 → 15,000 + 12,000 + 8,000
    payments = [
        UpcomingPayment(
            payment_id=_pay_id(),
            customer_id="C1001",
            payment_type="credit_card",
            description="HDFC Credit Card – Bill Payment",
            amount=Decimal("15000.00"),
            due_date=_days(5),
            status="pending",
        ),
        UpcomingPayment(
            payment_id=_pay_id(),
            customer_id="C1001",
            payment_type="loan_emi",
            description="Personal Loan EMI – LOAN-01",
            amount=Decimal("12000.00"),
            due_date=_days(10),
            status="pending",
        ),
        UpcomingPayment(
            payment_id=_pay_id(),
            customer_id="C1001",
            payment_type="utility",
            description="Electricity + Internet Bundle",
            amount=Decimal("8000.00"),
            due_date=_days(7),
            status="pending",
        ),
    ]
    session.add_all(payments)
    session.flush()
    print("  [upcoming_payments] ✓ Inserted 3 payments (total ₹35,000).")


def _seed_transactions(session) -> None:
    print("  [transactions] Checking …")
    existing = (
        session.query(Transaction)
        .filter(Transaction.account_id == "ACC-C1001")
        .count()
    )
    if existing >= 30:
        print("  [transactions] Already seeded (≥30 rows) – skipping.")
        return

    # fmt: off
    # 30 transactions → food(8) transport(6) shopping(7) utilities(5) entertainment(4) + suspicious(1) = 31
    # We include the suspicious one in the 30 so the total is exactly 30.
    # Distribution: food(8) transport(6) shopping(7) utilities(4) entertainment(4) unknown(1) = 30
    raw: list[tuple] = [
        # --- Food (8) ---
        ("Swiggy",           "food",          450.00,  _ago(1),  "UPI",  "Dinner order"),
        ("Zomato",           "food",          380.00,  _ago(3),  "card", "Lunch delivery"),
        ("Swiggy",           "food",          620.00,  _ago(5),  "UPI",  "Family dinner"),
        ("Zomato",           "food",          290.00,  _ago(8),  "card", "Breakfast order"),
        ("McDonald's",       "food",          340.00,  _ago(10), "card", "Quick meal"),
        ("Domino's Pizza",   "food",          560.00,  _ago(12), "card", "Pizza night"),
        ("Swiggy",           "food",          415.00,  _ago(15), "UPI",  "Office lunch"),
        ("Café Coffee Day",  "food",          185.00,  _ago(18), "card", "Coffee & snacks"),

        # --- Transport (6) ---
        ("Uber",             "transport",     320.00,  _ago(2),  "card", "Airport cab"),
        ("Ola",              "transport",     180.00,  _ago(4),  "UPI",  "Office commute"),
        ("Uber",             "transport",     450.00,  _ago(7),  "card", "Late night cab"),
        ("BMTC",             "transport",     50.00,   _ago(9),  "card", "Monthly bus pass"),
        ("Ola",              "transport",     210.00,  _ago(14), "UPI",  "Weekend ride"),
        ("Rapido",           "transport",     95.00,   _ago(20), "UPI",  "Bike taxi"),

        # --- Shopping (7) ---
        ("Amazon",           "shopping",     1850.00,  _ago(3),  "card", "Electronics accessories"),
        ("Flipkart",         "shopping",     2200.00,  _ago(6),  "card", "Shoes purchase"),
        ("Myntra",           "shopping",     1400.00,  _ago(9),  "card", "Clothing"),
        ("Amazon",           "shopping",      960.00,  _ago(11), "UPI",  "Books"),
        ("Croma",            "shopping",     3500.00,  _ago(13), "card", "Earphones"),
        ("Nykaa",            "shopping",      780.00,  _ago(16), "card", "Skincare products"),
        ("IKEA",             "shopping",     4200.00,  _ago(22), "card", "Home furnishings"),

        # --- Utilities (4) ---
        ("BESCOM",           "utilities",    1200.00,  _ago(5),  "NEFT", "Electricity bill"),
        ("Airtel",           "utilities",     699.00,  _ago(10), "UPI",  "Mobile recharge"),
        ("ACT Broadband",    "utilities",     999.00,  _ago(15), "NEFT", "Internet bill"),
        ("Gas Authority",    "utilities",     850.00,  _ago(20), "NEFT", "LPG cylinder"),

        # --- Entertainment (4) ---
        ("Netflix",          "entertainment", 649.00,  _ago(2),  "card", "Monthly subscription"),
        ("BookMyShow",       "entertainment", 780.00,  _ago(8),  "card", "Movie tickets x2"),
        ("Spotify",          "entertainment", 119.00,  _ago(12), "UPI",  "Music subscription"),
        ("Steam",            "entertainment", 1299.00, _ago(19), "card", "PC game purchase"),

        # --- Suspicious / Unknown (1) – required demo txn ---
        ("UNKNOWN_ONLINE_9821", "unknown",   4500.00,  _ago(6),  "card", "Unrecognised online charge"),
    ]
    # fmt: on

    txns = [
        Transaction(
            txn_id=_txn_id(),
            account_id="ACC-C1001",
            date=txn_date,
            amount=Decimal(str(amount)),
            category=category,
            merchant=merchant,
            channel=channel,
            status="success",
            description=description,
        )
        for merchant, category, amount, txn_date, channel, description in raw
    ]
    session.add_all(txns)
    session.flush()
    print(f"  [transactions] ✓ Inserted {len(txns)} transactions.")

    # Return the suspicious txn object for fraud_cases seeding
    for t in txns:
        if t.merchant == "UNKNOWN_ONLINE_9821":
            return t
    return None  # type: ignore


def _seed_fraud_cases(session, suspicious_txn_id: str | None) -> None:
    print("  [fraud_cases] Checking …")
    if not suspicious_txn_id:
        print("  [fraud_cases] No suspicious txn found – skipping.")
        return
    existing = (
        session.query(FraudCase)
        .filter(FraudCase.customer_id == "C1001")
        .count()
    )
    if existing:
        print("  [fraud_cases] Already seeded – skipping.")
        return
    session.add(
        FraudCase(
            case_id=_case_id(),
            txn_id=suspicious_txn_id,
            customer_id="C1001",
            status="open",
            flag_reason=(
                "Transaction from unrecognised merchant 'UNKNOWN_ONLINE_9821'. "
                "Amount ₹4,500 flagged by ML anomaly detector (z-score > 3.1)."
            ),
            ticket_number="TICK-" + uuid.uuid4().hex[:8].upper(),
        )
    )
    session.flush()
    print("  [fraud_cases] ✓ Inserted fraud case for suspicious txn.")


def _link_user(session) -> None:
    """Link the 'shrey' user row (if present) to customer C1001."""
    print("  [users] Attempting to link 'shrey' → C1001 …")
    try:
        result = session.execute(
            text(
                "UPDATE users SET customer_id = 'C1001' "
                "WHERE username = 'shrey' AND (customer_id IS NULL OR customer_id = 'C1001')"
            )
        )
        if result.rowcount:
            print(f"  [users] ✓ Linked {result.rowcount} row(s).")
        else:
            print("  [users] No matching 'shrey' user found – skipping.")
    except Exception as exc:
        # users table may not have customer_id column yet; gracefully skip
        print(f"  [users] ⚠ Could not update users table: {exc}")


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------

def seed() -> None:
    """Idempotently seed all demo data for customer C1001."""
    print("\n🌱 Bank_Buddy seed starting …\n")
    with SessionLocal() as session:
        try:
            _seed_customer(session)
            _seed_account(session)
            _seed_card(session)
            _seed_loan(session)
            _seed_upcoming_payments(session)

            # transactions returns the suspicious txn for fraud linkage
            suspicious_txn = _seed_transactions(session)
            suspicious_id = suspicious_txn.txn_id if suspicious_txn else None

            _seed_fraud_cases(session, suspicious_id)
            _link_user(session)

            session.commit()
            print("\n✅ Seed complete – all tables populated for C1001.\n")

        except Exception as exc:
            session.rollback()
            print(f"\n❌ Seed failed – rolled back. Error: {exc}\n")
            raise


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    seed()
