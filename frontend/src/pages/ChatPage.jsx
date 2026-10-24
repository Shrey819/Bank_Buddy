import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { Send, Bot, ShieldCheck, CheckCircle2, AlertTriangle, Cpu, Wrench, Trash2 } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  // Derive stable storage keys - checking bankBuddyUser fallback in localStorage directly
  const getActiveUserIdentifier = () => {
    if (user?.username) return user.username;
    if (user?.customer_id) return user.customer_id;
    try {
      const raw = localStorage.getItem('bankBuddyUser');
      if (raw) {
        const u = JSON.parse(raw);
        if (u.username) return u.username;
        if (u.customer_id) return u.customer_id;
      }
    } catch (e) {}
    return 'default_user';
  };

  const userIdentifier = getActiveUserIdentifier();
  const storageKey = `bankBuddy_chat_${userIdentifier}`;
  const sessionKey = `bankBuddy_session_${userIdentifier}`;

  const sessionId = useRef(
    localStorage.getItem(sessionKey) ||
    `SESSION-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  );

  const getInitialMessages = () => {
    try {
      // 1. Try active user key
      let saved = localStorage.getItem(storageKey);
      // 2. Fallback to guest or legacy key if empty
      if (!saved) {
        saved = localStorage.getItem('bankBuddy_chat_guest') || localStorage.getItem('bankBuddy_chat_default_user');
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved chat messages:', e);
    }
    return [
      {
        id: 1,
        sender: 'assistant',
        text: `Hello ${user?.name || 'Elena'}! I am your Bank Buddy AI Financial Copilot. How can I assist your private wealth portfolio today?`,
        time: 'Just now'
      }
    ];
  };

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(getInitialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const isInitialMount = useRef(true);

  // If user object finishes hydrating from AuthContext after mount, reload messages if current state is just the default 1 message
  useEffect(() => {
    if (user?.username || user?.customer_id) {
      try {
        const activeKey = `bankBuddy_chat_${user.username || user.customer_id}`;
        const saved = localStorage.getItem(activeKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        }
      } catch (e) {}
    }
  }, [user?.username, user?.customer_id]);

  // Sync messages and session ID to localStorage on change (skipping first mount to prevent accidental overwrite)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      // Also write to default fallback so switching user states doesn't lose messages
      localStorage.setItem('bankBuddy_chat_default_user', JSON.stringify(messages));
      localStorage.setItem(sessionKey, sessionId.current);
    } catch (e) {
      console.warn('Failed to save chat to localStorage:', e);
    }
  }, [messages, storageKey, sessionKey]);

  // Clear chat handler
  const handleClearChat = () => {
    const defaultMsg = [
      {
        id: Date.now(),
        sender: 'assistant',
        text: `Chat cleared. Hello ${user?.name || 'Elena'}! How can I assist your banking queries today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setMessages(defaultMsg);
    sessionId.current = `SESSION-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaultMsg));
      localStorage.setItem(sessionKey, sessionId.current);
    } catch (e) {
      console.warn('Failed to update localStorage on clear:', e);
    }
  };

  const quickPrompts = [
    'What is my account balance?',
    'Analyze my expenses',
    'What are my upcoming payments?',
    'What is my credit card balance and due date?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (textToSend) => {
    const text = textToSend || input;
    if (!text.trim() || isTyping) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const token = user?.token || user?.accessToken;
      const history = messages
        .filter((m) => m.sender === 'user' || m.sender === 'assistant')
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: text.trim(),
          session_id: sessionId.current,
          conversation_history: history
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: data.answer || 'Response processed successfully.',
        trace_id: data.trace_id,
        agents_invoked: data.agents_invoked || [],
        tools_invoked: data.tools_invoked || [],
        answer_type: data.answer_type,
        requires_confirmation: data.requires_confirmation,
        confirmation_token: data.confirmation_token,
        data: data.data,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'assistant',
        text: `AI Copilot Notice: ${err.message}. Please verify that the AI Core service is running.`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmAction = async (confirmationToken, decision, parentMsgId) => {
    setIsTyping(true);
    try {
      const token = user?.token || user?.accessToken;
      const res = await fetch('/api/v1/chat/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          confirmation_token: confirmationToken,
          decision: decision,
          session_id: sessionId.current
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Mark the original message's confirmation as resolved
      setMessages((prev) =>
        prev.map((m) =>
          m.id === parentMsgId ? { ...m, confirmation_resolved: decision } : m
        )
      );

      const confirmResultMessage = {
        id: Date.now(),
        sender: 'assistant',
        text: data.answer || (decision === 'yes' ? 'Action confirmed.' : 'Action cancelled.'),
        trace_id: data.trace_id,
        agents_invoked: data.agents_invoked || [],
        tools_invoked: data.tools_invoked || [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, confirmResultMessage]);
    } catch (err) {
      const errorMsg = {
        id: Date.now(),
        sender: 'assistant',
        text: `Confirmation failed: ${err.message}`,
        isError: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
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
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Autonomous LangGraph &bull; Grounded Deterministic Banking Tools
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> ISO 20022 Verified Gateway
            </span>
            <button
              onClick={handleClearChat}
              title="Clear saved chat history"
              className="px-2.5 py-1 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-1 font-medium cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Chat
            </button>
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
                  disabled={isTyping}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 hover:border-indigo-500 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm cursor-pointer disabled:opacity-50"
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
                    : msg.isError
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-600'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                }`}
              >
                {msg.sender === 'user' ? (
                  user?.name?.[0]?.toUpperCase() || 'U'
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className="flex flex-col gap-1 max-w-[85%]">
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-tl-none'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* High-Risk Action Confirmation Panel */}
                  {msg.requires_confirmation && !msg.confirmation_resolved && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs mb-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Human Confirmation Required
                      </div>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-3">
                        This is a high-risk irreversible action. Please confirm to proceed.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmAction(msg.confirmation_token, 'yes', msg.id)}
                          disabled={isTyping}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                          Confirm &amp; Execute
                        </button>
                        <button
                          onClick={() => handleConfirmAction(msg.confirmation_token, 'no', msg.id)}
                          disabled={isTyping}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.confirmation_resolved && (
                    <div className="mt-2 text-[10px] font-semibold text-slate-400 italic">
                      Resolution: {msg.confirmation_resolved === 'yes' ? 'Confirmed & Executed' : 'Cancelled by user'}
                    </div>
                  )}

                  {/* Audit Trail & Grounding Transparency */}
                  {(msg.agents_invoked?.length > 0 || msg.tools_invoked?.length > 0 || msg.trace_id) && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[10px]">
                      {msg.trace_id && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 font-mono">
                          {msg.trace_id}
                        </span>
                      )}
                      {msg.agents_invoked?.map((agent, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded font-medium flex items-center gap-0.5"
                        >
                          <Cpu className="w-2.5 h-2.5" /> {agent}
                        </span>
                      ))}
                      {msg.tools_invoked?.map((tool, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded font-medium flex items-center gap-0.5"
                        >
                          <Wrench className="w-2.5 h-2.5" /> {tool}
                        </span>
                      ))}
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
                <span className="ml-1 text-[11px]">Reasoning &amp; querying banking ledger...</span>
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
              disabled={isTyping}
              placeholder="Ask Bank Buddy Copilot e.g. 'What is my balance?', 'Analyze my expenses'..."
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
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
