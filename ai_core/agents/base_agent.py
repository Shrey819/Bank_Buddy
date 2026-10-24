import os
from typing import TypedDict, Optional, Any
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

def get_llm() -> ChatOpenAI:
    """Returns configured OpenRouter LLM client."""
    return ChatOpenAI(
        base_url=os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
        api_key=os.getenv('OPENROUTER_API_KEY', 'placeholder'),
        model=os.getenv('OPENROUTER_MODEL', 'openrouter/free'),
        temperature=0.1,
    )

class AgentResult(TypedDict):
    agent_name: str
    answer: str
    answer_type: str  # 'calculated' | 'lookup' | 'action' | 'error' | 'confirmation_required'
    tools_invoked: list[str]
    tool_outputs: dict[str, Any]  # raw tool outputs for grounding check
    requires_confirmation: bool
    confirmation_token: Optional[str]
    data: Optional[dict]  # structured data for UI

def check_grounding(answer: str, tool_outputs: dict) -> bool:
    """Check that key numbers in the answer appear in tool outputs.
    
    Converts tool outputs to a flat set of numeric strings and checks
    that any number mentioned in the answer traces back to a tool result.
    Returns True if grounded, False if any number cannot be traced.
    """
    import re
    import json
    
    # Extract numbers from answer (amounts, dates, counts)
    answer_numbers = set(re.findall(r'\b\d+[,\d]*\.?\d*\b', answer.replace(',', '')))
    
    if not answer_numbers:
        return True  # No numbers to check
    
    # Flatten all tool outputs to a big string for checking
    tool_str = json.dumps(tool_outputs, default=str)
    tool_str_normalized = tool_str.replace(',', '')
    
    # Every number in the answer must appear somewhere in tool outputs
    for num in answer_numbers:
        if len(num) < 2:  # skip single digits
            continue
        if num not in tool_str_normalized:
            return False
    return True
