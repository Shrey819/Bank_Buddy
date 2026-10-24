"""
payment_tools.py
----------------
Deterministic banking tool function for UPI transaction status lookup.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# get_upi_status
# ---------------------------------------------------------------------------

class GetUPIStatusInput(BaseModel):
    customer_id: str            # injected from JWT, never from LLM
    reference_number: Optional[str] = None   # UPI reference / UTR number
    merchant: Optional[str] = None           # partial merchant name filter
    date: Optional[date] = None              # filter to a specific date


class UPITransaction(BaseModel):
    txn_id: str
    amount: Decimal
    merchant: str
    status: str
    failure_reason: Optional[str] = None
    channel: str
    date: date


class GetUPIStatusOutput(BaseModel):
    transactions: list[UPITransaction]
    total_found: int
    trace_id: str


def get_upi_status(inp: GetUPIStatusInput, db) -> GetUPIStatusOutput:
    """
    Look up UPI transactions for the authenticated customer with optional filters.

    Filters are applied server-side in SQL; the LLM only receives the result.
    All filter parameters are optional — omitting all returns the last 30 days
    of UPI transactions.

    Args:
        inp: Validated input with JWT-injected customer_id and optional filters.
        db:  Database connection / session object.

    Returns:
        GetUPIStatusOutput containing matched UPI transactions and a count.
    """
    trace_id = str(uuid.uuid4())[:8]

    # Build the query dynamically to handle optional filters safely
    base_query = """
        SELECT txn_id,
               amount,
               merchant,
               status,
               failure_reason,
               channel,
               txn_date
        FROM   transactions
        WHERE  customer_id = ?
          AND  channel      = 'UPI'
    """
    params: list = [inp.customer_id]

    if inp.reference_number is not None:
        base_query += " AND txn_id = ?"
        params.append(inp.reference_number)

    if inp.merchant is not None:
        # Case-insensitive partial match via SQL LIKE
        base_query += " AND LOWER(merchant) LIKE ?"
        params.append(f"%{inp.merchant.lower()}%")

    if inp.date is not None:
        base_query += " AND DATE(txn_date) = ?"
        params.append(inp.date.isoformat())

    # Default: limit to last 30 days when no date-based filter is provided
    if inp.reference_number is None and inp.date is None:
        base_query += " AND txn_date >= DATE('now', '-30 days')"

    base_query += " ORDER BY txn_date DESC"

    rows = db.execute(base_query, params).fetchall()

    transactions: list[UPITransaction] = []
    for row in rows:
        transactions.append(
            UPITransaction(
                txn_id=row["txn_id"],
                amount=Decimal(str(row["amount"])),
                merchant=row["merchant"],
                status=row["status"],
                failure_reason=row["failure_reason"] or None,
                channel=row["channel"],
                date=date.fromisoformat(str(row["txn_date"])[:10]),
            )
        )

    return GetUPIStatusOutput(
        transactions=transactions,
        total_found=len(transactions),
        trace_id=trace_id,
    )
