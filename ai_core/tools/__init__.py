"""
tools/__init__.py
-----------------
Central tool registry for Bank_Buddy AI core.

Each entry maps a tool name to:
  - fn           : the callable tool function
  - is_high_risk : True if the tool mutates state or has irreversible effects
  - owner        : the agent sub-system responsible for this tool

SECURITY: All tool functions enforce that customer_id is JWT-injected.
          High-risk tools require explicit confirmation before execution.
"""

from .account_tools import analyze_expenses, get_balance
from .card_tools import block_card, get_credit_card_details
from .fraud_tools import fraud_verification, raise_dispute
from .loan_tools import get_loan_details, get_upcoming_payments
from .payment_tools import get_upi_status

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

TOOL_REGISTRY: dict[str, dict] = {
    "get_balance": {
        "fn": get_balance,
        "is_high_risk": False,
        "owner": "account_agent",
    },
    "analyze_expenses": {
        "fn": analyze_expenses,
        "is_high_risk": False,
        "owner": "account_agent",
    },
    "get_upi_status": {
        "fn": get_upi_status,
        "is_high_risk": False,
        "owner": "payment_agent",
    },
    "get_loan_details": {
        "fn": get_loan_details,
        "is_high_risk": False,
        "owner": "loan_agent",
    },
    "get_upcoming_payments": {
        "fn": get_upcoming_payments,
        "is_high_risk": False,
        "owner": "loan_agent",
    },
    "get_credit_card_details": {
        "fn": get_credit_card_details,
        "is_high_risk": False,
        "owner": "card_agent",
    },
    "block_card": {
        "fn": block_card,
        "is_high_risk": True,   # mutates cards table; requires confirmation
        "owner": "card_agent",
    },
    "fraud_verification": {
        "fn": fraud_verification,
        "is_high_risk": False,
        "owner": "fraud_agent",
    },
    "raise_dispute": {
        "fn": raise_dispute,
        "is_high_risk": True,   # inserts fraud_cases record; routed to human
        "owner": "fraud_agent",
    },
}


# ---------------------------------------------------------------------------
# Helper accessors
# ---------------------------------------------------------------------------

def get_tool(name: str) -> dict | None:
    """Return the full registry entry for *name*, or None if not found."""
    return TOOL_REGISTRY.get(name)


def is_high_risk(name: str) -> bool:
    """Return True if the named tool is marked high-risk, False otherwise."""
    entry = TOOL_REGISTRY.get(name)
    return entry["is_high_risk"] if entry else False
