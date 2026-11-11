import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Database,
  Languages,
  Sun,
  Moon,
  Trash2,
  Download,
  Upload,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  RefreshCw,
  BookOpen,
  Cloud,
  LogIn,
  LogOut,
  Server,
} from 'lucide-react';
import { useApp, CONTAINER_PRESETS } from '../context/AppContext';
import { db, generateSyntheticContainers } from '../db/db';
import { exportDatabaseBackup } from '../utils/excelParser';
import { ConfirmModal } from '../components/ConfirmModal';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    containers,
    refreshContainers,
    addToast,
    isCloudConnected,
    cloudSyncStatus,
    currentUser,
    syncToCloud,
    syncFromCloud,
    signInWithGoogle,
    signOutUser,
  } = useApp();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState({ processed: 0, total: 0 });
  const [showClearModal, setShowClearModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'limits' | 'database' | 'readme'>('limits');

  const handleApplyPreset = (presetId: string) => {
    const preset = CONTAINER_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    updateSettings({
      activePresetId: preset.id,
      maxVehicles: preset.maxVehicles,
      maxCbm: preset.maxCbm,
      maxWeightKg: preset.maxWeightKg,
      maxLengthCm: preset.maxLengthCm,
    });

    addToast({
      type: 'info',
      title: 'Preset Applied',
      description: `Loaded limits for ${preset.name}`,
    });
  };

  const handleGenerateScaleData = async (count: number) => {
    setIsGenerating(true);
    setGenerateProgress({ processed: 0, total: count });

    try {
      await generateSyntheticContainers(count, (processed, total) => {
        setGenerateProgress({ processed, total });
      });
      await refreshContainers();

      addToast({
        type: 'success',
        title: 'Scale Data Generated',
        description: `Successfully seeded ${count} realistic export containers (${count * 4} vehicles) into IndexedDB.`,
      });
    } catch (err: any) {
      console.error(err);
      addToast({ type: 'error', title: 'Generation Failed', description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearDatabase = async () => {
    try {
      await db.transaction('rw', db.containers, db.vehicles, async () => {
        await db.containers.clear();
        await db.vehicles.clear();
      });
      await refreshContainers();
      addToast({
        type: 'warning',
        title: 'Database Cleared',
        description: 'All local container records have been deleted.',
      });
    } catch (err: any) {
      console.error(err);
      addToast({ type: 'error', title: 'Error clearing database', description: err.message });
    }
  };

  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.containers || !Array.isArray(parsed.containers)) {
          throw new Error('Invalid JSON backup file structure.');
        }

        for (const c of parsed.containers) {
          const { id, ...cleanContainer } = c;
          await db.containers.add(cleanContainer);
          if (c.vehicles && Array.isArray(c.vehicles)) {
            await db.vehicles.bulkAdd(c.vehicles);
          }
        }

        await refreshContainers();
        addToast({
          type: 'success',
          title: 'Backup Restored',
          description: `Imported ${parsed.containers.length} containers from JSON backup.`,
        });
      } catch (err: any) {
        console.error(err);
        addToast({ type: 'error', title: 'Restore Failed', description: err.message });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>Settings & Specifications</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            System Preferences
          </span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {settings.showHinglish
            ? 'Container limits, presets, scale testing aur database backup'
            : 'Configure container loading constraints, language helpers, and offline IndexedDB archive'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab('limits')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'limits'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Container Constraints & Presets</span>
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'database'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Offline Database & Scale</span>
        </button>
        <button
          onClick={() => setActiveTab('readme')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'readme'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>How It Works (README)</span>
        </button>
      </div>

      {/* TAB 1: Container Limits & Presets */}
      {activeTab === 'limits' && (
        <div className="space-y-6">
          {/* Preset Buttons */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Container Type Presets
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {CONTAINER_PRESETS.map((preset) => {
                const isActive = settings.activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40 ring-1 ring-sky-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {preset.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">{preset.description}</p>
                    <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 space-y-0.5">
                      <div>Max Volume: <strong>{preset.maxCbm} CBM</strong></div>
                      <div>Max Weight: <strong>{preset.maxWeightKg.toLocaleString()} kg</strong></div>
                      <div>Max Units: <strong>{preset.maxVehicles} Vehicles</strong></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Editable Limits */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Custom Container Limits (Editable)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Volume Limit (CBM)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.maxCbm}
                  onChange={(e) => updateSettings({ maxCbm: parseFloat(e.target.value) || 76.0 })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 dark:text-sky-400"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default 76.0 for 40HC</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Cargo Weight (kg)
                </label>
                <input
                  type="number"
                  step="500"
                  value={settings.maxWeightKg}
                  onChange={(e) => updateSettings({ maxWeightKg: parseInt(e.target.value) || 26500 })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default 26,500 kg payload</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Vehicles per Container
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxVehicles}
                  onChange={(e) => updateSettings({ maxVehicles: parseInt(e.target.value) || 4 })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Default 4 vehicles</span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Combined Length (cm)
                </label>
                <input
                  type="number"
                  value={settings.maxLengthCm}
                  onChange={(e) => updateSettings({ maxLengthCm: parseInt(e.target.value) || 2400 })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Container internal length ~1200cm (double deck)</span>
              </div>
            </div>
          </div>

          {/* Interface Preferences */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Language & Theme
            </h2>
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showHinglish}
                  onChange={(e) => updateSettings({ showHinglish: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Enable Hindi / Hinglish Helper Labels
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Shows Hindi / Hinglish hints next to English fields (e.g. 'Container No / कंटेनर नंबर')
                  </div>
                </div>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Theme:</span>
                <button
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    settings.theme === 'light'
                      ? 'border-sky-500 bg-sky-50 text-sky-700'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'border-sky-500 bg-sky-950 text-sky-300'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Database Management & 1000+ Scale Simulation */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          {/* Current Database Status */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span>IndexedDB Storage Status</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold">
                Dexie v4 • Client Offline
              </span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Total Containers</span>
                <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                  {containers.length}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Vehicle Rows</span>
                <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tabular-nums">
                  {containers.reduce((acc, c) => acc + (c.vehicleCount || c.vehicles?.length || 0), 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Distinct Models</span>
                <span className="font-mono font-bold text-base text-sky-600 dark:text-sky-400 tabular-nums">
                  {Array.from(new Set(containers.flatMap((c) => c.models))).length}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Distinct Prefixes</span>
                <span className="font-mono font-bold text-base text-sky-600 dark:text-sky-400 tabular-nums">
                  {Array.from(new Set(containers.flatMap((c) => c.chassisPrefixes))).length}
                </span>
              </div>
            </div>
          </div>

          {/* Google Firebase Firestore Card */}
          <div className="p-5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-br from-sky-50/50 to-white dark:from-sky-950/20 dark:to-slate-900 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-100 dark:border-sky-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Google Firebase Cloud Storage</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-300">
                      firebase.google.com
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Cloud database persistence for multi-device sync, permanent backup, and team access.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
                    isCloudConnected
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCloudConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <span>{isCloudConnected ? 'LIVE CONNECTED' : 'OFFLINE / RECONNECTING'}</span>
                </span>
              </div>
            </div>

            {/* Cloud Configuration Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Firebase Project</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate block">
                  gen-lang-client-0369401165
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Firestore Database</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate block">
                  ai-studio-containerplanman...
                </span>
              </div>

              <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Security Rules</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Deployed & Active</span>
                </span>
              </div>
            </div>

            {/* User Account / Auth Section */}
            <div className="p-3 rounded-lg bg-white/80 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  Firebase User Authentication
                </span>
                <p className="text-[11px] text-slate-500">
                  {currentUser
                    ? `Logged in as ${currentUser.displayName || currentUser.email} (${currentUser.email})`
                    : 'Sign in with your Google account to access your cloud-synced container plans.'}
                </p>
              </div>

              <div>
                {currentUser ? (
                  <button
                    onClick={() => signOutUser()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <button
                    onClick={() => signInWithGoogle()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-xs"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In with Google</span>
                  </button>
                )}
              </div>
            </div>

            {/* Manual Sync Controls */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => syncToCloud()}
                disabled={cloudSyncStatus === 'syncing'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-xs disabled:opacity-50"
              >
                {cloudSyncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span>
                  {cloudSyncStatus === 'syncing'
                    ? 'Syncing to Cloud...'
                    : `Upload All Local Plans (${containers.length}) to Firebase`}
                </span>
              </button>

              <button
                onClick={() => syncFromCloud()}
                disabled={cloudSyncStatus === 'syncing'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-sky-500" />
                <span>Pull Records from Firebase Cloud</span>
              </button>
            </div>
          </div>

          {/* Scale Test Generators (Simulate 1000+ Plans) */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-500" />
                <span>Simulate 1000+ Container Scale</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Instantly populate your IndexedDB with realistic Japanese used vehicle container plans (ELF, CANTER, HIACE, WISH, RUMION, DYNA, DUTRO, etc.) to verify search performance, indexing, and charts at high volume.
              </p>
            </div>

            {isGenerating ? (
              <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-center space-y-2">
                <div className="text-xs font-bold text-sky-800 dark:text-sky-200 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Writing to IndexedDB: {generateProgress.processed} / {generateProgress.total} Containers...</span>
                </div>
                <div className="w-full max-w-sm mx-auto h-2 bg-sky-200 dark:bg-sky-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-600 rounded-full"
                    style={{
                      width: `${(generateProgress.processed / generateProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleGenerateScaleData(25)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-900 dark:text-slate-100 cursor-pointer shadow-xs"
                >
                  + Generate 25 Containers (100 Vehicles)
                </button>
                <button
                  onClick={() => handleGenerateScaleData(250)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-xs"
                >
                  + Generate 250 Containers (1,000 Vehicles)
                </button>
                <button
                  onClick={() => handleGenerateScaleData(500)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs"
                >
                  + Generate 500 Containers (2,000 Vehicles)
                </button>
              </div>
            )}
          </div>

          {/* Backup & Restore JSON */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Full Archive Backup & Restore
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => exportDatabaseBackup(containers)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-sky-500" />
                <span>Download Full JSON Backup</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs">
                <Upload className="w-3.5 h-3.5 text-emerald-500" />
                <span>Restore from JSON File</span>
                <input type="file" accept=".json" onChange={handleRestoreJsonBackup} className="hidden" />
              </label>

              <button
                onClick={() => setShowClearModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg border border-rose-300 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-auto cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: README & Documentation */}
      {activeTab === 'readme' && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Container Plan Manager (Japanese Used Vehicle Export)
            </h2>
            <p className="text-slate-500">
              Technical documentation on Excel importing, chassis parsing, and the 3-phase automated planning engine.
            </p>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              1. How the Stacked Block Excel Importer Works
            </h3>
            <p>
              In Japanese yard operations, shipping manifests are often formatted in stacked 4-row blocks:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
              <li><strong>Row 1:</strong> Column A = Container Number (e.g. MSKU0113466), Columns B–P = Vehicle 1 columns</li>
              <li><strong>Row 2:</strong> Column A = Seal / BL Number (e.g. ML-JP0409806), Columns B–P = Vehicle 2 columns</li>
              <li><strong>Row 3:</strong> Column A = Extra / Tare Value (e.g. 4000), Columns B–P = Vehicle 3 columns</li>
              <li><strong>Row 4:</strong> Column A = (blank or empty), Columns B–P = Vehicle 4 columns</li>
              <li><strong>Row 5:</strong> Blank separator line between containers</li>
            </ul>
            <p>
              The built-in parser automatically detects this layout as well as flat multi-row formats, extracts all 15 vehicle attributes, calculates CBM as <code>L × W × H ÷ 1,000,000</code>, and flags any discrepancy between recorded CBM and mathematical CBM.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              2. Smart Chassis Prefix Extraction
            </h3>
            <p>
              Chassis numbers are parsed with smart regex heuristics:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
              <li>If hyphenated (<code>KDH206-8053689</code>), the prefix is <code>KDH206</code>.</li>
              <li>If non-hyphenated (<code>NPR58P7106494</code>), the trailing production serial number (6–7 digits) is stripped, yielding <code>NPR58P</code>.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              3. Strict Historical Plan Verification (Zero AI / Zero Predictions)
            </h3>
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              ✓ Jo aap old plans upload karte hain, sirf unhi plans se match check hokar naya container banta hai aur confirm hota hai:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-[11px]">
              <li>
                <strong>Level 1 (Exact Model + Chassis Prefix Match):</strong> Checks your uploaded database for exact chassis code matches (e.g., ELF [NKR61E] + RUMION [ZRE152] + ELF [NPR58P] + HIACE [KDH206]).
              </li>
              <li>
                <strong>Level 2 (Exact Historical Model Combination Match):</strong> Checks uploaded plans for proven 4-vehicle multiset combinations.
              </li>
              <li>
                <strong>Strict Unmatched Safety:</strong> Koi prediction ya synthetic guess nahi hota. Agar kisi gaadi ka purana combination uploaded records me nahi hai, toh vo Unmatched Vehicles me rehti hai taaki aap sirf 100% verified plans hi confirm karein.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      <ConfirmModal
        isOpen={showClearModal}
        title="Clear Entire Container Database?"
        message="This will delete all containers and vehicle manifests stored in local IndexedDB. Ensure you have exported a JSON backup first if you need this data."
        confirmLabel="Yes, Clear All Data"
        isDestructive={true}
        onConfirm={handleClearDatabase}
        onCancel={() => setShowClearModal(false)}
      />
    </div>
  );
};
