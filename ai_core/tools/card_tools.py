"""
card_tools.py
-------------
Deterministic banking tool functions for credit card details and card blocking.

SECURITY: customer_id is ALWAYS injected from JWT server-side.
          It must never originate from LLM-generated text.

HIGH RISK: block_card mutates state. It is idempotent via idempotency_key and
           always requires an explicit customer_id + card_id ownership check.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel
from sqlalchemy import text


# ---------------------------------------------------------------------------
# get_credit_card_details
# ---------------------------------------------------------------------------

class GetCreditCardDetailsInput(BaseModel):
    customer_id: str  # injected from JWT, never from LLM
    card_id: Optional[str] = None


class CardDetail(BaseModel):
    card_id: str
    card_type: str               # e.g. 'Visa', 'Mastercard', 'Rupay'
    card_last4: str              # last 4 digits only
    status: str                  # 'active', 'blocked', 'expired'
    due_date: date               # next payment due date
    amount_due: Decimal          # minimum amount due
    statement_balance: Decimal   # total statement balance
    credit_limit: Decimal
    days_until_due: int          # Python-computed: (due_date - today).days


class GetCreditCardDetailsOutput(BaseModel):
    cards: list[CardDetail]
    trace_id: str


def get_credit_card_details(inp: GetCreditCardDetailsInput, db) -> GetCreditCardDetailsOutput:
    """
    Retrieve all credit cards linked to the authenticated customer.

    days_until_due is computed in Python — never by the LLM.

    Args:
        inp: Validated input with JWT-injected customer_id.
        db:  Database connection / session object.

    Returns:
        GetCreditCardDetailsOutput with details for each card.
    """
    trace_id = str(uuid.uuid4())[:8]
    today = date.today()

    rows = db.execute(
        text("""
        SELECT card_id,
               card_type,
               card_last4,
               status,
               due_date,
               amount_due,
               statement_balance,
               credit_limit
        FROM   cards
        WHERE  customer_id = :customer_id
        ORDER BY due_date ASC
        """),
        {"customer_id": inp.customer_id},
    ).fetchall()

    cards: list[CardDetail] = []
    for row in rows:
        m = row._mapping
        due = date.fromisoformat(str(m["due_date"])[:10])
        days_until_due = (due - today).days  # deterministic Python arithmetic
        cards.append(
            CardDetail(
                card_id=m["card_id"],
                card_type=m["card_type"],
                card_last4=str(m["card_last4"]),
                status=m["status"],
                due_date=due,
                amount_due=Decimal(str(m["amount_due"])),
                statement_balance=Decimal(str(m["statement_balance"])),
                credit_limit=Decimal(str(m["credit_limit"])),
                days_until_due=days_until_due,
            )
        )

    return GetCreditCardDetailsOutput(cards=cards, trace_id=trace_id)


# ---------------------------------------------------------------------------
# block_card  (HIGH RISK — mutates state)
# ---------------------------------------------------------------------------

class BlockCardInput(BaseModel):
    customer_id: str       # injected from JWT, never from LLM
    card_id: str           # the card to block
    idempotency_key: str   # caller-supplied idempotency key to prevent duplicate blocks


class BlockCardOutput(BaseModel):
    card_id: str
    previous_status: str
    new_status: Literal["blocked"] = "blocked"
    ticket_number: str     # format: TKT-<8 hex chars uppercase>
    blocked_at: datetime
    message: str
    trace_id: str


def block_card(inp: BlockCardInput, db) -> BlockCardOutput:
    """
    Block a credit/debit card owned by the authenticated customer.

    Idempotency: if the card is already blocked, the existing blocked state is
    returned without a second write — safe to retry with the same idempotency_key.

    Ownership is enforced by requiring BOTH customer_id AND card_id to match in
    the WHERE clause — the customer_id comes from the JWT, never from the LLM.

    Args:
        inp: Validated input with JWT-injected customer_id, card_id, and idempotency_key.
        db:  Database connection / session object (must support transactions).

    Returns:
        BlockCardOutput with ticket_number and confirmation details.

    Raises:
        ValueError: If the card is not found or does not belong to the customer.
    """
    trace_id = str(uuid.uuid4())[:8]

    # ---- ownership check + fetch current status ----
    row = db.execute(
        text("""
        SELECT card_id, status, blocked_ticket
        FROM   cards
        WHERE  card_id      = :card_id
          AND  customer_id  = :customer_id
        """),
        {"card_id": inp.card_id, "customer_id": inp.customer_id},
    ).fetchone()

    if row is None:
        raise ValueError(
            f"[{trace_id}] Card {inp.card_id!r} not found for this customer."
        )

    m = row._mapping
    previous_status: str = m["status"]

    # ---- idempotency: already blocked → return existing info ----
    if previous_status == "blocked":
        existing_ticket = m["blocked_ticket"] or f"TKT-{uuid.uuid4().hex[:8].upper()}"
        return BlockCardOutput(
            card_id=inp.card_id,
            previous_status="blocked",
            new_status="blocked",
            ticket_number=existing_ticket,
            blocked_at=datetime.utcnow(),
            message=(
                f"Card ending {inp.card_id[-4:]} is already blocked. "
                f"No changes made. Ticket: {existing_ticket}"
            ),
            trace_id=trace_id,
        )

    # ---- generate ticket and persist block ----
    ticket_number = f"TKT-{uuid.uuid4().hex[:8].upper()}"
    blocked_at = datetime.utcnow()

    db.execute(
        text("""
        UPDATE cards
        SET    status         = 'blocked',
               blocked_ticket = :ticket_number,
               blocked_at     = :blocked_at
        WHERE  card_id       = :card_id
          AND  customer_id   = :customer_id
        """),
        {
            "ticket_number": ticket_number,
            "blocked_at": blocked_at.isoformat(),
            "card_id": inp.card_id,
            "customer_id": inp.customer_id,
        },
    )
    db.commit()

    return BlockCardOutput(
        card_id=inp.card_id,
        previous_status=previous_status,
        new_status="blocked",
        ticket_number=ticket_number,
        blocked_at=blocked_at,
        message=(
            f"Card ending {inp.card_id[-4:]} has been successfully blocked. "
            f"Ticket reference: {ticket_number}. "
            "Contact support if this was done in error."
        ),
        trace_id=trace_id,
    )
