from .account_agent import run_account_agent
from .payment_agent import run_payment_agent
from .loan_agent import run_loan_agent
from .card_agent import run_card_agent
from .fraud_agent import run_fraud_agent

AGENT_REGISTRY = {
    'account_agent': run_account_agent,
    'payment_agent': run_payment_agent,
    'loan_agent': run_loan_agent,
    'card_agent': run_card_agent,
    'fraud_agent': run_fraud_agent,
}
