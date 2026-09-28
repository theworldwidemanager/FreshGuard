import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const ConnectionStatus = ({ backendError, onRetry }) => {
  if (!backendError) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800/50 dark:text-amber-200 px-4 py-3 rounded-xl mb-6 flex items-center justify-between text-xs sm:text-sm transition-colors">
      <div className="flex items-center space-x-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span>{backendError}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-1 font-semibold text-amber-900 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100 underline ml-3 flex-shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

export default ConnectionStatus;
