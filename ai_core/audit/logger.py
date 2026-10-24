"""
Audit Logger - Append-only audit log writer.
Every request writes trace_id, agents_invoked, tools_invoked,
decision, and outcome to the audit_log table. Never overwrites.
"""
from datetime import datetime
from typing import Any


def write_audit(
    trace_id: str,
    customer_id: str,
    agents_invoked: list[str],
    tools_invoked: list[str],
    decision: str,
    outcome: str,
    db: Any,
    answer_type: str = None
) -> None:
    """
    Append a record to audit_log. Never updates or deletes.

    Args:
        trace_id:       Unique request identifier (e.g. 'BANK-A1B2C3D4')
        customer_id:    Customer identifier from JWT sub claim
        agents_invoked: List of specialist agent names called
        tools_invoked:  List of tool function names called
        decision:       What the system decided (answer_type or action name)
        outcome:        'success' | 'error' | 'cancelled' | 'confirmation_pending'
        db:             SQLAlchemy session
        answer_type:    Optional override for answer_type column
    """
    from db.models import AuditLog

    try:
        record = AuditLog(
            trace_id=trace_id,
            customer_id=customer_id,
            agents_invoked=agents_invoked,
            tools_invoked=tools_invoked,
            decision=decision,
            outcome=outcome,
            answer_type=answer_type or decision,
            timestamp=datetime.utcnow()
        )
        db.add(record)
        db.commit()
        print(
            f'[Audit] {trace_id} | agents={agents_invoked} | '
            f'tools={tools_invoked} | outcome={outcome}'
        )
    except Exception as e:
        print(f'[Audit] ERROR writing audit log for {trace_id}: {e}')
        db.rollback()
