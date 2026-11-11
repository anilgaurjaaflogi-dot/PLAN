import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  ChevronDown,
  ChevronUp,
  Printer,
  Copy,
  Trash2,
  Edit2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { Container, Vehicle } from '../types';
import { useApp } from '../context/AppContext';
import { deleteContainer, addContainerWithVehicles } from '../db/db';
import { saveContainerToFirestore, deleteContainerFromFirestore } from '../firebase/firestoreService';
import { exportContainersToExcel } from '../utils/excelParser';
import { formatContainerForWhatsApp, copyToClipboard } from '../utils/whatsappFormatter';

interface LibraryPageProps {
  onOpenImport: () => void;
  onOpenNewContainer: () => void;
  onEditContainer: (c: Container) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  onOpenImport,
  onOpenNewContainer,
  onEditContainer,
}) => {
  const {
    containers,
    refreshContainers,
    addToast,
    settings,
    transferContainerToBuilder,
    setPrintContainerData,
    requestPasswordProtectedAction,
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedFuel, setSelectedFuel] = useState('');
  const [cbmRange, setCbmRange] = useState<'all' | 'under60' | '60to75' | 'over75'>('all');
  const [expandedContainerIds, setExpandedContainerIds] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'cbm' | 'weight' | 'containerNo'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Distinct values for filter dropdowns
  const availableMakes = useMemo(() => {
    const s = new Set<string>();
    containers.forEach((c) => c.vehicles.forEach((v) => v.make && s.add(v.make.toUpperCase())));
    return Array.from(s).sort();
  }, [containers]);

  const availableModels = useMemo(() => {
    const s = new Set<string>();
    containers.forEach((c) => c.vehicles.forEach((v) => v.model && s.add(v.model.toUpperCase())));
    return Array.from(s).sort();
  }, [containers]);

  // Filtered & Sorted containers
  const filteredContainers = useMemo(() => {
    return containers.filter((c) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase().trim();
        const cNoMatch = c.containerNo.toUpperCase().includes(q);
        const sealMatch = c.sealOrBlNo?.toUpperCase().includes(q);
        const modelMatch = c.models?.some((m) => m.toUpperCase().includes(q));
        const chassisMatch = c.vehicles.some(
          (v) => v.chassisNo?.toUpperCase().includes(q) || v.chassisPrefix?.toUpperCase().includes(q)
        );
        if (!cNoMatch && !sealMatch && !modelMatch && !chassisMatch) return false;
      }

      // Make filter
      if (selectedMake && !c.vehicles.some((v) => v.make?.toUpperCase() === selectedMake)) {
        return false;
      }

      // Model filter
      if (selectedModel && !c.models?.some((m) => m.toUpperCase() === selectedModel)) {
        return false;
      }

      // Fuel filter
      if (selectedFuel && !c.vehicles.some((v) => v.fuel?.toUpperCase() === selectedFuel)) {
        return false;
      }

      // CBM Range filter
      if (cbmRange === 'under60' && c.totalCbm >= 60) return false;
      if (cbmRange === '60to75' && (c.totalCbm < 60 || c.totalCbm > 75)) return false;
      if (cbmRange === 'over75' && c.totalCbm <= 75) return false;

      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortBy === 'date') comp = (a.createdAt || 0) - (b.createdAt || 0);
      else if (sortBy === 'cbm') comp = a.totalCbm - b.totalCbm;
      else if (sortBy === 'weight') comp = a.totalWeight - b.totalWeight;
      else if (sortBy === 'containerNo') comp = a.containerNo.localeCompare(b.containerNo);
      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [containers, searchQuery, selectedMake, selectedModel, selectedFuel, cbmRange, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredContainers.length / pageSize) || 1;
  const paginatedContainers = filteredContainers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleExpand = (id: number) => {
    setExpandedContainerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedContainerIds(new Set(paginatedContainers.map((c) => c.id!).filter(Boolean)));
  };

  const collapseAll = () => {
    setExpandedContainerIds(new Set());
  };

  const handleDeleteContainer = async (c: Container) => {
    if (!c.id) return;
    const backupContainer = { ...c };
    await deleteContainer(c.id);
    deleteContainerFromFirestore(c.containerNo).catch((e) => console.warn('Firestore sync note:', e));
    await refreshContainers();

    addToast({
      type: 'info',
      title: 'Container Deleted',
      description: `Container ${c.containerNo} has been removed.`,
      undoLabel: 'Undo Delete',
      undoAction: async () => {
        await addContainerWithVehicles(backupContainer);
        saveContainerToFirestore(backupContainer).catch((e) => console.warn('Firestore sync note:', e));
        await refreshContainers();
        addToast({
          type: 'success',
          title: 'Container Restored',
          description: `Container ${backupContainer.containerNo} restored.`,
        });
      },
    });
  };

  const handleDuplicateContainer = async (c: Container) => {
    const dup: Container = {
      ...c,
      id: undefined,
      containerNo: `${c.containerNo}-COPY`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      vehicles: c.vehicles.map((v) => ({
        ...v,
        id: `v-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        containerNo: `${c.containerNo}-COPY`,
      })),
    };
    await addContainerWithVehicles(dup);
    saveContainerToFirestore(dup).catch((e) => console.warn('Firestore sync note:', e));
    await refreshContainers();
    addToast({
      type: 'success',
      title: 'Container Duplicated',
      description: `Created copy: ${dup.containerNo}`,
    });
  };

  const handleExportAllToExcel = () => {
    if (containers.length === 0) {
      addToast({ type: 'warning', title: 'No containers to export' });
      return;
    }

    requestPasswordProtectedAction(
      () => {
        exportContainersToExcel(containers, `Container_Plans_All_${new Date().toISOString().slice(0, 10)}.xlsx`);
        addToast({
          type: 'success',
          title: 'Excel Export Ready',
          description: `Exported ${containers.length} containers in authentic stacked layout.`,
        });
      },
      'Master Password Required for Excel Download',
      'Container plans are restricted. Enter master password (8076910181) to download Excel file.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Container Plan Library</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              {containers.length} Plans
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.showHinglish
              ? 'Konteynar Plans Sangrah • Expand karke 4 gaadiyan dekhein, edit karein ya export karein'
              : 'Complete repository of historical shipping container vanning manifests and specs'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenImport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-sky-500" />
            <span>Import Excel</span>
          </button>
          <button
            onClick={handleExportAllToExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
            title="Export all containers in authentic stacked block layout"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export All ({containers.length})</span>
          </button>
          <button
            onClick={onOpenNewContainer}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Container</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Main search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Container No, Seal, Model (e.g. ELF, HIACE), or Chassis Prefix..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Make Dropdown */}
          <select
            value={selectedMake}
            onChange={(e) => {
              setSelectedMake(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="">All Makes</option>
            {availableMakes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Model Dropdown */}
          <select
            value={selectedModel}
            onChange={(e) => {
              setSelectedModel(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="">All Models</option>
            {availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Fuel Dropdown */}
          <select
            value={selectedFuel}
            onChange={(e) => {
              setSelectedFuel(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="">All Fuel</option>
            <option value="D">Diesel (D)</option>
            <option value="G">Petrol / Gas (G)</option>
            <option value="H">Hybrid (H)</option>
          </select>

          {/* CBM Range */}
          <select
            value={cbmRange}
            onChange={(e) => {
              setCbmRange(e.target.value as any);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All CBM</option>
            <option value="under60">&lt; 60 CBM (Light)</option>
            <option value="60to75">60 - 75 CBM (Standard)</option>
            <option value="over75">&gt; 75 CBM (High Fill)</option>
          </select>
        </div>

        {/* View Controls & Quick Expand */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-3 text-slate-500">
            <span>
              Showing <strong>{filteredContainers.length}</strong> matching containers
            </span>
            <span aria-hidden="true">·</span>
            <button onClick={expandAll} className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer">
              Expand Page
            </button>
            <span aria-hidden="true">·</span>
            <button onClick={collapseAll} className="text-slate-500 hover:underline cursor-pointer">
              Collapse Page
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Sort controls */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="date">Date Added</option>
                <option value="cbm">Total CBM</option>
                <option value="weight">Total Weight</option>
                <option value="containerNo">Container No</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Containers List / Empty State */}
      {filteredContainers.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              No matching container plans found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery || selectedMake || selectedModel || selectedFuel || cbmRange !== 'all'
                ? 'Try adjusting your search filters above.'
                : 'Import your Excel container plans or add your first container plan manually.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenImport}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
            >
              Import Excel File
            </button>
            <button
              onClick={onOpenNewContainer}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Add Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedContainers.map((container) => {
            const isExpanded = container.id ? expandedContainerIds.has(container.id) : false;
            const cbmFill = Math.min(Math.round((container.totalCbm / 76) * 100), 120);

            // Group vehicles by model with exact counts (e.g. 2x HIACE, 1x CANTER, 1x WISH)
            const modelCounts = container.vehicles.reduce((acc, v) => {
              const name = (v.model || 'UNKNOWN').trim().toUpperCase();
              acc[name] = (acc[name] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

            return (
              <div
                key={container.id || container.containerNo}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all"
              >
                {/* Container Summary Card Header */}
                <div
                  onClick={() => container.id && toggleExpand(container.id)}
                  className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 select-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                          {container.containerNo}
                        </span>

                        {/* Total Vehicles Count Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          {container.vehicles.length || container.vehicleCount} Vehicles / गाड़ियाँ
                        </span>

                        {container.sealOrBlNo && (
                          <span className="text-xs text-slate-500 font-mono">
                            • Seal: {container.sealOrBlNo}
                          </span>
                        )}
                        {container.extraValue ? (
                          <span className="text-[11px] text-slate-400 font-mono">
                            • Tare: {container.extraValue} kg
                          </span>
                        ) : null}
                      </div>

                      {/* Model tags with exact counts (e.g. 2x HIACE, 1x CANTER) visible from outside */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {Object.entries(modelCounts).map(([modelName, count], idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700"
                          >
                            <span className="font-bold text-sky-600 dark:text-sky-400">{count}x</span>
                            <span>{modelName}</span>
                          </span>
                        ))}
                      </div>

                      {/* Remark pill if present */}
                      {(container.remark || container.notes) && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/60 w-fit">
                          <span className="font-semibold uppercase tracking-wider text-[10px]">Remark / टिप्पणी:</span>
                          <span className="font-sans font-medium">{container.remark || container.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side KPI strip and quick action buttons */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono shrink-0 ml-auto md:ml-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400 font-sans">Volume</div>
                      <div className="font-bold text-sky-600 dark:text-sky-400 tabular-nums text-sm">
                        {container.totalCbm.toFixed(3)} m³
                      </div>
                      <div className="text-[10px] text-slate-400">{cbmFill}% of 40HC</div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400 font-sans">Weight</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums text-sm">
                        {container.totalWeight.toLocaleString()} kg
                      </div>
                      <div className="text-[10px] text-slate-400">{container.vehicles.length} Units</div>
                    </div>

                    {container.totalPrice > 0 && (
                      <div className="text-right hidden sm:block">
                        <div className="text-[11px] text-slate-400 font-sans">Value</div>
                        <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums text-sm">
                          ¥{container.totalPrice.toLocaleString()}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div
                      className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => transferContainerToBuilder(container)}
                        title="Check combo in Plan Builder"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPrintContainerData(container)}
                        title="Print / Save PDF loading sheet"
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const msg = formatContainerForWhatsApp(container);
                          await copyToClipboard(msg);
                          addToast({ type: 'success', title: 'Copied for WhatsApp' });
                        }}
                        title="Copy for WhatsApp"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded cursor-pointer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditContainer(container)}
                        title="Edit container details"
                        className="p-1.5 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContainer(container)}
                        title="Delete container (with Undo)"
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Vehicle Details Table */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                          <th className="py-2 px-2 text-center w-8">#</th>
                          <th className="py-2 px-3">Make / Model</th>
                          <th className="py-2 px-3">Chassis No</th>
                          <th className="py-2 px-2">Prefix</th>
                          <th className="py-2 px-2 text-center">Fuel</th>
                          <th className="py-2 px-2 text-center">Year</th>
                          <th className="py-2 px-3 text-right">L × W × H (cm)</th>
                          <th className="py-2 px-3 text-right">Weight (kg)</th>
                          <th className="py-2 px-3 text-right">CBM (m³)</th>
                          <th className="py-2 px-3 text-right">Price (JPY)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                        {container.vehicles.map((v, idx) => (
                          <tr key={v.id || idx} className="hover:bg-white/80 dark:hover:bg-slate-900/60">
                            <td className="py-2 px-2 text-center font-semibold text-slate-400">
                              {v.serialNo || idx + 1}
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {v.make} {v.model}
                              </span>
                              {v.vehicleIdNo && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  ID: {v.vehicleIdNo}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                              {v.chassisNo}
                            </td>
                            <td className="py-2 px-2 font-bold text-sky-600 dark:text-sky-400">
                              {v.chassisPrefix}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  v.fuel === 'D'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                }`}
                              >
                                {v.fuel}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-center">{v.year || '-'}</td>
                            <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                              {v.length}×{v.width}×{v.height}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                              {v.weight?.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                              <div className="flex items-center justify-end gap-1">
                                {v.cbmMismatch && (
                                  <span title={`Sheet CBM ${v.cbm} differs from calculated ${v.calculatedCbm}`}>
                                    <AlertTriangle className="w-3 h-3 text-amber-500 inline" />
                                  </span>
                                )}
                                <span>{v.cbm?.toFixed(3)}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {v.price ? `¥${v.price.toLocaleString()}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="text-slate-500 text-[11px]">
                        Created: {new Date(container.createdAt || Date.now()).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDuplicateContainer(container)}
                          className="text-slate-600 dark:text-slate-400 hover:text-sky-600 cursor-pointer text-xs"
                        >
                          Duplicate Container Plan
                        </button>
                        <span aria-hidden="true" className="text-slate-300">|</span>
                        <button
                          onClick={() => onEditContainer(container)}
                          className="text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer text-xs"
                        >
                          Edit Details & Dimensions
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
              <span className="text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
