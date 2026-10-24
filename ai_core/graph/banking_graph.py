"""
banking_graph.py — Main LangGraph orchestration layer.

Exposes two public functions:
  run_banking_graph   — called from POST /chat
  resume_banking_graph — called from POST /chat/confirm
"""
from typing import Any, Optional
from agents import AGENT_REGISTRY
from agents.supervisor import route_query, compose_answer
from audit.logger import write_audit
from datetime import datetime


def run_banking_graph(
    message: str,
    customer_id: str,
    session_id: str,
    conversation_history: list[dict],
    trace_id: str,
    db: Any,
    pending_confirmations: dict
) -> dict:
    """
    Main entry point for the multi-agent banking graph.

    1. Supervisor routes the question to specialist agent(s).
    2. Each agent runs its Reason -> Act -> Observe -> GroundingCheck loop.
    3. Supervisor composes the final answer (deterministic arithmetic for
       compound queries — never delegated to the LLM).
    4. Audit log is written (append-only).
    5. Returns a structured result dict.

    Args:
        message:               Raw customer question.
        customer_id:           Extracted from JWT sub claim.
        session_id:            Frontend session identifier.
        conversation_history:  Prior turns for context (currently passed through).
        trace_id:              Unique BANK-XXXXXXXX identifier for this request.
        db:                    SQLAlchemy session (injected by FastAPI endpoint).
        pending_confirmations: Shared in-memory dict for high-risk action tokens.

    Returns:
        dict with keys: answer, answer_type, agents_invoked, tools_invoked,
                        requires_confirmation, confirmation_token, data
    """
    # ── Step 1: Supervisor routes ────────────────────────────────────────────
    agents_to_invoke = route_query(message)

    # ── Step 2: Run each specialist agent ───────────────────────────────────
    agent_results: list[dict] = []
    for agent_name in agents_to_invoke:
        run_fn = AGENT_REGISTRY.get(agent_name)
        if not run_fn:
            continue
        try:
            # card_agent and fraud_agent need the pending_confirmations dict
            # so they can register high-risk action tokens before returning.
            if agent_name in ('card_agent', 'fraud_agent'):
                result = run_fn(
                    question=message,
                    customer_id=customer_id,
                    db=db,
                    pending_confirmations=pending_confirmations
                )
            else:
                result = run_fn(
                    question=message,
                    customer_id=customer_id,
                    db=db
                )
            agent_results.append(dict(result))
        except Exception as e:
            agent_results.append({
                'agent_name': agent_name,
                'answer': f'Error in {agent_name}: {str(e)}',
                'answer_type': 'error',
                'tools_invoked': [],
                'tool_outputs': {},
                'requires_confirmation': False,
                'confirmation_token': None,
                'data': None
            })

    # ── Step 3: Supervisor composes final answer ─────────────────────────────
    if not agent_results:
        final: dict = {
            'answer': 'I could not process your request. Please try again.',
            'answer_type': 'error',
            'agents_invoked': agents_to_invoke,
            'tools_invoked': [],
            'requires_confirmation': False,
            'confirmation_token': None,
            'data': None
        }
    else:
        final = compose_answer(message, agent_results)

    # ── Step 4: Write audit log (append-only, never raises) ──────────────────
    try:
        write_audit(
            trace_id=trace_id,
            customer_id=customer_id,
            agents_invoked=final.get('agents_invoked', agents_to_invoke),
            tools_invoked=final.get('tools_invoked', []),
            decision=final.get('answer_type', 'lookup'),
            outcome='confirmation_pending' if final.get('requires_confirmation') else 'success',
            db=db
        )
    except Exception as e:
        print(f'[Audit] Warning: could not write audit log: {e}')

    return final


def resume_banking_graph(
    confirmation_token: str,
    decision: str,
    pending: dict,
    trace_id: str,
    db: Any
) -> dict:
    """
    Resume a paused high-risk action after the user confirms or cancels.
    Called from POST /chat/confirm.

    The interrupt/resume pattern:
      - During run_banking_graph, a high-risk agent stores its intended tool
        call in pending_confirmations[token] and returns requires_confirmation=True.
      - The frontend shows the confirmation dialog.
      - On POST /chat/confirm, this function retrieves the pending payload,
        either executes the tool (decision='yes') or cancels (decision='no').

    Args:
        confirmation_token: UUID token generated during the original request.
        decision:           'yes' (execute) | 'no' (cancel).
        pending:            dict with keys: tool, args, customer_id, agent_name.
        trace_id:           New trace ID for this follow-up request.
        db:                 SQLAlchemy session.

    Returns:
        dict with same shape as run_banking_graph output.
    """
    from tools import TOOL_REGISTRY
    import uuid

    tool_name = pending.get('tool')
    args = pending.get('args', {})
    customer_id = pending.get('customer_id')
    agent_name = pending.get('agent_name', 'unknown')

    # ── Cancelled ────────────────────────────────────────────────────────────
    if decision == 'no':
        result: dict = {
            'answer': (
                f"Action cancelled. Your {tool_name.replace('_', ' ')} "
                "request has not been processed."
            ),
            'answer_type': 'action',
            'agents_invoked': [agent_name],
            'tools_invoked': [],
            'requires_confirmation': False,
            'confirmation_token': None,
            'data': None
        }
        write_audit(
            trace_id=trace_id,
            customer_id=customer_id,
            agents_invoked=[agent_name],
            tools_invoked=[],
            decision='action_cancelled',
            outcome='cancelled',
            db=db
        )
        return result

    # ── Confirmed: execute the high-risk tool ────────────────────────────────
    tool_entry = TOOL_REGISTRY.get(tool_name)
    if not tool_entry:
        return {
            'answer': f'Unknown tool: {tool_name}',
            'answer_type': 'error',
            'agents_invoked': [agent_name],
            'tools_invoked': [],
            'requires_confirmation': False,
            'data': None
        }

    try:
        tool_fn = tool_entry['fn']

        # Build the correct Pydantic input model per tool
        if tool_name == 'block_card':
            from tools.card_tools import BlockCardInput
            inp = BlockCardInput(
                customer_id=customer_id,
                card_id=args.get('card_id', 'CARD-01'),
                idempotency_key=args.get('idempotency_key', str(uuid.uuid4()))
            )
        elif tool_name == 'raise_dispute':
            from tools.fraud_tools import RaiseDisputeInput
            inp = RaiseDisputeInput(
                customer_id=customer_id,
                transaction_id=args.get('transaction_id', ''),
                reason=args.get('reason', 'Customer reported unrecognized transaction')
            )
        else:
            return {
                'answer': f'Tool {tool_name} is not resumable',
                'answer_type': 'error',
                'agents_invoked': [agent_name],
                'tools_invoked': [],
                'data': None
            }

        output = tool_fn(inp, db)
        output_dict = output.model_dump()

        # Compose human-readable confirmation answer
        if tool_name == 'block_card':
            answer = (
                f"Your card ending in {args.get('card_last4', '****')} has been "
                f"successfully blocked. "
                f"Ticket number: {output_dict.get('ticket_number')}. "
                "If you need a replacement card, please contact customer support."
            )
        elif tool_name == 'raise_dispute':
            answer = (
                f"A dispute has been raised for transaction "
                f"{args.get('transaction_id', '')}. "
                f"Ticket number: {output_dict.get('ticket_number')}. "
                "Your case has been routed to our human review team."
            )
        else:
            answer = 'Action completed successfully.'

        write_audit(
            trace_id=trace_id,
            customer_id=customer_id,
            agents_invoked=[agent_name],
            tools_invoked=[tool_name],
            decision='action_executed',
            outcome='success',
            db=db
        )

        return {
            'answer': answer,
            'answer_type': 'action',
            'agents_invoked': [agent_name],
            'tools_invoked': [tool_name],
            'requires_confirmation': False,
            'confirmation_token': None,
            'data': output_dict
        }

    except Exception as e:
        return {
            'answer': f'Error executing {tool_name}: {str(e)}',
            'answer_type': 'error',
            'agents_invoked': [agent_name],
            'tools_invoked': [tool_name],
            'requires_confirmation': False,
            'data': None
        }
