import React from 'react';
import { ShieldCheck, Wifi, WifiOff, Clock, Sun, Moon } from 'lucide-react';
import { formatTimeOnly } from '../utils/formatters';

export const Header = ({ isOnline, lastUpdate, backendConnected, isDark, toggleTheme }) => {
  return (
    <header className="bg-white dark:bg-black border-b border-slate-200/80 dark:border-zinc-800/80 shadow-sm sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Brand & Subtitle */}
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white flex-shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors">
                FreshGuard
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium transition-colors">
                Smart Refrigerator Monitoring System
              </p>
            </div>
          </div>

          {/* Right Status Controls */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-start sm:self-auto">
            
            {/* Last Communication Timestamp */}
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-zinc-800 transition-colors">
              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
              <span>Last Telemetry:</span>
              <span className="font-semibold text-slate-700 dark:text-zinc-200 font-mono">
                {lastUpdate ? formatTimeOnly(lastUpdate) : '--:--'}
              </span>
            </div>

            {/* ESP32 Hardware Status Badge */}
            <div
              id="esp32-status-badge"
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-smooth ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm shadow-emerald-500/10 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-600/40 dark:shadow-emerald-950/20'
                  : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800'
              }`}
            >
              {isOnline ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                  <span>ESP32 LIVE</span>
                </>
              ) : (
                <>
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400 dark:bg-zinc-600"></span>
                  <WifiOff className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                  <span>ESP32 OFFLINE</span>
                </>
              )}
            </div>

            {/* Light / Dark Mode Toggle Button */}
            <button
              type="button"
              id="theme-toggle-btn"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-smooth shadow-sm cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 stroke-[2.2]" />
              ) : (
                <Moon className="w-4 h-4 stroke-[2.2]" />
              )}
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};

export default Header;
