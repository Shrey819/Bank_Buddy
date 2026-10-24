import json
from typing import TypedDict, Optional, Any
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from .base_agent import get_llm, AgentResult, check_grounding
from tools.account_tools import get_balance, GetBalanceInput, analyze_expenses, AnalyzeExpensesInput

SYSTEM_PROMPT = """You are the Account Agent for Bank Buddy. You ONLY handle:
- Account balance inquiries (use get_balance)
- Expense tracking and spending analysis (use analyze_expenses)

You have exactly 2 tools available:
1. get_balance - returns current account balance
2. analyze_expenses - returns categorized spending for a period

Rules:
- NEVER compute or guess a number yourself. Always call a tool.
- customer_id is always provided to you - never ask for it.
- Respond with a JSON object: {"tool": "tool_name", "args": {...}} to call a tool.
- Respond with {"done": true, "answer": "..."} when you have all the data.
"""


class AccountAgentState(TypedDict):
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


def reason_node(state: AccountAgentState) -> AccountAgentState:
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


def act_node(state: AccountAgentState) -> AccountAgentState:
    decision = state.get('_llm_decision', '')
    try:
        parsed = json.loads(decision)
    except Exception:
        import re
        match = re.search(r'\{.*\}', decision, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

    if parsed.get('done'):
        state['draft_answer'] = parsed.get('answer', '')
        state['_action_done'] = True
        return state

    tool_name = parsed.get('tool', '')
    db = state['db']
    customer_id = state['customer_id']

    if tool_name == 'get_balance':
        result = get_balance(GetBalanceInput(customer_id=customer_id), db)
        state['tool_outputs']['get_balance'] = result.model_dump()
        state['tools_invoked'].append('get_balance')
    elif tool_name == 'analyze_expenses':
        period = parsed.get('args', {}).get('period', 'current_month')
        result = analyze_expenses(AnalyzeExpensesInput(customer_id=customer_id, period=period), db)
        state['tool_outputs']['analyze_expenses'] = result.model_dump()
        state['tools_invoked'].append('analyze_expenses')

    state['_action_done'] = False
    return state


def observe_node(state: AccountAgentState) -> AccountAgentState:
    # Fold tool results back for next reason step
    return state


def grounding_check_node(state: AccountAgentState) -> AccountAgentState:
    if state.get('_action_done') or state.get('draft_answer'):
        is_grounded = check_grounding(state['draft_answer'], state['tool_outputs'])
        state['grounded'] = is_grounded
        state['regen_count'] = state.get('regen_count', 0) + 1
    return state


def should_continue(state: AccountAgentState) -> str:
    if state.get('_action_done') or state.get('draft_answer'):
        if state.get('grounded', False) or state.get('regen_count', 0) >= 2:
            return 'done'
        return 'regen'
    return 'act'


def build_account_agent():
    graph = StateGraph(AccountAgentState)
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


def run_account_agent(question: str, customer_id: str, db) -> AgentResult:
    agent = build_account_agent()
    state = AccountAgentState(
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
        agent_name='account_agent',
        answer=final_state.get('draft_answer', 'I could not retrieve account information.'),
        answer_type='calculated' if 'get_balance' in final_state.get('tools_invoked', []) else 'lookup',
        tools_invoked=final_state.get('tools_invoked', []),
        tool_outputs=final_state.get('tool_outputs', {}),
        requires_confirmation=False,
        confirmation_token=None,
        data=final_state.get('tool_outputs', {})
    )
