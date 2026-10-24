import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Send, Bot, User, Sparkles, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: `Hello ${user?.name || 'Elena'}! I am your Bank Buddy AI Financial Copilot. How can I assist your private wealth portfolio today?`,
      time: 'Just now'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const quickPrompts = [
    'Freeze my debit card',
    'Check my safe surplus',
    'Sweep ₹50,000 to High-Yield Vault',
    'View ISO 20022 audit logs'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let replyText = `Processed instruction "${text}". ISO-20022 compliance checks verified.`;
      let card = null;

      const lower = text.toLowerCase();

      if (lower.includes('freeze') || lower.includes('card')) {
        replyText = `Card Guard Update: Bank Buddy Debit Card ending in *${
          user?.cardNumber || '4441'
        } has been set to FROZEN. All online and POS transactions are blocked.`;
        card = {
          type: 'card_status',
          title: `Debit Card *${user?.cardNumber || '4441'} Status: FROZEN`,
          desc: 'Instant biometric unfreeze is available anytime.',
          status: 'Secured'
        };
      } else if (lower.includes('surplus') || lower.includes('balance')) {
        replyText =
          'Autonomous Ledger Analysis: Your Liquid Checking account holds ₹99,500.00. Outstanding credit bill is ₹9,500.00. Your safe calculated surplus is ₹90,000.00.';
        card = {
          type: 'surplus',
          title: 'Calculated Safe Surplus: ₹90,000.00',
          desc: 'Zero risk of bill overdraft. Ready for high-yield allocation.',
          status: 'Optimal'
        };
      } else if (lower.includes('sweep') || lower.includes('vault') || lower.includes('transfer')) {
        replyText =
          'ISO 20022 Real-time Wire: Initiated instant transfer of ₹50,000.00 from Liquid Checking into Sovereign High-Yield Vault (7.45% APY).';
        card = {
          type: 'transfer',
          title: 'Direct Transfer Executed: ₹50,000.00',
          desc: 'Reference: ISO20022-IND-8829104 &bull; Settlement: Immediate',
          status: 'Settled'
        };
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'assistant',
          text: replyText,
          card,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex transition-colors">
      {/* Global Unified Sidebar */}
      <Sidebar />

      {/* Main Chat Interface */}
      <main className="flex-1 ml-64 flex flex-col h-screen overflow-hidden">
        {/* Top Chat Header */}
        <header className="p-4 px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                Bank Buddy Copilot
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                ISO 20022 Compliant Wealth Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted
            </span>
          </div>
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 px-8 flex flex-col gap-4">
          {/* Quick Prompts Strip */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl mb-2">
            <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-2.5">
              ⚡ Recommended Instant Actions:
            </span>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 hover:border-indigo-500 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white font-bold text-xs'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {msg.sender === 'user' ? (
                  user?.name?.[0]?.toUpperCase() || 'U'
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm rounded-tl-none'
                  }`}
                >
                  {msg.text}

                  {/* Optional Rich Response Card */}
                  {msg.card && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {msg.card.title}
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold text-[9px] uppercase rounded">
                          {msg.card.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{msg.card.desc}</p>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] text-slate-400 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 mr-auto items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none text-xs text-slate-500 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]"></span>
                <span className="ml-1 text-[11px]">Verifying with ISO 20022 gateway...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 px-8 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Bank Buddy Copilot or type 'freeze debit card', 'check surplus'..."
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition shadow-sm cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-slate-400 text-center mt-2">
            Protected by Bank Buddy Autonomous Security &bull; Powered by ISO 20022 Protocol
          </div>
        </div>
      </main>
    </div>
  );
}
