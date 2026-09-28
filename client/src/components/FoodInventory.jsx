import React from 'react';
import { Package, Clock } from 'lucide-react';
import { formatCustomDate, formatDateTime, calculateFoodFreshness } from '../utils/formatters';

export const FoodInventory = ({ inventory }) => {
  const activeItems = Array.isArray(inventory)
    ? inventory.filter((item) => item.isInside && item.quantity > 0)
    : [];

  return (
    <div className="bg-white dark:bg-[#111114] rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 p-6 shadow-sm flex flex-col h-full transition-colors">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800/80 mb-5">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center transition-colors">
            <Package className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white transition-colors">Food Inventory</h2>
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-zinc-900 dark:text-zinc-300 dark:border dark:border-zinc-800 font-mono transition-colors">
          {activeItems.length} {activeItems.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      {/* Item Cards or Empty State */}
      {activeItems.length === 0 ? (
        <div
          id="inventory-empty-state"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200 dark:bg-zinc-900/30 dark:border-zinc-800 my-auto transition-colors"
        >
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 dark:bg-zinc-850 dark:bg-zinc-900 dark:text-zinc-500 flex items-center justify-center mb-3">
            <Package className="w-6 h-6 stroke-[1.8]" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
            No food currently inside the refrigerator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activeItems.map((item) => {
            const displayName = item.foodName || item.name || 'Food Item';
            const { label: status, isExpired } = calculateFoodFreshness(item.expiryDate);

            return (
              <div
                key={item._id || item.rfidUid}
                className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all ${
                  isExpired
                    ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/40 via-white to-white dark:border-rose-900/50 dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900'
                    : 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/40 via-white to-white dark:border-emerald-900/50 dark:from-emerald-950/20 dark:via-zinc-900 dark:to-zinc-900'
                }`}
              >
                {/* Top: Food Name & Automatically Determined Status Badge */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100/90 dark:border-zinc-800">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isExpired ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
                      {displayName}
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase border flex-shrink-0 ${
                      isExpired
                        ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/60'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60'
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {/* Middle: Manufacture & Expiry Dates */}
                <div className="py-3 space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-zinc-500 font-medium">Manufactured:</span>
                    <span className="font-semibold text-slate-700 dark:text-zinc-200 font-mono">
                      {item.manufactureDate ? formatCustomDate(item.manufactureDate) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 dark:text-zinc-500 font-medium">Expires:</span>
                    <span className={`font-semibold font-mono ${isExpired ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-700 dark:text-zinc-200'}`}>
                      {item.expiryDate ? formatCustomDate(item.expiryDate) : '--'}
                    </span>
                  </div>
                </div>

                {/* Bottom: Added Timestamp (Zero visible RFID UID) */}
                <div className="pt-2.5 border-t border-slate-100/90 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 flex-shrink-0" />
                    <span className="text-slate-400 dark:text-zinc-500 font-medium">Added:</span>
                    <span className="font-semibold text-slate-700 dark:text-zinc-300 font-mono">
                      {item.addedAt ? formatDateTime(item.addedAt) : '--'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FoodInventory;
