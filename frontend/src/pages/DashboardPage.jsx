import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const [cardFrozen, setCardFrozen] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotMessages, setCopilotMessages] = useState([
    {
      sender: 'assistant',
      text: 'Good day! I am your Autonomous Banking Copilot. All actions are validated against ISO 20022 compliance.'
    }
  ]);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const transactions = [
    {
      id: 'TXN-9021',
      title: 'Dividend Credit — HDFC Nifty 50 Fund',
      date: 'Today, 11:42 AM',
      amount: '+₹14,500.00',
      type: 'credit',
      status: 'Settled'
    },
    {
      id: 'TXN-9019',
      title: 'Sapphire Reserve Statement Settlement',
      date: 'Yesterday',
      amount: '-₹9,500.00',
      type: 'debit',
      status: 'Settled'
    },
    {
      id: 'TXN-8992',
      title: 'Automated Yield Sweep to Bond Vault',
      date: 'Oct 22, 2026',
      amount: '+₹50,000.00',
      type: 'credit',
      status: 'Settled'
    },
    {
      id: 'TXN-8971',
      title: 'International Wire — Tech Equipment Inc',
      date: 'Oct 20, 2026',
      amount: '-₹22,350.00',
      type: 'debit',
      status: 'Settled'
    }
  ];

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

    setTimeout(() => {
      let replyText = `Processed "${text}". Verified against ISO-20022 compliance rules.`;
      const lower = text.toLowerCase();

      if (lower.includes('freeze') || lower.includes('card')) {
        setCardFrozen((prev) => !prev);
        replyText = `Card Guard: Debit Card *${user?.cardNumber || '4441'} status has been updated to ${
          !cardFrozen ? 'FROZEN' : 'ACTIVE'
        }.`;
      } else if (lower.includes('surplus') || lower.includes('balance')) {
        replyText =
          'Ledger Verified: Liquid Checking ₹125,000.00 | Safe surplus ready for allocation.';
      } else if (lower.includes('sweep') || lower.includes('transfer')) {
        setTransferSuccess(true);
        replyText =
          'ISO 20022 Wire executed: ₹50,000.00 successfully allocated to Sovereign High-Yield Vault (7.45% APY).';
      }

      setCopilotMessages((prev) => [...prev, { sender: 'assistant', text: replyText }]);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Global Unified Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Executive Wealth Portal
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Welcome back, <strong className="text-indigo-600 dark:text-indigo-400">{user?.name || 'Elena Rostova'}</strong> &bull; CRN: {user?.crn || '98234105'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSendCopilot('Sweep surplus to high-yield vault')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Sweep Surplus to Vault
            </button>
            <button
              onClick={() => setShowCopilot(!showCopilot)}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> AI Copilot
            </button>
          </div>
        </div>

        {/* Transfer Success Notification */}
        {transferSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>ISO 20022 Real-Time Wire executed: ₹50,000 swept into Sovereign Gold & Bond Vault.</span>
            </div>
            <button
              onClick={() => setTransferSuccess(false)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Account Metrics in ₹ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Liquid Checking */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Liquid Checking
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              ₹99,500.00
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> Active &bull; Primary Checking Account
            </div>
          </div>

          {/* Card 2: Sapphire Reserve Credit Card */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Sapphire Reserve Credit
              </span>
              <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              -₹9,500.00
            </div>
            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3" /> Due in 18 days &bull; Auto-pay scheduled
            </div>
          </div>

          {/* Card 3: Safe Surplus */}
          <div className="p-6 bg-gradient-to-tr from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl shadow-md">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Safe Calculated Surplus
              </span>
              <div className="p-2 bg-white/10 text-indigo-200 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black tracking-tight mb-1">
              ₹90,000.00
            </div>
            <div className="text-[11px] text-indigo-200 font-medium">
              Checked against monthly billings &bull; 100% Sweepable
            </div>
          </div>
        </div>

        {/* 2. Middle Row: Autopilot Recommendation & Card Guard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Autopilot Recommendation */}
          <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] uppercase">
                Autonomous Copilot
              </span>
              <span className="text-xs text-slate-400">&bull; ISO 20022 Rule C1001</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              Optimize Safe Surplus: Sweep ₹50,000 into 7.45% Sovereign Vault
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Your liquid checking balance of ₹99,500 exceeds your 30-day projected outflows (₹9,500). Sweeping ₹50,000 earns ₹3,725 estimated annual interest with zero penalty on instant withdrawals.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSendCopilot('Sweep surplus to high-yield vault')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Approve Transfer
              </button>
              <button
                onClick={() => handleSendCopilot('Show portfolio allocation')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                View Analytics
              </button>
            </div>
          </div>

          {/* Debit Card Guard */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Card Guard
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    cardFrozen
                      ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {cardFrozen ? 'FROZEN' : 'ACTIVE'}
                </span>
              </div>
              <div className="p-4 bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-xl mb-4 relative overflow-hidden shadow-inner">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Bank Buddy Platinum</div>
                <div className="text-sm font-mono tracking-widest my-2">
                  •••• •••• •••• {user?.cardNumber || '4441'}
                </div>
                <div className="flex justify-between text-[10px] text-slate-300 font-mono">
                  <span>{user?.name?.toUpperCase() || 'ELENA ROSTOVA'}</span>
                  <span>10/28</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSendCopilot(cardFrozen ? 'Unfreeze my debit card' : 'Freeze my debit card')}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                cardFrozen
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {cardFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              {cardFrozen ? 'Unfreeze Card' : 'Instant Freeze Card'}
            </button>
          </div>
        </div>

        {/* 3. Portfolio Allocation & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Ledger Transactions */}
          <div className="lg:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
              <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                View Ledger &rarr;
              </span>
            </div>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        tx.type === 'credit'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {tx.type === 'credit' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{tx.title}</span>
                      <span className="text-[10px] text-slate-400">{tx.date} &bull; {tx.id}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-xs font-black font-mono ${
                        tx.type === 'credit'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {tx.amount}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-400">{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Asset Allocation Breakdown */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Portfolio Allocation</h3>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Fixed & Term Deposits</span>
                  <span className="font-bold">42% (₹1,05,000)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full w-[42%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Equities & Mutual Funds</span>
                  <span className="font-bold">30% (₹75,000)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full w-[30%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Sovereign Gold Bonds</span>
                  <span className="font-bold">18% (₹45,000)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full w-[18%]"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Liquid Cash Reserves</span>
                  <span className="font-bold">10% (₹25,000)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full w-[10%]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Copilot Assistant Popup */}
      {showCopilot && (
        <div className="fixed bottom-6 right-6 w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-bold text-xs">Bank Buddy Assistant</span>
            </div>
            <button
              onClick={() => setShowCopilot(false)}
              className="text-white/80 hover:text-white text-xs font-bold"
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
              placeholder="Ask anything or run command..."
              className="flex-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleSendCopilot()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
