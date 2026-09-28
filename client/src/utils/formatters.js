/**
 * Utility functions for FreshGuard dashboard
 */

/**
 * Format timestamp into standard readable 12-hour time (e.g., "08:31:05 PM")
 */
export const formatTimeOnly = (dateInput) => {
  if (!dateInput) return '--:--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * Format timestamp into short time (e.g., "08:31 PM")
 */
export const formatShortTime = (dateInput) => {
  if (!dateInput) return '--:--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format date & time for logs (e.g., "Sep 27, 08:31:05 PM")
 */
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '--';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--';
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${formatTimeOnly(d)}`;
};

/**
 * Format date into standard readable format: "DD-Mon-YYYY" (e.g., "23-Sep-2026")
 * Timezone-safe to preserve exact calendar date representation.
 */
export const formatCustomDate = (dateInput) => {
  if (!dateInput) return '--';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    const [year, monthNum, dayNum] = dateInput.substring(0, 10).split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[parseInt(monthNum, 10) - 1] || monthNum;
    return `${dayNum}-${month}-${year}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '--';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Automatically determine Food Status from Expiry Date.
 * Current date before/on valid expiry period -> 'FRESH'
 * Current date after expiry -> 'EXPIRED'
 */
export const calculateFoodFreshness = (expiryDate) => {
  if (!expiryDate) return { label: 'FRESH', isExpired: false };
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return { label: 'FRESH', isExpired: false };

  // Set boundary to the end of the expiration day (23:59:59.999) if no specific time was stored
  const endOfDay = new Date(expiry);
  if (endOfDay.getHours() === 0 && endOfDay.getMinutes() === 0 && endOfDay.getSeconds() === 0) {
    endOfDay.setHours(23, 59, 59, 999);
  }

  const isExpired = now.getTime() > endOfDay.getTime();
  return {
    label: isExpired ? 'EXPIRED' : 'FRESH',
    isExpired
  };
};

/**
 * Returns theme-aware color classes based on Gas ADC status
 */
export const getGasStatusColor = (status) => {
  switch (status) {
    case 'GOOD':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/50',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
        dot: 'bg-emerald-500'
      };
    case 'MILD':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/50',
        badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60',
        dot: 'bg-amber-500'
      };
    case 'WARNING':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800/50',
        badge: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60',
        dot: 'bg-rose-500 animate-ping'
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-zinc-900',
        text: 'text-slate-600 dark:text-zinc-400',
        border: 'border-slate-200 dark:border-zinc-800',
        badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-slate-400'
      };
  }
};
