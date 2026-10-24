import json
import re
from typing import TypedDict, Any, Optional
from uuid import uuid4
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from .base_agent import get_llm, AgentResult, check_grounding
from tools.card_tools import (
    get_credit_card_details,
    GetCreditCardDetailsInput,
    block_card,
    BlockCardInput,
)

SYSTEM_PROMPT = """You are the Credit Card Agent for Bank Buddy. You ONLY handle credit card inquiries and card blocking.

You have exactly 2 tools available:
1. get_credit_card_details - (READ-ONLY) returns card info, limit, outstanding, due date
2. block_card              - (HIGH RISK) permanently blocks the customer's credit card

Rules:
- NEVER compute or guess a number yourself. Always call a tool.
- customer_id is always provided to you - never ask for it.
- Always call get_credit_card_details FIRST to confirm card identity before suggesting block_card.
- block_card requires explicit user confirmation. NEVER execute it without confirmation intent.
- Respond with a JSON object: {"tool": "tool_name", "args": {...}} to call a tool.
- Respond with {"done": true, "answer": "..."} when you have all the data.
- Respond with {"confirm_required": true, "tool": "block_card", "args": {...}, "answer": "..."} when user wants to block card.
"""


class CardAgentState(TypedDict):
    customer_id: str
    question: str
    tool_outputs: dict[str, Any]
    tools_invoked: list[str]
    draft_answer: str
    grounded: bool
    regen_count: int
    db: Any
    _llm_decision: str
    _action_done: bool
    _confirm_required: bool
    _pending_tool: str
    _pending_args: dict[str, Any]
    _confirmation_token: Optional[str]


def reason_node(state: CardAgentState) -> CardAgentState:
    llm = get_llm()
    context = ""
    if state['tool_outputs']:
        context = f"\n\nTool results so far:\n{json.dumps(state['tool_outputs'], default=str)}"

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Customer question: {state['question']}{context}")
    ]
    response = llm.invoke(messages)
    state['_llm_decision'] = response.content
    return state


def act_node(state: CardAgentState) -> CardAgentState:
    decision = state.get('_llm_decision', '')
    try:
        parsed = json.loads(decision)
    except Exception:
        match = re.search(r'\{.*\}', decision, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

    # Confirmation interrupt: intercept block_card before execution
    if parsed.get('confirm_required') or parsed.get('tool') == 'block_card':
        token = str(uuid4())
        state['_confirm_required'] = True
        state['_pending_tool'] = 'block_card'
        state['_pending_args'] = parsed.get('args', {})
        state['_confirmation_token'] = token
        state['draft_answer'] = parsed.get(
            'answer',
            'Blocking your card is a high-risk action. Please confirm you want to proceed.'
        )
        state['_action_done'] = True
        return state

    if parsed.get('done'):
        state['draft_answer'] = parsed.get('answer', '')
        state['_action_done'] = True
        return state

    tool_name = parsed.get('tool', '')
    args = parsed.get('args', {})
    db = state['db']
    customer_id = state['customer_id']

    if tool_name == 'get_credit_card_details':
        card_id = args.get('card_id', '')
        result = get_credit_card_details(
            GetCreditCardDetailsInput(customer_id=customer_id, card_id=card_id), db
        )
        state['tool_outputs']['get_credit_card_details'] = result.model_dump()
        state['tools_invoked'].append('get_credit_card_details')

    state['_action_done'] = False
    return state


def confirm_interrupt_node(state: CardAgentState) -> CardAgentState:
    """Placeholder node — interrupt is raised inside act_node; this node is a named
    waypoint so the graph topology matches the spec (reason→act→confirm_interrupt or observe)."""
    return state


def observe_node(state: CardAgentState) -> CardAgentState:
    # Fold tool results back for next reason step
    return state


def grounding_check_node(state: CardAgentState) -> CardAgentState:
    if state.get('_action_done') or state.get('draft_answer'):
        is_grounded = check_grounding(state['draft_answer'], state['tool_outputs'])
        state['grounded'] = is_grounded
        state['regen_count'] = state.get('regen_count', 0) + 1
    return state


def route_after_act(state: CardAgentState) -> str:
    """Route to confirm_interrupt when a high-risk tool is pending, else observe."""
    if state.get('_confirm_required'):
        return 'confirm_interrupt'
    return 'observe'


def should_continue(state: CardAgentState) -> str:
    if state.get('_confirm_required') or state.get('_action_done') or state.get('draft_answer'):
        if state.get('grounded', False) or state.get('regen_count', 0) >= 2:
            return 'done'
        return 'regen'
    return 'act'


def build_card_agent():
    graph = StateGraph(CardAgentState)
    graph.add_node('reason', reason_node)
    graph.add_node('act', act_node)
    graph.add_node('confirm_interrupt', confirm_interrupt_node)
    graph.add_node('observe', observe_node)
    graph.add_node('grounding_check', grounding_check_node)
    graph.set_entry_point('reason')
    graph.add_edge('reason', 'act')
    graph.add_conditional_edges('act', route_after_act, {
        'confirm_interrupt': 'confirm_interrupt',
        'observe': 'observe',
    })
    graph.add_edge('confirm_interrupt', 'grounding_check')
    graph.add_edge('observe', 'grounding_check')
    graph.add_conditional_edges('grounding_check', should_continue, {
        'act': 'reason',
        'regen': 'reason',
        'done': END
    })
    return graph.compile()


def run_card_agent(
    question: str,
    customer_id: str,
    db,
    pending_confirmations: dict,
) -> AgentResult:
    agent = build_card_agent()
    state = CardAgentState(
        customer_id=customer_id,
        question=question,
        tool_outputs={},
        tools_invoked=[],
        draft_answer='',
        grounded=False,
        regen_count=0,
        db=db,
        _llm_decision='',
        _action_done=False,
        _confirm_required=False,
        _pending_tool='',
        _pending_args={},
        _confirmation_token=None,
    )
    final_state = agent.invoke(state)

    requires_confirmation = final_state.get('_confirm_required', False)
    token = final_state.get('_confirmation_token')

    # Register pending high-risk action so the Supervisor can execute it after user confirms
    if requires_confirmation and token:
        pending_confirmations[token] = {
            'tool': final_state.get('_pending_tool', 'block_card'),
            'args': final_state.get('_pending_args', {}),
            'customer_id': customer_id,
        }

    return AgentResult(
        agent_name='card_agent',
        answer=final_state.get('draft_answer', 'I could not retrieve card information.'),
        answer_type='confirmation_required' if requires_confirmation else 'lookup',
        tools_invoked=final_state.get('tools_invoked', []),
        tool_outputs=final_state.get('tool_outputs', {}),
        requires_confirmation=requires_confirmation,
        confirmation_token=token,
        data=final_state.get('tool_outputs', {})
    )
