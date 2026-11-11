import React, { useState } from 'react';
import { Lock, X, ShieldAlert, KeyRound, Check } from 'lucide-react';

interface PasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const MASTER_EXCEL_PASSWORD = '8076910181';

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'Master Password Required for Excel Download',
  description = 'Container plans are protected. Enter master password (8076910181) to download Excel.',
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim() === MASTER_EXCEL_PASSWORD) {
      setError(false);
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setError(true);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Security Verification
              </h3>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Protected Action
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 mb-1">
              {title}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              {description}
            </p>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
              एक्सेल डाउनलोड करने के लिए मास्टर पासवर्ड दर्ज करें।
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Enter Master Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                autoFocus
                placeholder="Enter password..."
                className={`w-full pl-9 pr-16 py-2.5 text-sm font-mono rounded-lg border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none transition-all ${
                  error
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                }`}
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded cursor-pointer font-sans"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium pt-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Incorrect Master Password! Access denied. / गलत पासवर्ड!</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Verify & Download</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
