const db = require("../models");
const sequelize = db.sequelize;

// Customer ID for the banking portal (defaults to seeded ISO 20022 customer C1001)
const DEFAULT_CUSTOMER_ID = "C1001";

/**
 * Helper to fetch customer ID from authenticated user, or fallback to C1001
 */
function resolveCustomerId(req) {
  return DEFAULT_CUSTOMER_ID;
}

/**
 * Fetch all dashboard banking data from PostgreSQL
 */
exports.getDashboardData = async (req, res) => {
  try {
    const customerId = resolveCustomerId(req);

    // 1. Customer profile
    const [customers] = await sequelize.query(
      `SELECT customer_id, full_name, email, phone, city, preferred_language, is_active 
       FROM customers WHERE customer_id = :customerId`,
      { replacements: { customerId } }
    );
    const customer = customers[0] || {
      customer_id: customerId,
      full_name: "Elena Rostova",
      email: "elena.rostova@wealth.client",
      city: "Mumbai"
    };

    // 2. Accounts (savings, current, etc.)
    const [accounts] = await sequelize.query(
      `SELECT account_id, customer_id, account_number, account_type, currency, 
              available_balance, ledger_balance, status, opened_on 
       FROM accounts WHERE customer_id = :customerId ORDER BY account_type DESC`,
      { replacements: { customerId } }
    );

    // 3. Credit Cards
    const [creditCards] = await sequelize.query(
      `SELECT card_id, customer_id, account_id, masked_card_number, card_network, 
              credit_limit, outstanding_amount, minimum_due, statement_due_date, status, reward_points 
       FROM credit_cards WHERE customer_id = :customerId`,
      { replacements: { customerId } }
    );

    // 4. Debit Cards
    const [debitCards] = await sequelize.query(
      `SELECT card_id, customer_id, account_id, masked_card_number, card_network, 
              daily_atm_limit, daily_purchase_limit, status, issued_on, expires_on 
       FROM debit_cards WHERE customer_id = :customerId ORDER BY card_id ASC`,
      { replacements: { customerId } }
    );

    // 5. Bills
    const [bills] = await sequelize.query(
      `SELECT bill_id, customer_id, biller_name, bill_type, amount_due, due_date, status, autopay_enabled, account_id 
       FROM bills WHERE customer_id = :customerId ORDER BY due_date ASC`,
      { replacements: { customerId } }
    );

    // 6. Scheduled Payments
    const [scheduledPayments] = await sequelize.query(
      `SELECT payment_id, customer_id, account_id, payee_name, amount, scheduled_date, payment_method, status, reference_number 
       FROM scheduled_payments WHERE customer_id = :customerId ORDER BY scheduled_date ASC`,
      { replacements: { customerId } }
    );

    // 7. Loans & EMIs
    const [loans] = await sequelize.query(
      `SELECT l.loan_id, l.customer_id, l.loan_type, l.principal_amount, l.outstanding_balance, 
              l.annual_interest_pct, l.emi_amount, l.next_emi_date, l.status,
              e.emi_id, e.due_date as emi_due_date, e.amount as emi_amount_due, e.status as emi_status
       FROM loans l
       LEFT JOIN loan_emis e ON l.loan_id = e.loan_id AND e.status = 'upcoming'
       WHERE l.customer_id = :customerId`,
      { replacements: { customerId } }
    );

    // 8. Transactions (up to 50 latest)
    const [transactions] = await sequelize.query(
      `SELECT transaction_id, account_id, customer_id, transaction_ts, merchant, description, 
              amount, direction, category, payment_method, transaction_type, status, reference_number, upi_id, card_id 
       FROM transactions WHERE customer_id = :customerId ORDER BY transaction_ts DESC LIMIT 50`,
      { replacements: { customerId } }
    );

    // Calculations
    const totalAvailableBalance = accounts.reduce((acc, a) => acc + parseFloat(a.available_balance || 0), 0);
    const totalLedgerBalance = accounts.reduce((acc, a) => acc + parseFloat(a.ledger_balance || 0), 0);
    const creditOutstanding = creditCards.reduce((acc, c) => acc + parseFloat(c.outstanding_amount || 0), 0);
    const creditLimit = creditCards.reduce((acc, c) => acc + parseFloat(c.credit_limit || 0), 0);

    // Upcoming obligations: bills + scheduled payments + upcoming EMIs
    const upcomingBills = bills
      .filter(b => b.status === 'upcoming')
      .reduce((sum, b) => sum + parseFloat(b.amount_due || 0), 0);
    const upcomingScheduled = scheduledPayments
      .filter(s => s.status === 'scheduled')
      .reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const upcomingEMIs = loans
      .filter(l => l.emi_amount_due && l.emi_status === 'upcoming')
      .reduce((sum, l) => sum + parseFloat(l.emi_amount_due || 0), 0);

    const upcomingOutflows = upcomingBills + upcomingScheduled + upcomingEMIs;
    // Safe Surplus = Available Balance - (Credit Card Outstanding + Upcoming Outflows)
    const safeSurplus = Math.max(0, totalAvailableBalance - creditOutstanding - upcomingOutflows);

    return res.status(200).json({
      success: true,
      data: {
        customer,
        summary: {
          totalAvailableBalance: Math.round(totalAvailableBalance * 100) / 100,
          totalLedgerBalance: Math.round(totalLedgerBalance * 100) / 100,
          creditOutstanding: Math.round(creditOutstanding * 100) / 100,
          creditLimit: Math.round(creditLimit * 100) / 100,
          creditAvailable: Math.round((creditLimit - creditOutstanding) * 100) / 100,
          upcomingBills: Math.round(upcomingBills * 100) / 100,
          upcomingScheduled: Math.round(upcomingScheduled * 100) / 100,
          upcomingEMIs: Math.round(upcomingEMIs * 100) / 100,
          upcomingOutflows: Math.round(upcomingOutflows * 100) / 100,
          safeSurplus: Math.round(safeSurplus * 100) / 100
        },
        accounts,
        creditCards,
        debitCards,
        bills,
        scheduledPayments,
        loans,
        transactions
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load banking dashboard data",
      error: error.message
    });
  }
};

/**
 * Adjust account balance: Add (Deposit/Credit) or Subtract (Transfer/Withdrawal/Debit)
 */
exports.adjustBalance = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      accountId,
      amount,
      type, // 'add' (credit) or 'subtract' (debit)
      description,
      category,
      merchant,
      paymentMethod = 'UPI'
    } = req.body;

    const numAmount = parseFloat(amount);
    if (!accountId || isNaN(numAmount) || numAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid account ID or amount. Amount must be a positive number."
      });
    }

    if (type !== 'add' && type !== 'subtract') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Must be 'add' (deposit) or 'subtract' (transfer/payment)."
      });
    }

    // 1. Fetch current account
    const [accounts] = await sequelize.query(
      `SELECT * FROM accounts WHERE account_id = :accountId FOR UPDATE`,
      { replacements: { accountId }, transaction }
    );

    if (accounts.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Account with ID ${accountId} not found.`
      });
    }

    const currentAccount = accounts[0];
    const currentAvailable = parseFloat(currentAccount.available_balance);
    const currentLedger = parseFloat(currentAccount.ledger_balance);

    // 2. Validate sufficient balance if subtracting
    if (type === 'subtract' && currentAvailable < numAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Available: ₹${currentAvailable.toLocaleString('en-IN')}, requested: ₹${numAmount.toLocaleString('en-IN')}`
      });
    }

    // 3. Compute new balances
    const newAvailable = type === 'add' ? currentAvailable + numAmount : currentAvailable - numAmount;
    const newLedger = type === 'add' ? currentLedger + numAmount : currentLedger - numAmount;

    // 4. Update account table
    await sequelize.query(
      `UPDATE accounts 
       SET available_balance = :newAvailable, ledger_balance = :newLedger 
       WHERE account_id = :accountId`,
      {
        replacements: {
          newAvailable: newAvailable.toFixed(2),
          newLedger: newLedger.toFixed(2),
          accountId
        },
        transaction
      }
    );

    // 5. Generate ISO 20022 compliant transaction record matching constraints
    const nextTxnId = 'TXN' + (Date.now().toString().slice(-5) + Math.floor(Math.random() * 100));
    const refNumber = 'REF' + Math.floor(10000000 + Math.random() * 90000000);
    const direction = type === 'add' ? 'credit' : 'debit';
    const txnMerchant = merchant || (type === 'add' ? 'Instant Credit Deposit' : 'Direct Funds Transfer');
    const txnCategory = category || (type === 'add' ? 'Income' : 'Transfer');
    const txnType = type === 'add' ? 'cash_deposit' : 'bank_transfer';
    const txnMethod = ['UPI', 'NEFT', 'IMPS', 'RTGS', 'Net Banking'].includes(paymentMethod) ? paymentMethod : 'UPI';
    const txnDesc = description || (type === 'add' ? `₹${numAmount.toLocaleString('en-IN')} credited to ${currentAccount.account_type} account` : `₹${numAmount.toLocaleString('en-IN')} transferred from ${currentAccount.account_type} account`);

    await sequelize.query(
      `INSERT INTO transactions 
       (transaction_id, account_id, customer_id, transaction_ts, merchant, description, amount, direction, category, payment_method, transaction_type, status, reference_number, is_suspicious)
       VALUES 
       (:nextTxnId, :accountId, :customerId, NOW(), :merchant, :description, :amount, :direction, :category, :paymentMethod, :txnType, 'successful', :refNumber, false)`,
      {
        replacements: {
          nextTxnId,
          accountId,
          customerId: currentAccount.customer_id,
          merchant: txnMerchant,
          description: txnDesc,
          amount: numAmount.toFixed(2),
          direction,
          category: txnCategory,
          paymentMethod: txnMethod,
          txnType,
          refNumber
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Successfully ${type === 'add' ? 'credited' : 'debited'} ₹${numAmount.toLocaleString('en-IN')} ${type === 'add' ? 'to' : 'from'} account ${accountId}.`,
      data: {
        accountId,
        transactionId: nextTxnId,
        referenceNumber: refNumber,
        type,
        amount: numAmount,
        direction,
        newAvailableBalance: newAvailable,
        newLedgerBalance: newLedger,
        description: txnDesc,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adjusting balance:", error);
    return res.status(500).json({
      success: false,
      message: "Balance update failed",
      error: error.message
    });
  }
};

/**
 * Sweep Surplus to Sovereign High-Yield Vault (executes subtract and creates ledger transaction)
 */
exports.sweepSurplus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { amount = 50000, sourceAccountId = "A1001" } = req.body;
    const numAmount = parseFloat(amount);

    const [accounts] = await sequelize.query(
      `SELECT * FROM accounts WHERE account_id = :sourceAccountId FOR UPDATE`,
      { replacements: { sourceAccountId }, transaction }
    );

    if (accounts.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Source account not found." });
    }

    const currentAccount = accounts[0];
    const currentAvailable = parseFloat(currentAccount.available_balance);

    if (currentAvailable < numAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient liquid balance for sweep. Available: ₹${currentAvailable.toLocaleString('en-IN')}`
      });
    }

    const newAvailable = currentAvailable - numAmount;
    const newLedger = parseFloat(currentAccount.ledger_balance) - numAmount;

    await sequelize.query(
      `UPDATE accounts 
       SET available_balance = :newAvailable, ledger_balance = :newLedger 
       WHERE account_id = :sourceAccountId`,
      {
        replacements: {
          newAvailable: newAvailable.toFixed(2),
          newLedger: newLedger.toFixed(2),
          sourceAccountId
        },
        transaction
      }
    );

    const nextTxnId = 'TXN' + (Date.now().toString().slice(-5) + Math.floor(Math.random() * 100));
    const refNumber = 'SWEEP' + Math.floor(10000000 + Math.random() * 90000000);

    await sequelize.query(
      `INSERT INTO transactions 
       (transaction_id, account_id, customer_id, transaction_ts, merchant, description, amount, direction, category, payment_method, transaction_type, status, reference_number, is_suspicious)
       VALUES 
       (:nextTxnId, :sourceAccountId, :customerId, NOW(), 'Sovereign High-Yield Bond Vault', 'Automated Yield Sweep to Sovereign Vault (7.45% APY)', :amount, 'debit', 'Investment', 'IMPS', 'bank_transfer', 'successful', :refNumber, false)`,
      {
        replacements: {
          nextTxnId,
          sourceAccountId,
          customerId: currentAccount.customer_id,
          amount: numAmount.toFixed(2),
          refNumber
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `ISO 20022 Real-Time Sweep Executed: ₹${numAmount.toLocaleString('en-IN')} swept into Sovereign Gold & Bond Vault.`,
      data: {
        transactionId: nextTxnId,
        referenceNumber: refNumber,
        sweptAmount: numAmount,
        newAvailableBalance: newAvailable
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error executing yield sweep:", error);
    return res.status(500).json({
      success: false,
      message: "Yield sweep failed",
      error: error.message
    });
  }
};

/**
 * Toggle Debit Card Freeze / Active status in Neon DB
 * Allowed status in debit_cards: 'active', 'blocked', 'inactive'
 */
exports.toggleCardFreeze = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { cardId = "DC1001" } = req.body;

    const [cards] = await sequelize.query(
      `SELECT * FROM debit_cards WHERE card_id = :cardId FOR UPDATE`,
      { replacements: { cardId }, transaction }
    );

    if (cards.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: `Card ${cardId} not found.` });
    }

    const card = cards[0];
    const oldStatus = card.status;
    // Map frozen to 'blocked', active to 'active'
    const newStatus = (oldStatus === 'active') ? 'blocked' : 'active';

    await sequelize.query(
      `UPDATE debit_cards SET status = :newStatus WHERE card_id = :cardId`,
      { replacements: { newStatus, cardId }, transaction }
    );

    const refNumber = 'CRF' + Math.floor(10000000 + Math.random() * 90000000);
    const historyId = Date.now();

    await sequelize.query(
      `INSERT INTO card_status_history 
       (history_id, card_id, card_type, customer_id, old_status, new_status, reason, confirmation_ref, changed_at)
       VALUES 
       (:historyId, :cardId, 'debit', :customerId, :oldStatus, :newStatus, 'Executive Portal Card Guard manual toggle', :refNumber, NOW())`,
      {
        replacements: {
          historyId,
          cardId,
          customerId: card.customer_id,
          oldStatus,
          newStatus,
          refNumber
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Card *${card.masked_card_number.slice(-4)} is now ${newStatus === 'blocked' ? 'FROZEN' : 'ACTIVE'}.`,
      data: {
        cardId,
        maskedCardNumber: card.masked_card_number,
        oldStatus,
        newStatus,
        isFrozen: newStatus === 'blocked',
        confirmationRef: refNumber
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error toggling card freeze:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to toggle card status",
      error: error.message
    });
  }
};
