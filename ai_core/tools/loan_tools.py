"""
loan_tools.py
-------------
Deterministic banking tool functions for loan details and upcoming payment schedules.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel
from sqlalchemy import text


# ---------------------------------------------------------------------------
# get_loan_details
# ---------------------------------------------------------------------------

class GetLoanDetailsInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM


class LoanDetail(BaseModel):
    loan_id: str
    loan_type: str        # e.g. 'Personal Loan', 'Home Loan', 'Auto Loan'
    principal: Decimal
    outstanding: Decimal
    emi_amount: Decimal
    interest_rate: float  # annual percentage rate (APR)
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
        text("""
        SELECT loan_id,
               loan_type,
               principal,
               outstanding,
               emi_amount,
               interest_rate,
               next_due_date,
               tenure_months
        FROM   loans
        WHERE  customer_id = :customer_id
        ORDER BY next_due_date ASC
        """),
        {"customer_id": inp.customer_id},
    ).fetchall()

    loans: list[LoanDetail] = []
    for row in rows:
        m = row._mapping
        loans.append(
            LoanDetail(
                loan_id=m["loan_id"],
                loan_type=m["loan_type"],
                principal=Decimal(str(m["principal"])),
                outstanding=Decimal(str(m["outstanding"])),
                emi_amount=Decimal(str(m["emi_amount"])),
                interest_rate=float(m["interest_rate"]),
                next_due_date=date.fromisoformat(str(m["next_due_date"])[:10]),
                tenure_months=int(m["tenure_months"]),
            )
        )

    # Deterministic Python arithmetic: sum across all active loans
    total_outstanding = sum((loan.outstanding for loan in loans), Decimal("0.00"))

    return GetLoanDetailsOutput(
        loans=loans,
        total_outstanding=total_outstanding,
        trace_id=trace_id,
    )


# ---------------------------------------------------------------------------
# get_upcoming_payments
# ---------------------------------------------------------------------------

class GetUpcomingPaymentsInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM
    window_days: int = 30  # look-ahead window; default: next 30 days


class UpcomingPaymentItem(BaseModel):
    payment_id: str
    payment_type: str    # e.g. 'Credit Card', 'Loan EMI', 'Utility Bill'
    description: str
    amount: Decimal
    due_date: date
    days_until_due: int  # Python-computed: (due_date - today).days
    status: str          # 'pending', 'scheduled'


class GetUpcomingPaymentsOutput(BaseModel):
    payments: list[UpcomingPaymentItem]
    total_amount: Decimal  # Python-computed sum of all upcoming amounts in the window
    window_days: int
    trace_id: str


def get_upcoming_payments(inp: GetUpcomingPaymentsInput, db) -> GetUpcomingPaymentsOutput:
    """
    Retrieve all scheduled payments due within the look-ahead window.

    total_amount and days_until_due are computed in Python — never by the LLM.

    Args:
        inp: Validated input with JWT-injected customer_id and window_days.
        db:  Database connection / session object.

    Returns:
        GetUpcomingPaymentsOutput with individual line items and a grand total.
    """
    trace_id = str(uuid.uuid4())[:8]
    today = date.today()
    cutoff = today + __import__("datetime").timedelta(days=inp.window_days)

    rows = db.execute(
        text("""
        SELECT payment_id,
               payment_type,
               description,
               amount,
               due_date,
               status
        FROM   upcoming_payments
        WHERE  customer_id = :customer_id
          AND  due_date    BETWEEN :start_date AND :end_date
          AND  status      != 'paid'
        ORDER BY due_date ASC
        """),
        {
            "customer_id": inp.customer_id,
            "start_date": today.isoformat(),
            "end_date": cutoff.isoformat(),
        },
    ).fetchall()

    payments: list[UpcomingPaymentItem] = []
    for row in rows:
        m = row._mapping
        due = date.fromisoformat(str(m["due_date"])[:10])
        days_until = (due - today).days  # deterministic Python arithmetic
        payments.append(
            UpcomingPaymentItem(
                payment_id=m["payment_id"],
                payment_type=m["payment_type"],
                description=m["description"],
                amount=Decimal(str(m["amount"])),
                due_date=due,
                days_until_due=days_until,
                status=m["status"],
            )
        )

    # Deterministic Python arithmetic: sum all obligations in window
    total_amount = sum((p.amount for p in payments), Decimal("0.00"))

    return GetUpcomingPaymentsOutput(
        payments=payments,
        total_amount=total_amount,
        window_days=inp.window_days,
        trace_id=trace_id,
    )
