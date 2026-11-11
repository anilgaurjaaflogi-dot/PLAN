import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ToastContainer } from './components/Toast';
import { PrintModal } from './components/PrintModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { NewContainerModal } from './components/NewContainerModal';
import { DashboardPage } from './pages/DashboardPage';
import { LibraryPage } from './pages/LibraryPage';
import { SearchPage } from './pages/SearchPage';
import { BuilderPage } from './pages/BuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { Container } from './types';
import { UserX, ShieldAlert, LogOut } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    activePage,
    refreshContainers,
    printContainerData,
    setPrintContainerData,
    isUserBlocked,
    currentUser,
    signOutUser,
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newContainerModalOpen, setNewContainerModalOpen] = useState(false);
  const [editContainerData, setEditContainerData] = useState<Container | null>(null);

  const handleOpenEdit = (container: Container) => {
    setEditContainerData(container);
    setNewContainerModalOpen(true);
  };

  const handleCloseNewOrEdit = () => {
    setNewContainerModalOpen(false);
    setEditContainerData(null);
  };

  if (isUserBlocked) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-950 p-8 rounded-2xl border border-rose-900/60 shadow-2xl text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <UserX className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded">
              MADE BY ANIL GAUR
            </span>
            <h1 className="text-xl font-bold text-white mt-2">
              Access Revoked / Kicked Out
            </h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Aapka account administrator (<strong className="text-white">Anil Gaur</strong>) dwara block kar diya gaya hai.
            </p>
            <div className="mt-3 p-3 rounded-lg bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 font-mono">
              Contact Admin: 8076910181 <br />
              Email: anilgaurjaaflogi@gmail.com
            </div>
          </div>
          <button
            onClick={() => signOutUser()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onOpenNewContainerModal={() => {
            setEditContainerData(null);
            setNewContainerModalOpen(true);
          }}
          onOpenImportModal={() => setImportModalOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              onOpenImport={() => setImportModalOpen(true)}
              onOpenNewContainer={() => {
                setEditContainerData(null);
                setNewContainerModalOpen(true);
              }}
            />
          )}

          {activePage === 'library' && (
            <LibraryPage
              onOpenImport={() => setImportModalOpen(true)}
              onOpenNewContainer={() => {
                setEditContainerData(null);
                setNewContainerModalOpen(true);
              }}
              onEditContainer={handleOpenEdit}
            />
          )}

          {activePage === 'search' && <SearchPage />}

          {activePage === 'builder' && <BuilderPage />}

          {activePage === 'settings' && <SettingsPage />}

          {activePage === 'admin' && <AdminPage />}
        </main>

        {/* Global Footer with Made by Anil Gaur branding */}
        <footer className="py-3 px-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Container Plan Manager</span>
            <span>•</span>
            <span className="font-bold text-sky-600 dark:text-sky-400">MADE BY ANIL GAUR</span>
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            Japanese Used-Vehicle Export • Master PIN Protected (8076910181)
          </div>
        </footer>
      </div>

      {/* Global Modals & Notifications */}
      <ExcelImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportComplete={refreshContainers}
      />

      <NewContainerModal
        isOpen={newContainerModalOpen}
        onClose={handleCloseNewOrEdit}
        editContainer={editContainerData}
        onSaved={refreshContainers}
      />

      <PrintModal
        container={printContainerData}
        onClose={() => setPrintContainerData(null)}
      />

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
