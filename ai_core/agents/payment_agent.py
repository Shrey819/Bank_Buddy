import json
import re
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from .base_agent import get_llm, AgentResult, check_grounding
from tools.payment_tools import get_upi_status, GetUpiStatusInput

SYSTEM_PROMPT = """You are the Payments Agent for Bank Buddy. You ONLY handle UPI and payment status lookups.

You have exactly 1 tool available:
1. get_upi_status - returns the current status and details of a UPI transaction

Rules:
- NEVER compute or guess a number yourself. Always call a tool.
- customer_id is always provided to you - never ask for it.
- Respond with a JSON object: {"tool": "get_upi_status", "args": {"transaction_id": "..."}} to call a tool.
- Respond with {"done": true, "answer": "..."} when you have all the data.
- If the user's question does not involve a specific UPI transaction ID, ask them to provide it.
"""


class PaymentAgentState(TypedDict):
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


def reason_node(state: PaymentAgentState) -> PaymentAgentState:
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


def act_node(state: PaymentAgentState) -> PaymentAgentState:
    decision = state.get('_llm_decision', '')
    try:
        parsed = json.loads(decision)
    except Exception:
        match = re.search(r'\{.*\}', decision, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

    if parsed.get('done'):
        state['draft_answer'] = parsed.get('answer', '')
        state['_action_done'] = True
        return state

    tool_name = parsed.get('tool', '')
    db = state['db']
    customer_id = state['customer_id']

    if tool_name == 'get_upi_status':
        transaction_id = parsed.get('args', {}).get('transaction_id', '')
        result = get_upi_status(
            GetUpiStatusInput(customer_id=customer_id, transaction_id=transaction_id), db
        )
        state['tool_outputs']['get_upi_status'] = result.model_dump()
        state['tools_invoked'].append('get_upi_status')

    state['_action_done'] = False
    return state


def observe_node(state: PaymentAgentState) -> PaymentAgentState:
    # Fold tool results back for next reason step
    return state


def grounding_check_node(state: PaymentAgentState) -> PaymentAgentState:
    if state.get('_action_done') or state.get('draft_answer'):
        is_grounded = check_grounding(state['draft_answer'], state['tool_outputs'])
        state['grounded'] = is_grounded
        state['regen_count'] = state.get('regen_count', 0) + 1
    return state


def should_continue(state: PaymentAgentState) -> str:
    if state.get('_action_done') or state.get('draft_answer'):
        if state.get('grounded', False) or state.get('regen_count', 0) >= 2:
            return 'done'
        return 'regen'
    return 'act'


def build_payment_agent():
    graph = StateGraph(PaymentAgentState)
    graph.add_node('reason', reason_node)
    graph.add_node('act', act_node)
    graph.add_node('observe', observe_node)
    graph.add_node('grounding_check', grounding_check_node)
    graph.set_entry_point('reason')
    graph.add_edge('reason', 'act')
    graph.add_edge('act', 'observe')
    graph.add_edge('observe', 'grounding_check')
    graph.add_conditional_edges('grounding_check', should_continue, {
        'act': 'reason',
        'regen': 'reason',
        'done': END
    })
    return graph.compile()


def run_payment_agent(question: str, customer_id: str, db) -> AgentResult:
    agent = build_payment_agent()
    state = PaymentAgentState(
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
    )
    final_state = agent.invoke(state)
    return AgentResult(
        agent_name='payment_agent',
        answer=final_state.get('draft_answer', 'I could not retrieve payment information.'),
        answer_type='lookup',
        tools_invoked=final_state.get('tools_invoked', []),
        tool_outputs=final_state.get('tool_outputs', {}),
        requires_confirmation=False,
        confirmation_token=None,
        data=final_state.get('tool_outputs', {})
    )
