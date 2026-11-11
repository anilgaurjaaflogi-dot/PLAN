import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border text-sm transition-all animate-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'bg-white dark:bg-slate-900 border-emerald-500/30 text-slate-900 dark:text-slate-100'
                : isError
                ? 'bg-white dark:bg-slate-900 border-rose-500/30 text-slate-900 dark:text-slate-100'
                : isWarning
                ? 'bg-white dark:bg-slate-900 border-amber-500/30 text-slate-900 dark:text-slate-100'
                : 'bg-white dark:bg-slate-900 border-sky-500/30 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-500" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-sky-500" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs leading-snug">{toast.title}</div>
              {toast.description && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {toast.description}
                </div>
              )}
            </div>

            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction!();
                  removeToast(toast.id);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950 rounded cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{toast.undoLabel || 'Undo'}</span>
              </button>
            )}

            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 p-0.5 rounded cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
