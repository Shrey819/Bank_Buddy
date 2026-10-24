import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, MessageSquare, LogOut, ShieldCheck } from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isHighContrast, toggleDisplayMode } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isDesktopActive = location.pathname === '/' || location.pathname === '/desktop';
  const isChatActive = location.pathname === '/chat';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'BB';

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 flex flex-col justify-between p-4 h-screen fixed left-0 top-0 z-30 transition-colors">
      {/* 1. Header & Logo */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 px-1 pt-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white leading-tight">
              Bank<span className="text-indigo-600 dark:text-indigo-400">Buddy</span>
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400">
              Autonomous Wealth
            </span>
          </div>
        </div>

        {/* 2. Navigation Menu */}
        <nav className="flex flex-col gap-1.5">
          {/* Desktop Link */}
          <Link
            to="/desktop"
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isDesktopActive
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 ${isDesktopActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
            <span>Desktop</span>
          </Link>

          {/* Chat Link */}
          <Link
            to="/chat"
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isChatActive
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className={`w-4 h-4 ${isChatActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-indigo-500'}`} />
              <span>Chat</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </Link>

          {/* Logout Link */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all text-left"
          >
            <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Logout</span>
          </button>
        </nav>
      </div>

      {/* 3. Footer: Display Mode & User Profile */}
      <div className="flex flex-col gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">
        {/* Display Mode Toggle */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Display Mode</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer" title="Toggle Display Mode">
            <input
              type="checkbox"
              id="contrast-toggle"
              className="sr-only peer"
              checked={isHighContrast}
              onChange={(e) => toggleDisplayMode(e.target.checked)}
            />
            <div className="w-8 h-4 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* User Profile Card & Direct Logout */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full ring-2 ring-indigo-500/20 bg-gradient-to-tr from-purple-200 via-pink-100 to-indigo-100 dark:from-indigo-900 dark:via-purple-900 dark:to-slate-800 flex items-center justify-center font-bold text-xs text-indigo-700 dark:text-indigo-300">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white dark:border-slate-900 rounded-full"></span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {user?.name || user?.username || 'Client'}
              </span>
              <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                CRN: {user?.crn || '98234105'} &bull; Private
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            title="Logout & Return to Login"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
