from agents.account_agent import run_account_agent
from agents.card_agent import run_card_agent
from agents.fraud_agent import run_fraud_agent
from agents.loan_agent import run_loan_agent
from agents.payment_agent import run_payment_agent

AGENT_REGISTRY = {
    "account_agent": run_account_agent,
    "card_agent": run_card_agent,
    "fraud_agent": run_fraud_agent,
    "loan_agent": run_loan_agent,
    "payment_agent": run_payment_agent,
}
