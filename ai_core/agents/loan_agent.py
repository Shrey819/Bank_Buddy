import json
import re
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from .base_agent import get_llm, AgentResult, check_grounding
from tools.loan_tools import (
    get_loan_details,
    GetLoanDetailsInput,
    get_upcoming_payments,
    GetUpcomingPaymentsInput,
)

SYSTEM_PROMPT = """You are the Loans Agent for Bank Buddy. You ONLY handle EMI, loan, and upcoming payment queries.

You have exactly 2 tools available:
1. get_loan_details      - returns full details for a loan (outstanding, interest rate, tenure, etc.)
2. get_upcoming_payments - returns the schedule of upcoming EMI payments

Rules:
- NEVER compute or guess a number yourself. Always call a tool.
- customer_id is always provided to you - never ask for it.
- Respond with a JSON object: {"tool": "tool_name", "args": {...}} to call a tool.
- Respond with {"done": true, "answer": "..."} when you have all the data.
- If a specific loan_id is needed and not mentioned, call get_loan_details first to discover it.
"""


class LoanAgentState(TypedDict):
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


def reason_node(state: LoanAgentState) -> LoanAgentState:
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


def act_node(state: LoanAgentState) -> LoanAgentState:
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
    args = parsed.get('args', {})
    db = state['db']
    customer_id = state['customer_id']

    if tool_name == 'get_loan_details':
        loan_id = args.get('loan_id', '')
        result = get_loan_details(
            GetLoanDetailsInput(customer_id=customer_id, loan_id=loan_id), db
        )
        state['tool_outputs']['get_loan_details'] = result.model_dump()
        state['tools_invoked'].append('get_loan_details')
    elif tool_name == 'get_upcoming_payments':
        loan_id = args.get('loan_id', '')
        months_ahead = args.get('months_ahead', 3)
        result = get_upcoming_payments(
            GetUpcomingPaymentsInput(
                customer_id=customer_id, loan_id=loan_id, months_ahead=months_ahead
            ),
            db,
        )
        state['tool_outputs']['get_upcoming_payments'] = result.model_dump()
        state['tools_invoked'].append('get_upcoming_payments')

    state['_action_done'] = False
    return state


def observe_node(state: LoanAgentState) -> LoanAgentState:
    # Fold tool results back for next reason step
    return state


def grounding_check_node(state: LoanAgentState) -> LoanAgentState:
    if state.get('_action_done') or state.get('draft_answer'):
        is_grounded = check_grounding(state['draft_answer'], state['tool_outputs'])
        state['grounded'] = is_grounded
        state['regen_count'] = state.get('regen_count', 0) + 1
    return state


def should_continue(state: LoanAgentState) -> str:
    if state.get('_action_done') or state.get('draft_answer'):
        if state.get('grounded', False) or state.get('regen_count', 0) >= 2:
            return 'done'
        return 'regen'
    return 'act'


def build_loan_agent():
    graph = StateGraph(LoanAgentState)
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


def run_loan_agent(question: str, customer_id: str, db) -> AgentResult:
    agent = build_loan_agent()
    state = LoanAgentState(
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
        agent_name='loan_agent',
        answer=final_state.get('draft_answer', 'I could not retrieve loan information.'),
        answer_type='lookup',
        tools_invoked=final_state.get('tools_invoked', []),
        tool_outputs=final_state.get('tool_outputs', {}),
        requires_confirmation=False,
        confirmation_token=None,
        data=final_state.get('tool_outputs', {})
    )
