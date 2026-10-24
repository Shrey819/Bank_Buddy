import os
import json
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv

load_dotenv()

SUPERVISOR_SYSTEM_PROMPT = """
You are the Supervisor Agent for Bank Buddy, an AI banking assistant.
Your ONLY job is to decide which specialist agent(s) should handle the customer's question.

Available specialist agents:
- account_agent: handles balance inquiries, expense tracking, spending analysis
- payment_agent: handles UPI transaction status, payment lookups
- loan_agent: handles EMI schedules, loan details, upcoming bill payments
- card_agent: handles credit card details, due dates, blocking a lost/stolen card
- fraud_agent: handles suspicious transactions, fraud verification, dispute filing

For compound questions (e.g. "how much money do I have after paying all bills?"), route to MULTIPLE agents.

Respond ONLY with valid JSON in this format:
{"agents": ["agent_name1", "agent_name2"]}

Examples:
- "What is my balance?" → {"agents": ["account_agent"]}
- "How much have I spent this month?" → {"agents": ["account_agent"]}
- "What is my UPI status?" → {"agents": ["payment_agent"]}
- "What is my EMI amount?" → {"agents": ["loan_agent"]}
- "Block my card" → {"agents": ["card_agent"]}
- "I don't recognize this transaction" → {"agents": ["fraud_agent"]}
- "How much money do I have after paying all upcoming bills?" → {"agents": ["account_agent", "loan_agent", "card_agent"]}
- "What are my bills and credit card dues?" → {"agents": ["loan_agent", "card_agent"]}
"""


def route_query(question: str) -> list[str]:
    """Use LLM to decide which specialist agents to invoke."""
    llm = ChatOpenAI(
        base_url=os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        api_key=os.getenv('OPENROUTER_API_KEY', 'placeholder'),
        model=os.getenv('OPENROUTER_MODEL', 'meta-llama/llama-3.1-8b-instruct:free'),
        temperature=0.0,
    )
    messages = [
        SystemMessage(content=SUPERVISOR_SYSTEM_PROMPT),
        HumanMessage(content=f"Customer question: {question}")
    ]
    response = llm.invoke(messages)
    try:
        parsed = json.loads(response.content)
        agents = parsed.get('agents', ['account_agent'])
        # Validate agents are real
        valid = {'account_agent', 'payment_agent', 'loan_agent', 'card_agent', 'fraud_agent'}
        return [a for a in agents if a in valid] or ['account_agent']
    except Exception:
        # Fallback: try simple keyword routing
        q = question.lower()
        if any(w in q for w in ['block', 'lost', 'stolen', 'card']):
            return ['card_agent']
        if any(w in q for w in ['fraud', 'dispute', 'recognize', 'unauthori']):
            return ['fraud_agent']
        if any(w in q for w in ['upi', 'payment', 'transfer', 'sent']):
            return ['payment_agent']
        if any(w in q for w in ['emi', 'loan', 'bill', 'upcoming', 'due']):
            return ['loan_agent']
        if any(w in q for w in ['balance', 'spend', 'expense', 'money', 'available', 'afford']):
            if any(w in q for w in ['bill', 'pay', 'upcoming', 'after']):
                return ['account_agent', 'loan_agent', 'card_agent']  # compound query
            return ['account_agent']
        return ['account_agent']  # default


def compose_answer(question: str, agent_results: list[dict]) -> dict:
    """
    Compose the final answer from multiple agent results.
    For the showcase question (balance - obligations), do the arithmetic in Python.
    NEVER let the LLM do arithmetic.
    """
    from decimal import Decimal

    agents_invoked = [r['agent_name'] for r in agent_results]
    all_tools: list[str] = []
    all_data: dict[str, Any] = {}

    for r in agent_results:
        all_tools.extend(r.get('tools_invoked', []))
        if r.get('data'):
            all_data[r['agent_name']] = r['data']

    # Check if any agent requires confirmation (high-risk action)
    for r in agent_results:
        if r.get('requires_confirmation'):
            return {
                'answer': r['answer'],
                'answer_type': 'confirmation_required',
                'agents_invoked': agents_invoked,
                'tools_invoked': all_tools,
                'requires_confirmation': True,
                'confirmation_token': r.get('confirmation_token'),
                'data': r.get('data')
            }

    # Showcase compound query: balance - upcoming payments
    balance_data = all_data.get('account_agent', {}).get('get_balance', {})
    payments_data = all_data.get('loan_agent', {}).get('get_upcoming_payments', {})
    card_data = all_data.get('card_agent', {}).get('get_credit_card_details', {})

    if balance_data and (payments_data or card_data):
        # Deterministic arithmetic — Python only, never LLM
        balance = Decimal(str(balance_data.get('balance', 0)))
        upcoming_total = Decimal(str(payments_data.get('total_amount', 0))) if payments_data else Decimal('0')

        # Add card amount_due if not already in upcoming_payments
        card_amount = Decimal('0')
        if card_data and isinstance(card_data, dict):
            cards = card_data.get('cards', [])
            for c in cards:
                card_amount += Decimal(str(c.get('amount_due', 0)))

        # Avoid double-counting if card is in upcoming_payments
        total_obligations = upcoming_total if upcoming_total > 0 else card_amount
        available = balance - total_obligations

        answer = (
            f"Your current account balance is \u20b9{balance:,.2f}. "
            f"Your upcoming obligations total \u20b9{total_obligations:,.2f} "
            f"(EMIs, credit card dues, and bills). "
            f"After paying all upcoming bills, you will have approximately \u20b9{available:,.2f} available."
        )
        return {
            'answer': answer,
            'answer_type': 'calculated',
            'agents_invoked': agents_invoked,
            'tools_invoked': list(set(all_tools)),
            'requires_confirmation': False,
            'confirmation_token': None,
            'data': all_data
        }

    # Single agent or simple multi-agent: combine answers
    if len(agent_results) == 1:
        r = agent_results[0]
        return {
            'answer': r['answer'],
            'answer_type': r.get('answer_type', 'lookup'),
            'agents_invoked': agents_invoked,
            'tools_invoked': all_tools,
            'requires_confirmation': False,
            'confirmation_token': None,
            'data': r.get('data')
        }

    # Multiple agents, non-showcase: concatenate answers
    combined = ' '.join(r['answer'] for r in agent_results if r.get('answer'))
    return {
        'answer': combined,
        'answer_type': 'lookup',
        'agents_invoked': agents_invoked,
        'tools_invoked': list(set(all_tools)),
        'requires_confirmation': False,
        'confirmation_token': None,
        'data': all_data
    }
