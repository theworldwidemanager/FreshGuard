import React from 'react';
import { History, PlusCircle, MinusCircle } from 'lucide-react';
import { formatTimeOnly } from '../utils/formatters';

export const FoodHistory = ({ history }) => {
  const events = Array.isArray(history) ? history : [];

  return (
    <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-6 shadow-sm flex flex-col h-full transition-colors">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800/80 mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 flex items-center justify-center transition-colors">
            <History className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white transition-colors">Food History</h2>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300 dark:border dark:border-zinc-800 font-mono transition-colors">
          {events.length} {events.length === 1 ? 'Record' : 'Records'}
        </span>
      </div>

      {/* History List or Empty State */}
      {events.length === 0 ? (
        <div
          id="history-empty-state"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 dark:bg-zinc-900/30 dark:border-zinc-800 my-auto transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-850 dark:bg-zinc-900 dark:text-zinc-500 flex items-center justify-center mb-3">
            <History className="w-6 h-6 stroke-[1.8]" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            No food activity recorded yet.
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 dark:divide-zinc-800/70 pr-1 space-y-1">
          {events.map((event) => {
            const isAdded = event.action === 'ADDED';
            return (
              <div
                key={event._id || `${event.rfidUid}-${event.timestamp}`}
                className="py-3 px-2 flex items-center justify-between hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 dark:hover:bg-zinc-800/40 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      isAdded
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
                        : 'bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
                    }`}
                  >
                    {isAdded ? (
                      <PlusCircle className="w-4 h-4 stroke-[2.2]" />
                    ) : (
                      <MinusCircle className="w-4 h-4 stroke-[2.2]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {event.foodName}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
                          isAdded
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50'
                            : 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 dark:border dark:border-zinc-700/60'
                        }`}
                      >
                        {event.action}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 font-mono block">
                    {formatTimeOnly(event.timestamp)}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block">
                    {new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FoodHistory;
