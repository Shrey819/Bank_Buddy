import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime
import uuid
from dotenv import load_dotenv

load_dotenv()

from auth.jwt_verify import verify_jwt as verify_jwt_import

app = FastAPI(title='Bank Buddy AI Core', version='1.0.0')

# CORS — allow Node gateway and local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# --- Request/Response Schemas ---
class ChatRequest(BaseModel):
    message: str
    session_id: str
    conversation_history: list[dict] = []

class ChatResponse(BaseModel):
    trace_id: str
    answer: str
    answer_type: Literal['calculated', 'lookup', 'action', 'error', 'confirmation_required']
    agents_invoked: list[str] = []
    tools_invoked: list[str] = []
    requires_confirmation: bool = False
    confirmation_token: Optional[str] = None
    data: Optional[dict] = None  # structured data for UI

class ConfirmRequest(BaseModel):
    confirmation_token: str
    decision: Literal['yes', 'no']
    session_id: str

# --- In-memory store for pending confirmations (demo-only) ---
pending_confirmations: dict[str, dict] = {}

# --- Health ---
@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'bank-buddy-ai-core', 'timestamp': datetime.utcnow().isoformat()}

# --- Tool Registry Debug ---
@app.get('/tools')
async def list_tools():
    from tools import TOOL_REGISTRY
    return {
        name: {'owner': v['owner'], 'is_high_risk': v['is_high_risk']}
        for name, v in TOOL_REGISTRY.items()
    }

# --- Main Chat Endpoint ---
@app.post('/chat', response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    token_data: dict = Depends(verify_jwt_import)
):
    from graph.banking_graph import run_banking_graph
    from db.connection import SessionLocal

    trace_id = f'BANK-{str(uuid.uuid4())[:8].upper()}'
    customer_id = token_data.get('customer_id')
    user_id = token_data.get('user_id')

    # If customer_id not in token yet, use user_id or default to C1001 for demo
    if not customer_id:
        customer_id = 'C1001'

    db = SessionLocal()
    try:
        result = run_banking_graph(
            message=req.message,
            customer_id=customer_id,
            session_id=req.session_id,
            conversation_history=req.conversation_history,
            trace_id=trace_id,
            db=db,
            pending_confirmations=pending_confirmations
        )
        return ChatResponse(
            trace_id=trace_id,
            answer=result['answer'],
            answer_type=result.get('answer_type', 'lookup'),
            agents_invoked=result.get('agents_invoked', []),
            tools_invoked=result.get('tools_invoked', []),
            requires_confirmation=result.get('requires_confirmation', False),
            confirmation_token=result.get('confirmation_token'),
            data=result.get('data')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()

# --- Confirm Endpoint ---
@app.post('/chat/confirm', response_model=ChatResponse)
async def confirm_action(
    req: ConfirmRequest,
    token_data: dict = Depends(verify_jwt_import)
):
    from graph.banking_graph import resume_banking_graph
    from db.connection import SessionLocal

    trace_id = f'BANK-{str(uuid.uuid4())[:8].upper()}'
    pending = pending_confirmations.get(req.confirmation_token)

    if not pending:
        raise HTTPException(status_code=404, detail='Confirmation token not found or expired')

    db = SessionLocal()
    try:
        result = resume_banking_graph(
            confirmation_token=req.confirmation_token,
            decision=req.decision,
            pending=pending,
            trace_id=trace_id,
            db=db
        )
        # Clean up after resolution
        if req.confirmation_token in pending_confirmations:
            del pending_confirmations[req.confirmation_token]

        return ChatResponse(
            trace_id=trace_id,
            answer=result['answer'],
            answer_type=result.get('answer_type', 'action'),
            agents_invoked=result.get('agents_invoked', []),
            tools_invoked=result.get('tools_invoked', []),
            requires_confirmation=False,
            data=result.get('data')
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()
