const db = require("../models");
const sequelize = db.sequelize;
const jwt = require("jsonwebtoken");
const configJwt = require("../config/config-jwt.js");

/**
 * Resolve customer ID strictly from authenticated JWT token:
 * Strictly looks up users table directly for the authenticated user's assigned customer_id.
 * NEVER falls back to another user or client!
 */
async function resolveCustomerId(req) {
  const authHeader = req.headers["authorization"] || req.headers["x-access-token"];
  if (authHeader) {
    try {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, configJwt.secret);
      if (decoded && decoded.id) {
        const [userRows] = await sequelize.query(
          `SELECT id, name, username, email, phone, customer_id FROM users WHERE id = :id`,
          { replacements: { id: decoded.id } }
        );
        if (userRows.length > 0) {
          const user = userRows[0];
          if (user.customer_id) {
            return user.customer_id;
          }
          // If customer_id not yet set, generate an isolated C2000 series ID
          const newCid = 'C' + (2000 + user.id);
          await sequelize.query(
            `UPDATE users SET customer_id = :cid WHERE id = :id`,
            { replacements: { cid: newCid, id: user.id } }
          );
          await sequelize.query(
            `INSERT INTO customers (customer_id, full_name, email, phone, city, preferred_language, is_active)
             VALUES (:cid, :name, :email, :phone, 'Mumbai', 'English', true)
             ON CONFLICT (customer_id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email`,
            {
              replacements: {
                cid: newCid,
                name: user.name || user.username || ('Client ' + user.id),
                email: user.email || (user.id + '@client.bank'),
                phone: user.phone || '+91 9876543210'
              }
            }
          );
          return newCid;
        }
      }
    } catch (e) {
      console.warn("Auth token resolve note:", e.message);
    }
  }

  // Do NOT fall back to any other client. Return null if unauthenticated.
  return null;
}

/**
 * Fetch all dashboard banking data from PostgreSQL tables for active authenticated customer.
 * If user has no records, all metrics strictly return 0 and empty collections.
 */
exports.getDashboardData = async (req, res) => {
  try {
    const customerId = await resolveCustomerId(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please sign in to view your dashboard data."
      });
    }

    // 1. Customer profile strictly from customers table
    let [customers] = await sequelize.query(
      `SELECT customer_id, full_name, email, phone, city, preferred_language, is_active 
       FROM customers WHERE customer_id = :customerId`,
      { replacements: { customerId } }
    );

    if (customers.length === 0) {
      const [uRows] = await sequelize.query(
        `SELECT name, username, email, phone FROM users WHERE customer_id = :customerId`,
        { replacements: { customerId } }
      );
      const u = uRows[0] || {};
      customers = [{
        customer_id: customerId,
        full_name: u.name || u.username || 'Client',
        email: u.email || 'client@bank.com',
        phone: u.phone || '+91 9876543210',
        city: 'Mumbai',
        preferred_language: 'English',
        is_active: true
      }];
    }

    const customer = customers[0];

    // 2. Accounts directly from accounts table strictly for this customer
    const [accounts] = await sequelize.query(
      `SELECT account_id, customer_id, account_number, account_type, currency, 
              available_balance, ledger_balance, status, opened_on 
       FROM accounts WHERE customer_id = :customerId ORDER BY account_type DESC`,
      { replacements: { customerId } }
    );

    // 3. Credit Cards directly from credit_cards table strictly for this customer
    const [creditCards] = await sequelize.query(
      `SELECT card_id, customer_id, account_id, masked_card_number, card_network, 
              credit_limit, outstanding_amount, minimum_due, statement_due_date, status, reward_points 
       FROM credit_cards WHERE customer_id = :customerId`,
      { replacements: { customerId } }
    );

    // 4. Debit Cards directly from debit_cards table strictly for this customer
    const [debitCards] = await sequelize.query(
      `SELECT card_id, customer_id, account_id, masked_card_number, card_network, 
              daily_atm_limit, daily_purchase_limit, status, issued_on, expires_on 
       FROM debit_cards WHERE customer_id = :customerId ORDER BY card_id ASC`,
      { replacements: { customerId } }
    );

    // 5. Bills directly from bills table strictly for this customer
    const [bills] = await sequelize.query(
      `SELECT bill_id, customer_id, biller_name, bill_type, amount_due, due_date, status, autopay_enabled, account_id 
       FROM bills WHERE customer_id = :customerId ORDER BY due_date ASC`,
      { replacements: { customerId } }
    );

    // 6. Scheduled Payments directly from scheduled_payments table strictly for this customer
    const [scheduledPayments] = await sequelize.query(
      `SELECT payment_id, customer_id, account_id, payee_name, amount, scheduled_date, payment_method, status, reference_number 
       FROM scheduled_payments WHERE customer_id = :customerId ORDER BY scheduled_date ASC`,
      { replacements: { customerId } }
    );

    // 7. Loans & EMIs directly from loans table strictly for this customer
    const [loans] = await sequelize.query(
      `SELECT l.loan_id, l.customer_id, l.loan_type, l.principal_amount, l.outstanding_balance, 
              l.annual_interest_pct, l.emi_amount, l.next_emi_date, l.status
       FROM loans l WHERE l.customer_id = :customerId ORDER BY l.loan_id ASC`,
      { replacements: { customerId } }
    );

    // 8. Transactions directly from transactions table strictly for this customer
    const [transactions] = await sequelize.query(
      `SELECT transaction_id, account_id, customer_id, transaction_ts, merchant, description, 
              amount, direction, category, payment_method, transaction_type, status, 
              reference_number, upi_id, card_id
       FROM transactions 
       WHERE customer_id = :customerId 
       ORDER BY transaction_ts DESC LIMIT 50`,
      { replacements: { customerId } }
    );

    // Calculate Summary Metrics (all defaulting strictly to 0 if no records exist)
    const totalAvailableBalance = accounts.reduce((acc, a) => acc + parseFloat(a.available_balance || 0), 0);
    const totalLedgerBalance = accounts.reduce((acc, a) => acc + parseFloat(a.ledger_balance || 0), 0);
    const creditOutstanding = creditCards.reduce((acc, c) => acc + parseFloat(c.outstanding_amount || 0), 0);
    const creditLimit = creditCards.reduce((acc, c) => acc + parseFloat(c.credit_limit || 0), 0);
    const creditAvailable = Math.max(0, creditLimit - creditOutstanding);

    const upcomingBills = bills.reduce((acc, b) => acc + (b.status === 'unpaid' ? parseFloat(b.amount_due || 0) : 0), 0);
    const upcomingScheduled = scheduledPayments.reduce((acc, s) => acc + (s.status === 'scheduled' ? parseFloat(s.amount || 0) : 0), 0);
    const upcomingEMIs = loans.reduce((acc, l) => acc + (l.status === 'active' ? parseFloat(l.emi_amount || 0) : 0), 0);
    const upcomingOutflows = upcomingBills + upcomingScheduled + upcomingEMIs;
    const safeSurplus = Math.max(0, totalAvailableBalance - upcomingOutflows);

    return res.status(200).json({
      success: true,
      data: {
        customer,
        summary: {
          totalAvailableBalance,
          totalLedgerBalance,
          creditOutstanding,
          creditLimit,
          creditAvailable,
          upcomingBills,
          upcomingScheduled,
          upcomingEMIs,
          upcomingOutflows,
          safeSurplus
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
      message: "Internal server error fetching dashboard records",
      error: error.message
    });
  }
};

/**
 * Add / Deposit or Subtract / Transfer funds in Neon DB accounts table
 * Provisions a primary account automatically if customer has no account yet.
 */
exports.adjustBalance = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    const {
      accountId,
      amount,
      type, // 'add' (deposit) or 'subtract' (transfer/debit)
      description,
      category,
      merchant,
      paymentMethod = 'UPI'
    } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid amount. Amount must be greater than ₹0."
      });
    }

    if (type !== 'add' && type !== 'subtract') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Must be 'add' (deposit) or 'subtract' (transfer/payment)."
      });
    }

    // 1. Resolve target account strictly for this customer
    let targetAccount = null;
    if (accountId && accountId !== 'NEW_PRIMARY') {
      const [accs] = await sequelize.query(
        `SELECT * FROM accounts WHERE account_id = :accountId AND customer_id = :customerId FOR UPDATE`,
        { replacements: { accountId, customerId }, transaction }
      );
      if (accs.length > 0) targetAccount = accs[0];
    }

    if (!targetAccount) {
      // Find an account strictly for this customer
      const [accs] = await sequelize.query(
        `SELECT * FROM accounts WHERE customer_id = :customerId ORDER BY account_id ASC LIMIT 1 FOR UPDATE`,
        { replacements: { customerId }, transaction }
      );
      if (accs.length > 0) targetAccount = accs[0];
    }

    // If still no account and action is 'add', auto-create a primary savings account for this customer!
    if (!targetAccount && type === 'add') {
      const cleanNum = customerId.replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000);
      const newAccountId = 'A' + cleanNum + '01';
      const newAccNumber = 'XXXXXX' + cleanNum;
      await sequelize.query(
        `INSERT INTO accounts (account_id, customer_id, account_number, account_type, currency, available_balance, ledger_balance, status, opened_on)
         VALUES (:newAccountId, :customerId, :newAccNumber, 'savings', 'INR', '0.00', '0.00', 'active', CURRENT_DATE)`,
        { replacements: { newAccountId, customerId, newAccNumber }, transaction }
      );
      const [newAccRows] = await sequelize.query(
        `SELECT * FROM accounts WHERE account_id = :newAccountId FOR UPDATE`,
        { replacements: { newAccountId }, transaction }
      );
      targetAccount = newAccRows[0];
    }

    if (!targetAccount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: type === 'subtract'
          ? "No funded account found to transfer funds from. Current balance is ₹0.00."
          : "No bank account found for this user."
      });
    }

    const currentAvailable = parseFloat(targetAccount.available_balance || 0);
    const currentLedger = parseFloat(targetAccount.ledger_balance || 0);

    if (type === 'subtract' && currentAvailable < numAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${currentAvailable.toLocaleString('en-IN')}`
      });
    }

    const newAvailable = type === 'add' ? currentAvailable + numAmount : currentAvailable - numAmount;
    const newLedger = type === 'add' ? currentLedger + numAmount : currentLedger - numAmount;

    await sequelize.query(
      `UPDATE accounts 
       SET available_balance = :newAvailable, ledger_balance = :newLedger 
       WHERE account_id = :targetAccountId AND customer_id = :customerId`,
      {
        replacements: {
          newAvailable: newAvailable.toFixed(2),
          newLedger: newLedger.toFixed(2),
          targetAccountId: targetAccount.account_id,
          customerId
        },
        transaction
      }
    );

    const nextTxnId = 'TXN' + (Date.now().toString().slice(-6) + Math.floor(Math.random() * 100));
    const refNumber = 'REF' + Math.floor(10000000 + Math.random() * 90000000);
    const direction = type === 'add' ? 'credit' : 'debit';
    const txnMerchant = merchant || (type === 'add' ? 'Deposit via Executive Portal' : 'Transfer sent via Executive Portal');
    const txnDesc = description || (type === 'add' ? `Funds Added to ${targetAccount.account_id}` : `Transfer sent from ${targetAccount.account_id}`);

    await sequelize.query(
      `INSERT INTO transactions 
       (transaction_id, account_id, customer_id, transaction_ts, merchant, description, amount, direction, category, payment_method, transaction_type, status, reference_number, is_suspicious)
       VALUES 
       (:nextTxnId, :accountId, :customerId, NOW(), :merchant, :description, :amount, :direction, :category, :paymentMethod, 'bank_transfer', 'successful', :refNumber, false)`,
      {
        replacements: {
          nextTxnId,
          accountId: targetAccount.account_id,
          customerId,
          merchant: txnMerchant,
          description: txnDesc,
          amount: numAmount.toFixed(2),
          direction,
          category: category || 'Transfer',
          paymentMethod,
          refNumber
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `${type === 'add' ? 'Deposit' : 'Transfer'} of ₹${numAmount.toLocaleString('en-IN')} recorded in database ledger.`,
      data: {
        transactionId: nextTxnId,
        accountId: targetAccount.account_id,
        direction,
        amount: numAmount,
        newAvailableBalance: newAvailable,
        referenceNumber: refNumber
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error adjusting balance:", error);
    return res.status(500).json({
      success: false,
      message: "Database balance adjustment failed",
      error: error.message
    });
  }
};

/**
 * Sweep Safe Surplus into High-Yield Sovereign Vault strictly for authenticated customer
 */
exports.sweepSurplus = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    const { amount = 50000, sourceAccountId } = req.body;
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: "Invalid sweep amount." });
    }

    // Resolve account strictly for this customer
    let accountToUse = sourceAccountId;
    if (!accountToUse) {
      const [userAccs] = await sequelize.query(
        `SELECT account_id FROM accounts WHERE customer_id = :customerId AND available_balance > 0 ORDER BY available_balance DESC LIMIT 1`,
        { replacements: { customerId } }
      );
      if (userAccs.length > 0) {
        accountToUse = userAccs[0].account_id;
      }
    }

    if (!accountToUse) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No funded account found to sweep surplus from. Current balance is ₹0.00."
      });
    }

    const [accounts] = await sequelize.query(
      `SELECT * FROM accounts WHERE account_id = :sourceAccountId AND customer_id = :customerId FOR UPDATE`,
      { replacements: { sourceAccountId: accountToUse, customerId }, transaction }
    );

    if (accounts.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Source account not found in database." });
    }

    const currentAccount = accounts[0];
    const currentAvailable = parseFloat(currentAccount.available_balance || 0);

    if (currentAvailable < numAmount) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient liquid balance for sweep. Available: ₹${currentAvailable.toLocaleString('en-IN')}`
      });
    }

    const newAvailable = currentAvailable - numAmount;
    const newLedger = parseFloat(currentAccount.ledger_balance || 0) - numAmount;

    await sequelize.query(
      `UPDATE accounts 
       SET available_balance = :newAvailable, ledger_balance = :newLedger 
       WHERE account_id = :sourceAccountId AND customer_id = :customerId`,
      {
        replacements: {
          newAvailable: newAvailable.toFixed(2),
          newLedger: newLedger.toFixed(2),
          sourceAccountId: accountToUse,
          customerId
        },
        transaction
      }
    );

    const nextTxnId = 'TXN' + (Date.now().toString().slice(-6) + Math.floor(Math.random() * 100));
    const refNumber = 'SWEEP' + Math.floor(10000000 + Math.random() * 90000000);

    await sequelize.query(
      `INSERT INTO transactions 
       (transaction_id, account_id, customer_id, transaction_ts, merchant, description, amount, direction, category, payment_method, transaction_type, status, reference_number, is_suspicious)
       VALUES 
       (:nextTxnId, :sourceAccountId, :customerId, NOW(), 'Sovereign High-Yield Bond Vault', 'Automated Yield Sweep to Sovereign Vault (7.45% APY)', :amount, 'debit', 'Investment', 'IMPS', 'bank_transfer', 'successful', :refNumber, false)`,
      {
        replacements: {
          nextTxnId,
          sourceAccountId: accountToUse,
          customerId,
          amount: numAmount.toFixed(2),
          refNumber
        },
        transaction
      }
    );

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `ISO 20022 Real-Time Sweep Executed: ₹${numAmount.toLocaleString('en-IN')} swept into Sovereign Vault.`,
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
 * Toggle Debit Card Freeze / Active status in Neon DB debit_cards table strictly for authenticated customer
 */
exports.toggleCardFreeze = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) {
      await transaction.rollback();
      return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
    }

    const { cardId } = req.body;

    // Look up card strictly for this customer
    let cardQuery = `SELECT * FROM debit_cards WHERE customer_id = :customerId`;
    let queryReplacements = { customerId };

    if (cardId) {
      cardQuery += ` AND card_id = :cardId`;
      queryReplacements.cardId = cardId;
    }
    cardQuery += ` ORDER BY card_id ASC LIMIT 1 FOR UPDATE`;

    const [cards] = await sequelize.query(cardQuery, { replacements: queryReplacements, transaction });

    if (cards.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "No debit card issued for this user account. Status: No Active Card."
      });
    }

    const card = cards[0];
    const oldStatus = card.status;
    const newStatus = (oldStatus === 'active') ? 'blocked' : 'active';

    await sequelize.query(
      `UPDATE debit_cards SET status = :newStatus WHERE card_id = :cardId AND customer_id = :customerId`,
      { replacements: { newStatus, cardId: card.card_id, customerId }, transaction }
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
          cardId: card.card_id,
          customerId,
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
        cardId: card.card_id,
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
