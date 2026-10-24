"""
account_tools.py
----------------
Deterministic banking tool functions for account balance and expense analysis.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

import pandas as pd
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# get_balance
# ---------------------------------------------------------------------------

class GetBalanceInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM


class GetBalanceOutput(BaseModel):
    account_id: str
    balance: Decimal
    currency: str
    account_type: str
    as_of: datetime
    trace_id: str


def get_balance(inp: GetBalanceInput, db) -> GetBalanceOutput:
    """
    Fetch the current account balance for the authenticated customer.

    Args:
        inp: Validated input containing the JWT-injected customer_id.
        db:  Database connection / session object.

    Returns:
        GetBalanceOutput with account details and a short trace_id for logging.

    Raises:
        ValueError: If no account is found for the given customer_id.
    """
    trace_id = str(uuid.uuid4())[:8]

    row = db.execute(
        """
        SELECT account_id, balance, currency, account_type
        FROM   accounts
        WHERE  customer_id = ?
        LIMIT  1
        """,
        (inp.customer_id,),
    ).fetchone()

    if row is None:
        raise ValueError(
            f"[{trace_id}] No account found for customer_id={inp.customer_id!r}"
        )

    return GetBalanceOutput(
        account_id=row["account_id"],
        balance=Decimal(str(row["balance"])),
        currency=row["currency"],
        account_type=row["account_type"],
        as_of=datetime.utcnow(),
        trace_id=trace_id,
    )


# ---------------------------------------------------------------------------
# analyze_expenses
# ---------------------------------------------------------------------------

class AnalyzeExpensesInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM
    period: Literal["current_month", "last_month", "last_30_days", "last_7_days"] = (
        "current_month"
    )


class ExpenseCategory(BaseModel):
    category: str
    total: Decimal
    transaction_count: int
    percentage: float


class AnalyzeExpensesOutput(BaseModel):
    period: str
    period_start: date
    period_end: date
    total_spent: Decimal
    categories: list[ExpenseCategory]
    transaction_count: int
    trace_id: str


def _resolve_period(period: str) -> tuple[date, date]:
    """Return (period_start, period_end) for the requested period label."""
    today = date.today()

    if period == "current_month":
        start = today.replace(day=1)
        end = today
    elif period == "last_month":
        first_of_current = today.replace(day=1)
        # Last day of previous month
        end = first_of_current - __import__("datetime").timedelta(days=1)
        start = end.replace(day=1)
    elif period == "last_30_days":
        start = today - __import__("datetime").timedelta(days=30)
        end = today
    elif period == "last_7_days":
        start = today - __import__("datetime").timedelta(days=7)
        end = today
    else:
        raise ValueError(f"Unknown period: {period!r}")

    return start, end


def analyze_expenses(inp: AnalyzeExpensesInput, db) -> AnalyzeExpensesOutput:
    """
    Break down spending by category for the requested time period.

    All arithmetic (totals, percentages) is computed in Python via pandas —
    the LLM never performs calculations.

    Args:
        inp: Validated input with JWT-injected customer_id and period label.
        db:  Database connection / session object.

    Returns:
        AnalyzeExpensesOutput with per-category breakdown and grand total.
    """
    trace_id = str(uuid.uuid4())[:8]
    period_start, period_end = _resolve_period(inp.period)

    rows = db.execute(
        """
        SELECT category,
               amount
        FROM   transactions
        WHERE  customer_id = ?
          AND  txn_date    BETWEEN ? AND ?
          AND  txn_type    = 'debit'
        """,
        (inp.customer_id, period_start.isoformat(), period_end.isoformat()),
    ).fetchall()

    if not rows:
        return AnalyzeExpensesOutput(
            period=inp.period,
            period_start=period_start,
            period_end=period_end,
            total_spent=Decimal("0.00"),
            categories=[],
            transaction_count=0,
            trace_id=trace_id,
        )

    # ------------------------------------------------------------------ pandas
    df = pd.DataFrame(rows, columns=["category", "amount"])
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)

    grouped = (
        df.groupby("category")["amount"]
        .agg(total="sum", transaction_count="count")
        .reset_index()
    )

    total_spent_float: float = float(grouped["total"].sum())

    categories: list[ExpenseCategory] = []
    for _, row in grouped.iterrows():
        cat_total = float(row["total"])
        percentage = round((cat_total / total_spent_float) * 100, 2) if total_spent_float else 0.0
        categories.append(
            ExpenseCategory(
                category=str(row["category"]),
                total=Decimal(str(round(cat_total, 2))),
                transaction_count=int(row["transaction_count"]),
                percentage=percentage,
            )
        )

    # Sort descending by total spend
    categories.sort(key=lambda c: c.total, reverse=True)

    return AnalyzeExpensesOutput(
        period=inp.period,
        period_start=period_start,
        period_end=period_end,
        total_spent=Decimal(str(round(total_spent_float, 2))),
        categories=categories,
        transaction_count=int(len(df)),
        trace_id=trace_id,
    )
