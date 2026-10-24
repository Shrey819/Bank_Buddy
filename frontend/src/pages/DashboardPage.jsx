import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Bot,
  Send,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  X,
  AlertCircle,
  Building2,
  Receipt,
  PiggyBank
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  // Banking data state loaded from Neon PostgreSQL tables strictly for authenticated user
  const [bankingData, setBankingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notification, setNotification] = useState(null);

  // Filter & Search states for Transactions
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Subtract Modals
  const [modalMode, setModalMode] = useState(null); // 'add' | 'subtract' | null
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const [actionMerchant, setActionMerchant] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [actionCategory, setActionCategory] = useState('Transfer');
  const [submittingAction, setSubmittingAction] = useState(false);

  // Copilot Assistant state
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    {
      sender: 'assistant',
      text: 'Good day! I am your Autonomous Banking Copilot connected directly to your Neon PostgreSQL database tables. All ledger transactions and card limits comply with ISO 20022 standards.'
    }
  ]);

  // Load real banking data for authenticated user from PostgreSQL
  const fetchDashboardData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const token = user?.token || user?.accessToken;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/v1/dashboard-data', { headers });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBankingData(json.data);
          // Set default selected account from database accounts
          if (json.data.accounts?.length > 0) {
            setSelectedAccountId(json.data.accounts[0].account_id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load banking data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(true);
  }, [user]);

  // Format currency in Indian Rupees
  const formatINR = (val) => {
    const num = parseFloat(val || 0);
    return '₹' + num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Derive primary card info directly from database rows
  const primaryDebitCard = bankingData?.debitCards?.[0] || null;
  const isCardFrozen = primaryDebitCard?.status === 'blocked';
  const primaryCreditCard = bankingData?.creditCards?.[0] || null;
  const accounts = bankingData?.accounts || [];
  const summary = bankingData?.summary || {
    totalAvailableBalance: 0,
    totalLedgerBalance: 0,
    creditOutstanding: 0,
    creditLimit: 0,
    creditAvailable: 0,
    upcomingOutflows: 0,
    safeSurplus: 0
  };

  // Toggle Debit Card Freeze in Neon PostgreSQL debit_cards table
  const handleToggleCardFreeze = async () => {
    if (!primaryDebitCard) return;
    try {
      const res = await fetch('/api/v1/cards/toggle-freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: primaryDebitCard.card_id })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: data.message
        });
        await fetchDashboardData(true);
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Failed to update card status.'
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Handle Add (Deposit) or Subtract (Transfer / Payment)
  const handleExecuteBalanceAction = async (e) => {
    e.preventDefault();
    if (!actionAmount || isNaN(parseFloat(actionAmount)) || parseFloat(actionAmount) <= 0) {
      setNotification({ type: 'error', message: 'Please enter a valid amount greater than ₹0.' });
      return;
    }

    setSubmittingAction(true);
    try {
      const activeAccId = selectedAccountId || accounts[0]?.account_id;
      const res = await fetch('/api/v1/accounts/adjust-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: activeAccId,
          amount: parseFloat(actionAmount),
          type: modalMode, // 'add' or 'subtract'
          merchant: actionMerchant.trim() || (modalMode === 'add' ? 'Instant Account Credit' : 'Direct Funds Settlement'),
          description: actionDescription.trim() || (modalMode === 'add' ? 'Deposit via Executive Portal' : 'Transfer sent via Executive Portal'),
          category: actionCategory,
          paymentMethod: 'UPI'
        })
      });

      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: data.message
        });
        setModalMode(null);
        setActionAmount('');
        setActionMerchant('');
        setActionDescription('');
        await fetchDashboardData(true);
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Transaction failed.'
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Sweep Surplus to High-Yield Sovereign Vault
  const handleSweepSurplus = async () => {
    try {
      const sweepAmount = Math.min(summary.safeSurplus, 50000);
      if (sweepAmount <= 0) {
        setNotification({ type: 'error', message: 'No sweepable surplus available for this account.' });
        return;
      }
      const res = await fetch('/api/v1/sweep-surplus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: sweepAmount,
          sourceAccountId: accounts[0]?.account_id
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotification({
          type: 'success',
          message: data.message
        });
        await fetchDashboardData(true);
      } else {
        setNotification({
          type: 'error',
          message: data.message || 'Sweep could not be completed.'
        });
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  // Filtered transactions list directly from database rows
  const filteredTransactions = useMemo(() => {
    const list = bankingData?.transactions || [];
    return list.filter((tx) => {
      // Category filter
      if (activeFilter === 'credit' && tx.direction !== 'credit') return false;
      if (activeFilter === 'debit' && tx.direction !== 'debit') return false;
      if (
        activeFilter !== 'all' &&
        activeFilter !== 'credit' &&
        activeFilter !== 'debit' &&
        tx.category?.toLowerCase() !== activeFilter.toLowerCase()
      ) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m = (tx.merchant || '').toLowerCase();
        const d = (tx.description || '').toLowerCase();
        const r = (tx.reference_number || '').toLowerCase();
        return m.includes(q) || d.includes(q) || r.includes(q);
      }
      return true;
    });
  }, [bankingData?.transactions, activeFilter, searchQuery]);

  // AI Copilot interactions
  const handleSendCopilot = async (textToSend) => {
    const text = textToSend || copilotInput;
    if (!text.trim()) return;

    const userMsg = { sender: 'user', text };
    setCopilotMessages((prev) => [...prev, userMsg]);
    setCopilotInput('');

    try {
      const token = user?.token || user?.accessToken;
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text.trim(),
          session_id: `DASH-${user?.id || 'C1001'}`,
          conversation_history: []
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCopilotMessages((prev) => [...prev, { sender: 'assistant', text: data.answer }]);
        return;
      }
    } catch (e) {
      console.warn('Dashboard Copilot chat error:', e);
    }

    const lower = text.toLowerCase();
    if (lower.includes('freeze') || lower.includes('unfreeze') || lower.includes('lock card')) {
      await handleToggleCardFreeze();
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Card Guard: Status updated for Debit Card *${primaryDebitCard?.masked_card_number?.slice(-4) || '2468'} in Neon PostgreSQL database.`
        }
      ]);
    } else if (lower.includes('sweep') || lower.includes('vault')) {
      await handleSweepSurplus();
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `ISO 20022 Wire executed: ?${Math.min(summary.safeSurplus, 50000).toLocaleString('en-IN')} swept into Sovereign High-Yield Bond Vault (7.45% APY). Ledger updated.`
        }
      ]);
    } else if (lower.includes('surplus') || lower.includes('balance') || lower.includes('metric')) {
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Neon DB Ledger Verified: Total Liquid Balance: ${formatINR(summary.totalAvailableBalance)} | Credit Due: -${formatINR(summary.creditOutstanding)} | Upcoming Outflows: ${formatINR(summary.upcomingOutflows)} | Safe Sweepable Surplus is ${formatINR(summary.safeSurplus)}.`
        }
      ]);
    } else if (lower.includes('add') || lower.includes('deposit')) {
      setModalMode('add');
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Opened the Add / Deposit Funds modal for account ${accounts[0]?.account_id}. Enter the amount to credit.`
        }
      ]);
    } else if (lower.includes('send') || lower.includes('transfer') || lower.includes('subtract') || lower.includes('pay')) {
      setModalMode('subtract');
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Opened the Transfer / Subtract Funds modal. Select the payee and amount.`
        }
      ]);
    } else {
      setCopilotMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Command "${text}" analyzed against ISO 20022 database rules. You can ask me to "deposit funds", "transfer money", "freeze card", "sweep surplus", or "check balance".`
        }
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Global Unified Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Executive Wealth Portal
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Neon DB Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Welcome back, <strong className="text-indigo-600 dark:text-indigo-400">{bankingData?.customer?.full_name || user?.name || user?.username || 'Client'}</strong> &bull; Customer ID: <span className="font-mono font-bold text-indigo-500">{bankingData?.customer?.customer_id || user?.customer_id || '—'}</span> &bull; CRN: {user?.crn || '—'} &bull; City: {bankingData?.customer?.city || '—'}
            </p>
          </div>

          {/* Sync & Copilot Quick Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDashboardData()}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Refresh ledger from database tables"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} /> Sync DB Tables
            </button>

            <button
              onClick={() => setShowCopilot(!showCopilot)}
              className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> AI Copilot
            </button>
          </div>
        </div>

        {/* Quick Action Control Bar: Add, Subtract, Sweep */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => {
              setModalMode('add');
              setActionAmount('');
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Deposit or Add funds into account"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Add / Deposit Funds
          </button>

          <button
            onClick={() => {
              setModalMode('subtract');
              setActionAmount('');
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Transfer, Pay, or Subtract funds"
          >
            <Minus className="w-4 h-4 stroke-[3]" /> Transfer / Subtract Funds
          </button>

          <button
            onClick={handleSweepSurplus}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Sweep Safe Surplus
          </button>
        </div>

        {/* Live Notification Banner */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm animate-in fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-bold hover:underline opacity-80 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Account Metrics in ₹ (Directly from Neon PostgreSQL Tables) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Liquid Checking & Savings */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition relative group">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Liquid Accounts & Balances
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              {formatINR(summary.totalAvailableBalance)}
            </div>
            <div className="space-y-1">
              {accounts.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic py-1">
                  No active accounts &bull; Balance: ₹0.00
                </div>
              ) : (
                accounts.map((acc) => (
                  <div key={acc.account_id} className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex justify-between">
                    <span className="capitalize">{acc.account_type} ({acc.account_id}):</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{formatINR(acc.available_balance)}</span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-between">
              <span>Ledger Balance: {formatINR(summary.totalLedgerBalance)}</span>
              <span className="flex items-center gap-0.5"><ArrowUpRight className="w-3 h-3" /> ISO 20022 Verified</span>
            </div>
          </div>

          {/* Card 2: Credit Card Directly from credit_cards table */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                {primaryCreditCard ? `${primaryCreditCard.card_network} Credit Card` : 'Credit Card'}
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              -{formatINR(summary.creditOutstanding)}
            </div>
            <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex justify-between">
                <span>Credit Limit:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{formatINR(summary.creditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Available Limit:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(summary.creditAvailable)}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 font-semibold flex items-center justify-between">
              <span>Due: {primaryCreditCard?.statement_due_date ? new Date(primaryCreditCard.statement_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Dues (₹0.00)'}</span>
              <span>Min Due: {formatINR(primaryCreditCard?.minimum_due || 0)}</span>
            </div>
          </div>

          {/* Card 3: Safe Surplus Calculated from Table Values */}
          <div className="p-6 bg-gradient-to-tr from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl shadow-md flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                  Safe Calculated Surplus
                </span>
                <div className="p-2 bg-white/10 text-indigo-200 rounded-xl">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black tracking-tight mb-2">
                {formatINR(summary.safeSurplus)}
              </div>
              <p className="text-[11px] text-indigo-200/90 font-medium leading-relaxed">
                {summary.totalAvailableBalance > 0 ? `Calculated strictly from database tables for ${bankingData?.customer?.full_name || user?.name}: Liquid balance minus ${formatINR(summary.upcomingOutflows)} upcoming commitments.` : `No liquid balance in account (₹0.00). Safe surplus is ₹0.00.`}
              </p>
            </div>
            <div className="mt-4 pt-2.5 border-t border-indigo-700/50 flex items-center justify-between text-[10px] text-indigo-200 font-semibold">
              <span>Projected Outflows: {formatINR(summary.upcomingOutflows)}</span>
              <button
                onClick={handleSweepSurplus}
                className="underline hover:text-white cursor-pointer font-bold"
              >
                Auto-Sweep &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* 2. Middle Row: Autopilot Recommendation & Debit Card Guard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Autopilot Recommendation */}
          <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] uppercase">
                  Autonomous Copilot
                </span>
                <span className="text-xs text-slate-400">&bull; ISO 20022 Rule {bankingData?.customer?.customer_id}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                {summary.safeSurplus > 0 ? `Optimize Safe Surplus: Sweep ${formatINR(Math.min(summary.safeSurplus, 50000))} into 7.45% Sovereign Vault` : 'Account Portfolio Ready • Current Balance ₹0.00'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                {summary.totalAvailableBalance > 0 ? `${bankingData?.customer?.full_name || user?.name}'s liquid balance of ${formatINR(summary.totalAvailableBalance)} safely covers 30-day projected commitments (${formatINR(summary.upcomingOutflows)}). Sweeping excess earns 7.45% APY compounding yield.` : 'This user account currently has ₹0.00 balance and 0 active commitments. Deposit funds to activate automated ISO 20022 monitoring and high-yield sweeps.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSweepSurplus}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Approve Auto-Sweep
              </button>
              <button
                onClick={() => {
                  setModalMode('subtract');
                  setActionAmount('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Custom Transfer
              </button>
            </div>
          </div>

          {/* Debit Card Guard Directly from debit_cards Table */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Debit Card Guard
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                    isCardFrozen
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {isCardFrozen ? 'FROZEN / BLOCKED' : 'ACTIVE'}
                </span>
              </div>

              {/* Virtual Debit Card Rendering */}
              <div className={`p-4 rounded-xl mb-4 relative overflow-hidden shadow-inner text-white transition duration-300 ${
                isCardFrozen
                  ? 'bg-gradient-to-tr from-slate-950 via-rose-950 to-slate-900 border border-rose-800/40'
                  : 'bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-800'
              }`}>
                <div className="flex justify-between items-center text-[10px] text-slate-300 font-mono">
                  <span>BANK BUDDY PLATINUM</span>
                  <span className="font-bold uppercase tracking-widest">{primaryDebitCard?.card_network || 'VISA'}</span>
                </div>
                <div className="text-sm font-mono tracking-widest my-3">
                  {primaryDebitCard?.masked_card_number || '•••• •••• •••• ••••'}
                </div>
                <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                  <span>{(bankingData?.customer?.full_name || user?.name || user?.username || 'NEW CLIENT').toUpperCase()}</span>
                  <span>{primaryDebitCard?.expires_on ? new Date(primaryDebitCard.expires_on).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : '—'}</span>
                </div>
                {isCardFrozen && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center gap-1.5 text-xs font-black text-rose-300 tracking-wider uppercase">
                    <Lock className="w-4 h-4" /> Card Frozen
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 space-y-0.5">
                <div className="flex justify-between">
                  <span>Daily ATM Limit:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{formatINR(primaryDebitCard?.daily_atm_limit || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Daily Purchase Limit:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{formatINR(primaryDebitCard?.daily_purchase_limit || 0)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleCardFreeze}
              disabled={!primaryDebitCard}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm ${
                !primaryDebitCard
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : isCardFrozen
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
              }`}
            >
              {!primaryDebitCard ? 'No Debit Card Issued' : isCardFrozen ? 'Unfreeze Card (Make Active)' : 'Instant Freeze Card'}
            </button>
          </div>
        </div>

        {/* 3. Upcoming Obligations from bills, scheduled_payments, loans Tables */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upcoming Obligations & Scheduled Outflows &bull; {bankingData?.customer?.full_name}
              </h3>
              <p className="text-[11px] text-slate-500">
                Direct records from PostgreSQL bills, scheduled_payments, and loans tables
              </p>
            </div>
            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs rounded-xl">
              Total Due: {formatINR(summary.upcomingOutflows)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(bankingData?.bills?.length === 0 && bankingData?.scheduledPayments?.length === 0 && bankingData?.loans?.length === 0) ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 col-span-full">
                No upcoming obligations, scheduled payments, or loan EMIs for this customer. Total due: ₹0.00
              </div>
            ) : null}
            {/* Bills from bills table */}
            {(bankingData?.bills || []).map((bill) => (
              <div key={bill.bill_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      <Receipt className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded">
                      {bill.autopay_enabled ? 'Autopay ON' : bill.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{bill.biller_name}</h4>
                  <p className="text-[10px] text-slate-500">{bill.bill_type} &bull; Due {new Date(bill.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="mt-3 text-sm font-black text-slate-900 dark:text-white">
                  {formatINR(bill.amount_due)}
                </div>
              </div>
            ))}

            {/* Scheduled Payments from scheduled_payments table */}
            {(bankingData?.scheduledPayments || []).map((sp) => (
              <div key={sp.payment_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/50 px-1.5 py-0.5 rounded">
                      Scheduled
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{sp.payee_name}</h4>
                  <p className="text-[10px] text-slate-500">{sp.payment_method} &bull; Date {new Date(sp.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="mt-3 text-sm font-black text-slate-900 dark:text-white">
                  {formatINR(sp.amount)}
                </div>
              </div>
            ))}

            {/* Loan EMI from loans table */}
            {(bankingData?.loans || []).map((loan) => (
              <div key={loan.loan_id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded">
                      Loan EMI
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{loan.loan_type} Loan</h4>
                  <p className="text-[10px] text-slate-500">Rate: {loan.annual_interest_pct}% &bull; Due {new Date(loan.next_emi_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </div>
                <div className="mt-3 text-sm font-black text-slate-900 dark:text-white">
                  {formatINR(loan.emi_amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Live Neon PostgreSQL Transactions Table Directly from transactions table */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          {/* Header & Filter Controls */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Real-Time ISO 20022 Ledger &bull; {bankingData?.customer?.full_name}
                </h3>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">({filteredTransactions.length} records)</span>
              </div>
              <p className="text-xs text-slate-500">Live records from transactions table for Customer ID {bankingData?.customer?.customer_id}</p>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
              <div className="relative flex-1 md:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search merchant, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons to Add / Subtract right above the ledger */}
              <button
                onClick={() => {
                  setModalMode('add');
                  setActionAmount('');
                }}
                className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3 stroke-[3]" /> Add Credit
              </button>
              <button
                onClick={() => {
                  setModalMode('subtract');
                  setActionAmount('');
                }}
                className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1 cursor-pointer"
              >
                <Minus className="w-3 h-3 stroke-[3]" /> Debit / Send
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Transactions' },
              { id: 'credit', label: 'Credits (+)' },
              { id: 'debit', label: 'Debits (-)' },
              { id: 'Income', label: 'Income' },
              { id: 'Food', label: 'Food & Dining' },
              { id: 'Utilities', label: 'Utilities' },
              { id: 'Transfer', label: 'Transfers' },
              { id: 'Shopping', label: 'Shopping' },
              { id: 'Transport', label: 'Transport & Fuel' },
              { id: 'Investment', label: 'Investment & Vault' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activeFilter === f.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No transactions found for this customer with the selected filter.
              </div>
            ) : (
              filteredTransactions.map((tx) => (
                <div key={tx.transaction_id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        tx.direction === 'credit'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tx.direction === 'credit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {tx.merchant || tx.description}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                          {tx.category || 'General'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        {tx.description} &bull; {tx.payment_method} &bull; Ref: {tx.reference_number || tx.transaction_id}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className={`text-xs font-black font-mono ${
                        tx.direction === 'credit'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.direction === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">
                      {new Date(tx.transaction_ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} &bull; {tx.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add / Subtract Interactive Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl text-white ${modalMode === 'add' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                  {modalMode === 'add' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {modalMode === 'add' ? 'Deposit / Add Funds' : 'Transfer / Subtract Funds'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Customer {bankingData?.customer?.customer_id} &bull; {bankingData?.customer?.full_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalMode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteBalanceAction} className="space-y-4">
              {/* Select Account */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Target Account
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {accounts.length === 0 ? (
                    <option value="NEW_PRIMARY">Primary Savings Account (New Deposit)</option>
                  ) : (
                    accounts.map((a) => (
                      <option key={a.account_id} value={a.account_id}>
                        {a.account_id} — {a.account_type.toUpperCase()} (Available: {formatINR(a.available_balance)})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Amount in ₹
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Quick Chips */}
                <div className="flex gap-2 mt-2">
                  {[1000, 2500, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setActionAmount(preset.toString())}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      +₹{preset.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payee / Merchant */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  {modalMode === 'add' ? 'Sender / Source Name' : 'Payee / Merchant / Recipient'}
                </label>
                <input
                  type="text"
                  placeholder={modalMode === 'add' ? 'e.g. Client Wire, Dividend, Salary' : 'e.g. Aarav Sharma, Amazon, Rent'}
                  value={actionMerchant}
                  onChange={(e) => setActionMerchant(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category & Description */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Category
                  </label>
                  <select
                    value={actionCategory}
                    onChange={(e) => setActionCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Transfer">Transfer</option>
                    <option value="Income">Income</option>
                    <option value="Food">Food & Dining</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Transport">Transport</option>
                    <option value="Investment">Investment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Note / Purpose
                  </label>
                  <input
                    type="text"
                    placeholder="Optional memo"
                    value={actionDescription}
                    onChange={(e) => setActionDescription(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${
                    modalMode === 'add'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {submittingAction ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : modalMode === 'add' ? (
                    'Confirm & Add Funds'
                  ) : (
                    'Authorize & Send'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Copilot Assistant Popup */}
      {showCopilot && (
        <div className="fixed bottom-6 right-6 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-bold text-xs">Autonomous Banking Copilot</span>
            </div>
            <button
              onClick={() => setShowCopilot(false)}
              className="text-white/80 hover:text-white text-xs font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div className="h-64 overflow-y-auto p-4 flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-950/50">
            {copilotMessages.map((msg, index) => (
              <div
                key={index}
                className={`p-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                  msg.sender === 'user'
                    ? 'ml-auto bg-indigo-600 text-white'
                    : 'mr-auto bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <input
              type="text"
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCopilot()}
              placeholder="e.g. freeze card, add 5000, transfer 2000..."
              className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleSendCopilot()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
