"""
fraud_tools.py
--------------
Deterministic banking tool functions for fraud verification and dispute raising.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.

IMPORTANT: fraud_verification uses ONLY deterministic rule checks (no ML/AI).
           raise_dispute is HIGH RISK — it inserts a record and routes to human review.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class TransactionDetail(BaseModel):
    txn_id: str
    customer_id: str
    amount: Decimal
    merchant: str
    channel: str
    status: str
    txn_date: date
    description: Optional[str] = None
    failure_reason: Optional[str] = None


class FraudCase(BaseModel):
    case_id: str
    ticket_number: str
    status: str
    opened_at: datetime
    routed_to: str


# ---------------------------------------------------------------------------
# fraud_verification  (READ-ONLY, deterministic rule-based — NO ML)
# ---------------------------------------------------------------------------

class FraudVerificationInput(BaseModel):
    transaction_id: str   # the transaction to inspect
    customer_id: str      # injected from JWT, never from LLM


class FraudVerificationOutput(BaseModel):
    transaction: TransactionDetail
    is_flagged: bool
    flag_reason: Optional[str] = None
    existing_case: Optional[FraudCase] = None
    trace_id: str


def _check_fraud_rules(txn: TransactionDetail) -> tuple[bool, Optional[str]]:
    """
    Apply deterministic rule-based fraud checks. NO machine learning used.

    Rules:
      1. Merchant name contains 'UNKNOWN'  → suspicious merchant
      2. Transaction status != 'success'   → failed / reversed transaction

    Returns (is_flagged, flag_reason).
    """
    if "UNKNOWN" in txn.merchant.upper():
        return True, "Suspicious merchant: name contains 'UNKNOWN'"
    if txn.status.lower() != "success":
        return True, f"Transaction status is '{txn.status}' (not 'success')"
    return False, None


def fraud_verification(inp: FraudVerificationInput, db) -> FraudVerificationOutput:
    """
    Look up a transaction and apply deterministic rule-based fraud checks.

    Ownership is enforced: only transactions belonging to the JWT customer_id
    are accessible — preventing cross-customer data leakage.

    Args:
        inp: Validated input with JWT-injected customer_id and transaction_id.
        db:  Database connection / session object.

    Returns:
        FraudVerificationOutput with transaction details, flag status, and any
        existing fraud case.

    Raises:
        ValueError: If the transaction is not found for this customer.
    """
    trace_id = str(uuid.uuid4())[:8]

    txn_row = db.execute(
        """
        SELECT txn_id,
               customer_id,
               amount,
               merchant,
               channel,
               status,
               txn_date,
               description,
               failure_reason
        FROM   transactions
        WHERE  txn_id       = ?
          AND  customer_id  = ?
        """,
        (inp.transaction_id, inp.customer_id),
    ).fetchone()

    if txn_row is None:
        raise ValueError(
            f"[{trace_id}] Transaction {inp.transaction_id!r} not found "
            f"for customer_id={inp.customer_id!r}"
        )

    txn = TransactionDetail(
        txn_id=txn_row["txn_id"],
        customer_id=txn_row["customer_id"],
        amount=Decimal(str(txn_row["amount"])),
        merchant=txn_row["merchant"],
        channel=txn_row["channel"],
        status=txn_row["status"],
        txn_date=date.fromisoformat(str(txn_row["txn_date"])[:10]),
        description=txn_row["description"] or None,
        failure_reason=txn_row["failure_reason"] or None,
    )

    is_flagged, flag_reason = _check_fraud_rules(txn)

    # Check for any existing open fraud case on this transaction
    case_row = db.execute(
        """
        SELECT case_id,
               ticket_number,
               status,
               opened_at,
               routed_to
        FROM   fraud_cases
        WHERE  transaction_id = ?
          AND  customer_id    = ?
        ORDER BY opened_at DESC
        LIMIT 1
        """,
        (inp.transaction_id, inp.customer_id),
    ).fetchone()

    existing_case: Optional[FraudCase] = None
    if case_row:
        existing_case = FraudCase(
            case_id=case_row["case_id"],
            ticket_number=case_row["ticket_number"],
            status=case_row["status"],
            opened_at=datetime.fromisoformat(str(case_row["opened_at"])),
            routed_to=case_row["routed_to"],
        )

    return FraudVerificationOutput(
        transaction=txn,
        is_flagged=is_flagged,
        flag_reason=flag_reason,
        existing_case=existing_case,
        trace_id=trace_id,
    )


# ---------------------------------------------------------------------------
# raise_dispute  (HIGH RISK — mutates state, routes to human review)
# ---------------------------------------------------------------------------

class RaiseDisputeInput(BaseModel):
    customer_id: str      # injected from JWT, never from LLM
    transaction_id: str
    reason: str           # customer-provided reason for the dispute


class RaiseDisputeOutput(BaseModel):
    case_id: str
    ticket_number: str    # format: DISP-<8 hex chars uppercase>
    transaction_id: str
    status: Literal["open"] = "open"
    message: str
    opened_at: datetime
    routed_to: Literal["human_review"] = "human_review"
    trace_id: str


def raise_dispute(inp: RaiseDisputeInput, db) -> RaiseDisputeOutput:
    """
    Open a dispute case for a transaction owned by the authenticated customer.

    The dispute is immediately routed to 'human_review' — no automated resolution.
    Ownership check ensures the transaction belongs to the JWT customer_id before
    inserting the fraud_cases record.

    Args:
        inp: Validated input with JWT-injected customer_id, transaction_id, and reason.
        db:  Database connection / session object (must support transactions).

    Returns:
        RaiseDisputeOutput with case_id, ticket_number, and routing confirmation.

    Raises:
        ValueError: If the transaction is not found for this customer.
    """
    trace_id = str(uuid.uuid4())[:8]

    # Ownership check before any mutation
    txn_exists = db.execute(
        """
        SELECT 1
        FROM   transactions
        WHERE  txn_id      = ?
          AND  customer_id = ?
        """,
        (inp.transaction_id, inp.customer_id),
    ).fetchone()

    if txn_exists is None:
        raise ValueError(
            f"[{trace_id}] Transaction {inp.transaction_id!r} not found "
            f"for customer_id={inp.customer_id!r}. Dispute not raised."
        )

    case_id = str(uuid.uuid4())
    ticket_number = f"DISP-{uuid.uuid4().hex[:8].upper()}"
    opened_at = datetime.utcnow()

    db.execute(
        """
        INSERT INTO fraud_cases
            (case_id, ticket_number, customer_id, transaction_id,
             reason, status, opened_at, routed_to)
        VALUES (?, ?, ?, ?, ?, 'open', ?, 'human_review')
        """,
        (
            case_id,
            ticket_number,
            inp.customer_id,
            inp.transaction_id,
            inp.reason,
            opened_at.isoformat(),
        ),
    )
    db.commit()

    return RaiseDisputeOutput(
        case_id=case_id,
        ticket_number=ticket_number,
        transaction_id=inp.transaction_id,
        status="open",
        message=(
            f"Your dispute has been filed successfully. "
            f"Ticket: {ticket_number}. "
            "A human review agent will contact you within 3–5 business days."
        ),
        opened_at=opened_at,
        routed_to="human_review",
        trace_id=trace_id,
    )
