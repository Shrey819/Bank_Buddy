"""
loan_tools.py
-------------
Deterministic banking tool functions for loan details and upcoming payment lookup.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.

IMPORTANT: total_amount in get_upcoming_payments is computed in Python as
           sum(p.amount for p in payments) — the LLM never performs this sum.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# get_loan_details
# ---------------------------------------------------------------------------

class GetLoanDetailsInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM


class LoanDetail(BaseModel):
    loan_id: str
    loan_type: str
    principal: Decimal
    outstanding: Decimal
    emi_amount: Decimal
    interest_rate: float      # annual rate as percentage, e.g. 8.5 means 8.5 %
    next_due_date: date
    tenure_months: int


class GetLoanDetailsOutput(BaseModel):
    loans: list[LoanDetail]
    total_outstanding: Decimal  # Python-computed sum of outstanding across all loans
    trace_id: str


def get_loan_details(inp: GetLoanDetailsInput, db) -> GetLoanDetailsOutput:
    """
    Retrieve all active loans for the authenticated customer.

    total_outstanding is calculated in Python — not by the LLM.

    Args:
        inp: Validated input with JWT-injected customer_id.
        db:  Database connection / session object.

    Returns:
        GetLoanDetailsOutput with per-loan details and an aggregated outstanding total.
    """
    trace_id = str(uuid.uuid4())[:8]

    rows = db.execute(
        """
        SELECT loan_id,
               loan_type,
               principal,
               outstanding,
               emi_amount,
               interest_rate,
               next_due_date,
               tenure_months
        FROM   loans
        WHERE  customer_id = ?
          AND  status       = 'active'
        ORDER BY next_due_date ASC
        """,
        (inp.customer_id,),
    ).fetchall()

    loans: list[LoanDetail] = []
    for row in rows:
        loans.append(
            LoanDetail(
                loan_id=row["loan_id"],
                loan_type=row["loan_type"],
                principal=Decimal(str(row["principal"])),
                outstanding=Decimal(str(row["outstanding"])),
                emi_amount=Decimal(str(row["emi_amount"])),
                interest_rate=float(row["interest_rate"]),
                next_due_date=date.fromisoformat(str(row["next_due_date"])[:10]),
                tenure_months=int(row["tenure_months"]),
            )
        )

    # Python-computed aggregate — LLM must not perform this calculation
    total_outstanding: Decimal = sum(
        (loan.outstanding for loan in loans), Decimal("0.00")
    )

    return GetLoanDetailsOutput(
        loans=loans,
        total_outstanding=total_outstanding,
        trace_id=trace_id,
    )


# ---------------------------------------------------------------------------
# get_upcoming_payments
# ---------------------------------------------------------------------------

class GetUpcomingPaymentsInput(BaseModel):
    customer_id: str           # injected from JWT, never from LLM
    days_ahead: int = 30       # look-ahead window in days (default: 30)


class PaymentItem(BaseModel):
    payment_id: str
    payment_type: str          # e.g. 'loan_emi', 'credit_card', 'utility'
    description: str
    amount: Decimal
    due_date: date
    days_until_due: int        # Python-computed from due_date - today


class GetUpcomingPaymentsOutput(BaseModel):
    payments: list[PaymentItem]
    total_amount: Decimal      # Python-computed sum — LLM must NOT compute this
    currency: str = "INR"
    trace_id: str


def get_upcoming_payments(inp: GetUpcomingPaymentsInput, db) -> GetUpcomingPaymentsOutput:
    """
    Return all upcoming payments due within `days_ahead` days for the customer.

    CRITICAL: total_amount is calculated in Python as
              sum(p.amount for p in payments) — never by the LLM.

    Args:
        inp: Validated input with JWT-injected customer_id and days_ahead window.
        db:  Database connection / session object.

    Returns:
        GetUpcomingPaymentsOutput sorted by due_date ascending.
    """
    trace_id = str(uuid.uuid4())[:8]
    today = date.today()
    cutoff = today + timedelta(days=inp.days_ahead)

    rows = db.execute(
        """
        SELECT payment_id,
               payment_type,
               description,
               amount,
               due_date
        FROM   upcoming_payments
        WHERE  customer_id = ?
          AND  due_date    BETWEEN ? AND ?
          AND  status      != 'paid'
        ORDER BY due_date ASC
        """,
        (inp.customer_id, today.isoformat(), cutoff.isoformat()),
    ).fetchall()

    payments: list[PaymentItem] = []
    for row in rows:
        due = date.fromisoformat(str(row["due_date"])[:10])
        days_until_due = (due - today).days  # deterministic Python arithmetic
        payments.append(
            PaymentItem(
                payment_id=row["payment_id"],
                payment_type=row["payment_type"],
                description=row["description"],
                amount=Decimal(str(row["amount"])),
                due_date=due,
                days_until_due=days_until_due,
            )
        )

    # IMPORTANT: computed in Python — the LLM must never perform this sum
    total_amount: Decimal = sum(
        (p.amount for p in payments), Decimal("0.00")
    )

    return GetUpcomingPaymentsOutput(
        payments=payments,
        total_amount=total_amount,
        currency="INR",
        trace_id=trace_id,
    )
