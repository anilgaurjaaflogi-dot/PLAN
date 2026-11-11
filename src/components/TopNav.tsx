import React from 'react';
import { Menu, Plus, Upload, ShieldCheck, Cloud, RefreshCw, User, LogIn, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TopNavProps {
  onOpenMobileSidebar: () => void;
  onOpenNewContainerModal: () => void;
  onOpenImportModal: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  onOpenMobileSidebar,
  onOpenNewContainerModal,
  onOpenImportModal,
}) => {
  const {
    activePage,
    setActivePage,
    containers,
    isCloudConnected,
    cloudSyncStatus,
    currentUser,
    syncToCloud,
    signInWithGoogle,
    signOutUser,
  } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md">
      {/* Zone 1: Brand wordmark & mobile trigger */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 rounded-md"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            Container Plan Manager
          </span>
          <span className="hidden md:inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
            MADE BY ANIL GAUR
          </span>
        </div>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
        <button
          onClick={() => setActivePage('dashboard')}
          className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activePage === 'dashboard' ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => setActivePage('library')}
          className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activePage === 'library' ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
          }`}
        >
          Plan Library ({containers.length})
        </button>
        <button
          onClick={() => setActivePage('search')}
          className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activePage === 'search' ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
          }`}
        >
          Chassis & Model Search
        </button>
        <button
          onClick={() => setActivePage('builder')}
          className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
            activePage === 'builder' ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Plan Builder</span>
        </button>
        <button
          onClick={() => setActivePage('admin')}
          className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activePage === 'admin' ? 'text-sky-600 dark:text-sky-400 font-semibold' : ''
          }`}
        >
          Admin & Users
        </button>
      </nav>

      {/* Zone 3: Actions & Cloud Sync */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Firebase Cloud Sync Status */}
        <button
          onClick={() => syncToCloud()}
          disabled={cloudSyncStatus === 'syncing'}
          title={
            isCloudConnected
              ? 'Firebase Firestore is active. Click to backup all container plans to cloud.'
              : 'Firebase Cloud connecting...'
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            cloudSyncStatus === 'syncing'
              ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
              : isCloudConnected
              ? 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
        >
          {cloudSyncStatus === 'syncing' ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
          ) : (
            <div className="relative">
              <Cloud className="w-3.5 h-3.5 text-sky-500" />
              {isCloudConnected && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </div>
          )}
          <span className="hidden sm:inline">
            {cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Cloud Backup'}
          </span>
        </button>

        {/* User Auth Info / Sign In */}
        {currentUser ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'User'}
                className="w-5 h-5 rounded-full object-cover"
              />
            ) : (
              <User className="w-4 h-4 text-slate-500" />
            )}
            <span className="max-w-[100px] truncate text-[11px] font-medium" title={currentUser.email || ''}>
              {currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0]}
            </span>
            <button
              onClick={() => signOutUser()}
              title="Sign out from Firebase"
              className="p-1 hover:text-rose-500 rounded transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            title="Sign in with Google Account"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-slate-500" />
            <span>Google Login</span>
          </button>
        )}

        <button
          onClick={onOpenImportModal}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import Excel</span>
        </button>
        <button
          onClick={onOpenNewContainerModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Container</span>
        </button>
      </div>
    </header>
  );
};
