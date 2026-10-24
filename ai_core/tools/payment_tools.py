"""
payment_tools.py
----------------
Deterministic banking tool functions for UPI transaction queries and payment status.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import text


# ---------------------------------------------------------------------------
# get_upi_status
# ---------------------------------------------------------------------------

class GetUPIStatusInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM
    reference_number: Optional[str] = None
    transaction_id: Optional[str] = None
    merchant: Optional[str] = None
    channel: Optional[str] = None
    date: Optional[date] = None

# Backward compatibility alias
GetUpiStatusInput = GetUPIStatusInput


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
    Look up transactions for the authenticated customer with optional filters.

    Args:
        inp: Validated input with JWT-injected customer_id and optional filters.
        db:  Database connection / session object.

    Returns:
        GetUPIStatusOutput containing matched transactions and a count.
    """
    trace_id = str(uuid.uuid4())[:8]

    # Build query safely
    clauses = ["customer_id = :customer_id"]
    params = {"customer_id": inp.customer_id}

    if inp.channel:
        clauses.append("channel = :channel")
        params["channel"] = inp.channel

    ref = inp.reference_number or inp.transaction_id
    if ref:
        clauses.append("txn_id = :ref_num")
        params["ref_num"] = ref

    if inp.merchant:
        clauses.append("LOWER(merchant) LIKE :merchant")
        params["merchant"] = f"%{inp.merchant.lower()}%"

    if inp.date is not None:
        clauses.append("date = :dt")
        params["dt"] = inp.date.isoformat()

    where_sql = " AND ".join(clauses)
    query_str = f"""
        SELECT txn_id,
               amount,
               merchant,
               status,
               channel,
               date
        FROM   transactions
        WHERE  {where_sql}
        ORDER BY date DESC
        LIMIT  20
    """

    rows = db.execute(text(query_str), params).fetchall()

    transactions: list[UPITransaction] = []
    for row in rows:
        m = row._mapping
        transactions.append(
            UPITransaction(
                txn_id=m["txn_id"],
                amount=Decimal(str(m["amount"])),
                merchant=m["merchant"],
                status=m["status"],
                failure_reason=None,
                channel=m["channel"],
                date=m["date"] if isinstance(m["date"], date) else date.fromisoformat(str(m["date"])),
            )
        )

    return GetUPIStatusOutput(
        transactions=transactions,
        total_found=len(transactions),
        trace_id=trace_id,
    )
