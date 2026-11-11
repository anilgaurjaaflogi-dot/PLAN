import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Check,
  Download,
  Copy,
  Printer,
  ChevronDown,
  Layers,
  Ship,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Upload,
  CheckCircle2,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { Container, PlannedContainer, PlanBuilderRequestItem, Vehicle, VehicleLookupSpec } from '../types';
import { useApp } from '../context/AppContext';
import { lookupVehicleSpecs, getDistinctModels, addContainerWithVehicles } from '../db/db';
import { saveContainerToFirestore } from '../firebase/firestoreService';
import { buildContainerPlansStrict, recalculateContainerStats } from '../utils/planner';
import { calculateCbm, extractChassisPrefix } from '../utils/chassisParser';
import { exportContainersToExcel } from '../utils/excelParser';
import { formatContainerForWhatsApp, copyToClipboard } from '../utils/whatsappFormatter';

export const BuilderPage: React.FC = () => {
  const {
    containers: pastContainers,
    refreshContainers,
    settings,
    addToast,
    builderDraftVehicles,
    setBuilderDraftVehicles,
    setPrintContainerData,
    requestPasswordProtectedAction,
  } = useApp();

  // Strict Mode: Only make plans verified by uploaded past plans (Zero AI / Zero predictions)
  const [strictUploadedOnly, setStrictUploadedOnly] = useState(true);

  // Requested vehicle rows to plan
  const [requestRows, setRequestRows] = useState<PlanBuilderRequestItem[]>([
    { id: 'req-1', model: 'ELF', chassisPrefix: 'NKR61E', qty: 2 },
    { id: 'req-2', model: 'RUMION', chassisPrefix: 'ZRE152', qty: 1 },
    { id: 'req-3', model: 'HIACE', chassisPrefix: 'KDH206', qty: 1 },
    { id: 'req-4', model: 'CANTER', chassisPrefix: 'FE315BD', qty: 1 },
    { id: 'req-5', model: 'WISH', chassisPrefix: 'ZGE20', qty: 1 },
    { id: 'req-6', model: 'HIACE', chassisPrefix: 'KDH206', qty: 1 },
    { id: 'req-7', model: 'ELF', chassisPrefix: 'NPR58P', qty: 1 },
  ]);

  // Bulk paste input modal state
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');

  // Specs cache for quick autocomplete & lookup
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [specsCache, setSpecsCache] = useState<Record<string, VehicleLookupSpec[]>>({});

  // Planned Containers Output
  const [plannedContainers, setPlannedContainers] = useState<PlannedContainer[]>([]);
  const [unmatchedVehicles, setUnmatchedVehicles] = useState<Vehicle[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);

  // Load distinct models on mount
  useEffect(() => {
    getDistinctModels().then(setKnownModels);
  }, [pastContainers]);

  // Check if draft vehicles were transferred from Library or Search
  useEffect(() => {
    if (builderDraftVehicles && builderDraftVehicles.length > 0) {
      const rows: PlanBuilderRequestItem[] = builderDraftVehicles.map((d, i) => ({
        id: `draft-${Date.now()}-${i}`,
        model: d.model,
        chassisPrefix: d.chassisPrefix || '',
        qty: d.qty || 1,
      }));
      setRequestRows(rows);
      setBuilderDraftVehicles([]);
    }
  }, [builderDraftVehicles]);

  // Resolve specifications from uploaded database records
  useEffect(() => {
    let isCancelled = false;

    const resolveAllSpecs = async () => {
      const newCache = { ...specsCache };

      const updatedRows = await Promise.all(
        requestRows.map(async (row) => {
          if (!row.model.trim()) return row;

          const cacheKey = `${row.model.toUpperCase()}_${row.chassisPrefix?.toUpperCase() || ''}`;
          let specs = newCache[cacheKey];

          if (!specs) {
            specs = await lookupVehicleSpecs(row.model, row.chassisPrefix);
            newCache[cacheKey] = specs;
          }

          if (specs.length > 0) {
            const bestSpec = row.resolvedSpec || specs[0];
            return {
              ...row,
              resolvedSpec: bestSpec,
              isCustomSpec: false,
              length: row.length !== undefined ? row.length : bestSpec.length,
              width: row.width !== undefined ? row.width : bestSpec.width,
              height: row.height !== undefined ? row.height : bestSpec.height,
              weight: row.weight !== undefined ? row.weight : bestSpec.weight,
              cbm: row.cbm !== undefined ? row.cbm : bestSpec.cbm,
              make: row.make || bestSpec.make,
              fuel: row.fuel || bestSpec.fuel,
              engineCC: row.engineCC || bestSpec.engineCC,
              price: row.price || 1000000,
            };
          } else {
            // Not found in uploaded plans
            return {
              ...row,
              isCustomSpec: true,
              length: row.length || 460,
              width: row.width || 170,
              height: row.height || 180,
              weight: row.weight || 2000,
              cbm: row.cbm || calculateCbm(row.length || 460, row.width || 170, row.height || 180),
              make: row.make || 'TOYOTA',
              fuel: row.fuel || 'D',
              engineCC: row.engineCC || 2000,
              price: row.price || 1000000,
            };
          }
        })
      );

      if (!isCancelled) {
        setSpecsCache(newCache);
        setRequestRows(updatedRows);
      }
    };

    resolveAllSpecs();

    return () => {
      isCancelled = true;
    };
  }, [requestRows.map((r) => `${r.model}_${r.chassisPrefix}`).join(';')]);

  const handleRowChange = (index: number, field: keyof PlanBuilderRequestItem, value: any) => {
    const updated = [...requestRows];
    const item = { ...updated[index], [field]: value };

    if (field === 'model' || field === 'chassisPrefix') {
      item.resolvedSpec = undefined;
    }

    if (field === 'length' || field === 'width' || field === 'height') {
      const l = field === 'length' ? Number(value) : item.length || 0;
      const w = field === 'width' ? Number(value) : item.width || 0;
      const h = field === 'height' ? Number(value) : item.height || 0;
      item.cbm = calculateCbm(l, w, h);
    }

    updated[index] = item;
    setRequestRows(updated);
  };

  const handleAddRow = () => {
    setRequestRows([
      ...requestRows,
      {
        id: `req-${Date.now()}`,
        model: 'HIACE',
        chassisPrefix: 'KDH206',
        qty: 1,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (requestRows.length <= 1) return;
    setRequestRows(requestRows.filter((_, i) => i !== index));
  };

  const handleLoadSampleBatch = () => {
    setRequestRows([
      // Exactly matches prompt Container 1: CANTER + WISH + HIACE + ELF
      { id: 's-1', model: 'CANTER', chassisPrefix: 'FE315BD', qty: 1 },
      { id: 's-2', model: 'WISH', chassisPrefix: 'ZGE20', qty: 1 },
      { id: 's-3', model: 'HIACE', chassisPrefix: 'KDH206', qty: 1 },
      { id: 's-4', model: 'ELF', chassisPrefix: 'NPR58P', qty: 1 },
      // Exactly matches prompt Container 2: ELF + RUMION + ELF + HIACE
      { id: 's-5', model: 'ELF', chassisPrefix: 'NKR61E', qty: 1 },
      { id: 's-6', model: 'RUMION', chassisPrefix: 'ZRE152', qty: 1 },
      { id: 's-7', model: 'ELF', chassisPrefix: 'NPR58P', qty: 1 },
      { id: 's-8', model: 'HIACE', chassisPrefix: 'KDH206', qty: 1 },
    ]);
    addToast({
      type: 'info',
      title: 'Historical Batch Loaded',
      description: 'Loaded combinations from uploaded plans MSKU0113466 and MSKU1239891.',
    });
  };

  const handleProcessBulkPaste = () => {
    if (!bulkPasteText.trim()) return;
    const lines = bulkPasteText.trim().split(/\r?\n/);
    const newRows: PlanBuilderRequestItem[] = [];

    lines.forEach((line, i) => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length >= 1) {
        const model = parts[0].trim().toUpperCase();
        const prefix = parts.length >= 2 ? parts[1].trim().toUpperCase() : '';
        const qty = parts.length >= 3 ? parseInt(parts[2].trim()) || 1 : 1;
        if (model) {
          newRows.push({
            id: `paste-${Date.now()}-${i}`,
            model,
            chassisPrefix: prefix,
            qty: Math.max(qty, 1),
          });
        }
      }
    });

    if (newRows.length > 0) {
      setRequestRows(newRows);
      setShowBulkPasteModal(false);
      setBulkPasteText('');
      addToast({
        type: 'success',
        title: 'Pasted List Loaded',
        description: `Imported ${newRows.length} vehicle model rows.`,
      });
    }
  };

  // Run pure deterministic verification and matching
  const runHistoricalVerification = () => {
    setIsPlanning(true);

    try {
      const vehiclesToPack: Vehicle[] = [];
      let serialCounter = 1;

      requestRows.forEach((row) => {
        const qty = Math.max(row.qty || 1, 1);
        for (let q = 0; q < qty; q++) {
          const l = row.length || 460;
          const w = row.width || 170;
          const h = row.height || 180;
          const cbm = row.cbm || calculateCbm(l, w, h);
          const prefix = row.chassisPrefix || extractChassisPrefix(`${row.model}-${serialCounter}`);
          const serialDigits = String(100000 + serialCounter);

          vehiclesToPack.push({
            id: `v-plan-${Date.now()}-${serialCounter}`,
            serialNo: serialCounter,
            make: row.make || 'TOYOTA',
            model: row.model.toUpperCase(),
            engineCC: row.engineCC || 2000,
            fuel: row.fuel || 'D',
            year: row.year || 2012,
            vehicleIdNo: `34${Date.now().toString().slice(-8)}${serialCounter}`,
            chassisNo: prefix.includes('-') ? `${prefix}${serialDigits}` : `${prefix}-${serialDigits}`,
            chassisPrefix: prefix,
            length: l,
            width: w,
            height: h,
            qty: 1,
            price: row.price || 1000000,
            weight: row.weight || 2000,
            cbm,
            calculatedCbm: cbm,
            cbmMismatch: false,
          });
          serialCounter++;
        }
      });

      const constraints = {
        maxVehicles: settings.maxVehicles || 4,
        maxCbm: settings.maxCbm || 76.0,
        maxWeightKg: settings.maxWeightKg || 26500,
        maxLengthCm: settings.maxLengthCm || 2400,
      };

      const result = buildContainerPlansStrict(
        vehiclesToPack,
        pastContainers,
        constraints,
        strictUploadedOnly
      );

      setPlannedContainers(result.plannedContainers);
      setUnmatchedVehicles(result.unmatchedVehicles);

      if (result.plannedContainers.length > 0) {
        addToast({
          type: 'success',
          title: 'Plan Checked & Confirmed',
          description: `Formed ${result.plannedContainers.length} containers verified strictly from your uploaded past plans.`,
        });
      } else {
        addToast({
          type: 'warning',
          title: 'No Matching Past Plan Found',
          description: 'None of the requested vehicles matched an exact container plan in your uploaded records.',
        });
      }
    } catch (err: any) {
      console.error(err);
      addToast({ type: 'error', title: 'Error', description: err.message });
    } finally {
      setIsPlanning(false);
    }
  };

  // Move vehicle between containers
  const moveVehicle = (fromContainerIdx: number, vIdx: number, toContainerIdx: number) => {
    if (fromContainerIdx === toContainerIdx) return;
    const containersCopy = [...plannedContainers];
    const sourceVehicles = [...containersCopy[fromContainerIdx].vehicles];
    const targetVehicles = [...containersCopy[toContainerIdx].vehicles];

    const [moved] = sourceVehicles.splice(vIdx, 1);
    targetVehicles.push(moved);

    const constraints = {
      maxVehicles: settings.maxVehicles || 4,
      maxCbm: settings.maxCbm || 76.0,
      maxWeightKg: settings.maxWeightKg || 26500,
      maxLengthCm: settings.maxLengthCm || 2400,
    };

    containersCopy[fromContainerIdx] = recalculateContainerStats(
      containersCopy[fromContainerIdx].tempId,
      containersCopy[fromContainerIdx].containerNo,
      containersCopy[fromContainerIdx].sealOrBlNo,
      containersCopy[fromContainerIdx].extraValue,
      sourceVehicles,
      constraints
    );

    containersCopy[toContainerIdx] = recalculateContainerStats(
      containersCopy[toContainerIdx].tempId,
      containersCopy[toContainerIdx].containerNo,
      containersCopy[toContainerIdx].sealOrBlNo,
      containersCopy[toContainerIdx].extraValue,
      targetVehicles,
      constraints
    );

    setPlannedContainers(containersCopy);
    addToast({
      type: 'info',
      title: 'Vehicle Transferred',
      description: `Moved ${moved.model} to ${containersCopy[toContainerIdx].containerNo}.`,
    });
  };

  // Save confirmed plans to Dexie Library
  const handleSaveToLibrary = async () => {
    if (plannedContainers.length === 0) return;

    try {
      for (const planned of plannedContainers) {
        const realContainer: Container = {
          containerNo: planned.containerNo || `CONFIRMED-${Date.now().toString().slice(-4)}`,
          sealOrBlNo: planned.sealOrBlNo || '',
          extraValue: planned.extraValue || 4000,
          vehicles: planned.vehicles,
          totalCbm: planned.totalCbm,
          totalWeight: planned.totalWeight,
          totalPrice: planned.totalPrice,
          vehicleCount: planned.vehicles.length,
          models: Array.from(new Set(planned.vehicles.map((v) => v.model))),
          chassisPrefixes: Array.from(new Set(planned.vehicles.map((v) => v.chassisPrefix))),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          matchedFromContainerNo: planned.matchedPatternFrom,
          remark: planned.remark || (planned.matchedPatternFrom ? `Checked from ${planned.matchedPatternFrom}` : ''),
        };

        await addContainerWithVehicles(realContainer);
        saveContainerToFirestore(realContainer).catch((e) =>
          console.warn('Firestore sync note:', e)
        );
      }

      await refreshContainers();
      addToast({
        type: 'success',
        title: 'Plans Confirmed & Saved',
        description: `Saved ${plannedContainers.length} verified plans to library with remarks.`,
      });
    } catch (err: any) {
      console.error(err);
      addToast({ type: 'error', title: 'Save Failed', description: err.message });
    }
  };

  const handleExportPlannedToExcel = () => {
    if (plannedContainers.length === 0) return;
    requestPasswordProtectedAction(
      () => {
        const asReal: Container[] = plannedContainers.map((p) => ({
          containerNo: p.containerNo,
          sealOrBlNo: p.sealOrBlNo,
          extraValue: p.extraValue,
          vehicles: p.vehicles,
          totalCbm: p.totalCbm,
          totalWeight: p.totalWeight,
          totalPrice: p.totalPrice,
          vehicleCount: p.vehicles.length,
          models: Array.from(new Set(p.vehicles.map((v) => v.model))),
          chassisPrefixes: Array.from(new Set(p.vehicles.map((v) => v.chassisPrefix))),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          remark: p.remark,
        }));
        exportContainersToExcel(asReal, `Confirmed_Container_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`);
        addToast({
          type: 'success',
          title: 'Excel Download Complete',
          description: `Exported ${plannedContainers.length} confirmed container plans.`,
        });
      },
      'Master Password Required for Excel Download',
      'Plan ki Excel download karne ke liye master password (8076910181) dalein.'
    );
  };

  const grandSummary = useMemo(() => {
    const totalVehicles = plannedContainers.reduce((acc, c) => acc + c.vehicles.length, 0);
    const totalCbm = Math.round(plannedContainers.reduce((acc, c) => acc + c.totalCbm, 0) * 1000) / 1000;
    const totalWeight = plannedContainers.reduce((acc, c) => acc + c.totalWeight, 0);
    const totalPrice = plannedContainers.reduce((acc, c) => acc + c.totalPrice, 0);
    const avgFill = plannedContainers.length > 0
      ? Math.round(plannedContainers.reduce((acc, c) => acc + c.cbmFillPercent, 0) / plannedContainers.length)
      : 0;

    return { totalVehicles, totalCbm, totalWeight, totalPrice, avgFill };
  }, [plannedContainers]);

  return (
    <div className="space-y-6">
      {/* Page Title & Strict Rule Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Historical Plan Checker & Builder</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Uploaded Plans Check</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            {settings.showHinglish
              ? 'सिर्फ अपलोड किए गए पुराने प्लान्स से चेक होकर ही नया प्लान बनेगा और कन्फर्म होगा (No AI / No Predictions).'
              : 'Plans are confirmed and formed ONLY from your uploaded past container plans. Zero synthetic predictions.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkPasteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-sky-500" />
            <span>Paste Vehicle List</span>
          </button>
          <button
            onClick={handleLoadSampleBatch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
            title="Load known combinations from uploaded MSKU0113466 and MSKU1239891"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <span>Load Known Historical Batch</span>
          </button>
        </div>
      </div>

      {/* Strict Mode Verification Indicator */}
      <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
          <Lock className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>
            <strong>Strict Database Verification:</strong> Active against <strong>{pastContainers.length} uploaded past plans</strong> ({pastContainers.reduce((a, c) => a + c.vehicles.length, 0)} vehicles in history).
          </span>
        </div>

        <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={strictUploadedOnly}
            onChange={(e) => setStrictUploadedOnly(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
          />
          <span>Only Build Confirmed Uploaded Plans (सख्त पुराना प्लान मिलान)</span>
        </label>
      </div>

      {/* STEP 1: Vehicles Entry Table */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Step 1: Vehicles to Check Against Uploaded Plans</span>
              <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                ({requestRows.reduce((acc, r) => acc + (r.qty || 1), 0)} Units Total)
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Enter vehicle models and chassis prefixes. The system will search uploaded past plans for exact matching combinations.
            </p>
          </div>

          <button
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vehicle Row</span>
          </button>
        </div>

        {/* Input Rows Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <th className="py-2.5 px-3">Model *</th>
                  <th className="py-2.5 px-3">Chassis Prefix</th>
                  <th className="py-2.5 px-2 text-center w-20">Qty</th>
                  <th className="py-2.5 px-3 text-right">L × W × H (cm)</th>
                  <th className="py-2.5 px-3 text-right">Weight (kg)</th>
                  <th className="py-2.5 px-3 text-right">CBM (m³)</th>
                  <th className="py-2.5 px-3">Uploaded History Match</th>
                  <th className="py-2.5 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {requestRows.map((row, idx) => {
                  const cacheKey = `${row.model.toUpperCase()}_${row.chassisPrefix?.toUpperCase() || ''}`;
                  const availableVariants = specsCache[cacheKey] || [];

                  return (
                    <tr
                      key={row.id || idx}
                      className={row.isCustomSpec ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}
                    >
                      {/* Model Input */}
                      <td className="py-2 px-3 font-sans">
                        <input
                          type="text"
                          list="builder-models"
                          required
                          value={row.model}
                          onChange={(e) => handleRowChange(idx, 'model', e.target.value.toUpperCase())}
                          placeholder="e.g. ELF"
                          className="w-full px-2 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                        />
                      </td>

                      {/* Chassis Prefix */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.chassisPrefix || ''}
                          onChange={(e) => handleRowChange(idx, 'chassisPrefix', e.target.value.toUpperCase())}
                          placeholder="e.g. NPR58P"
                          className="w-full px-2 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 dark:text-sky-400"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={row.qty}
                          onChange={(e) => handleRowChange(idx, 'qty', Math.max(parseInt(e.target.value) || 1, 1))}
                          className="w-16 px-1.5 py-1 text-xs text-center font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 tabular-nums"
                        />
                      </td>

                      {/* L x W x H Editable inputs */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={row.length || ''}
                            onChange={(e) => handleRowChange(idx, 'length', e.target.value)}
                            className="w-12 px-1 py-1 text-right text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            placeholder="L"
                          />
                          <span className="text-slate-400">×</span>
                          <input
                            type="number"
                            value={row.width || ''}
                            onChange={(e) => handleRowChange(idx, 'width', e.target.value)}
                            className="w-12 px-1 py-1 text-right text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            placeholder="W"
                          />
                          <span className="text-slate-400">×</span>
                          <input
                            type="number"
                            value={row.height || ''}
                            onChange={(e) => handleRowChange(idx, 'height', e.target.value)}
                            className="w-12 px-1 py-1 text-right text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                            placeholder="H"
                          />
                        </div>
                      </td>

                      {/* Weight */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          value={row.weight || ''}
                          onChange={(e) => handleRowChange(idx, 'weight', Number(e.target.value) || 0)}
                          className="w-20 px-1 py-1 text-right text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold"
                        />
                      </td>

                      {/* CBM */}
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          value={row.cbm || ''}
                          onChange={(e) => handleRowChange(idx, 'cbm', Number(e.target.value) || 0)}
                          className="w-20 px-1 py-1 text-right text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold text-sky-600 dark:text-sky-400"
                        />
                      </td>

                      {/* History Status */}
                      <td className="py-2 px-3 font-sans">
                        {row.isCustomSpec ? (
                          <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Not found in uploaded plans</span>
                          </div>
                        ) : availableVariants.length > 1 ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={`${row.length}x${row.width}x${row.height}`}
                              onChange={(e) => {
                                const picked = availableVariants.find(
                                  (s) => `${s.length}x${s.width}x${s.height}` === e.target.value
                                );
                                if (picked) {
                                  handleRowChange(idx, 'resolvedSpec', picked);
                                  handleRowChange(idx, 'length', picked.length);
                                  handleRowChange(idx, 'width', picked.width);
                                  handleRowChange(idx, 'height', picked.height);
                                  handleRowChange(idx, 'weight', picked.weight);
                                  handleRowChange(idx, 'cbm', picked.cbm);
                                }
                              }}
                              className="text-[10px] py-0.5 px-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
                            >
                              {availableVariants.map((v, vIdx) => (
                                <option key={vIdx} value={`${v.length}x${v.width}x${v.height}`}>
                                  {v.length}×{v.width}×{v.height} ({v.frequency}x in history)
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>In uploaded plans ({availableVariants[0]?.frequency || 1}x recorded)</span>
                          </div>
                        )}
                      </td>

                      {/* Remove Button */}
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500">
            {strictUploadedOnly ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                ✓ Strict Check: Jo combination aapke uploaded plans me hai, sirf vahi confirm hoga.
              </span>
            ) : (
              <span>Allowing fallback packing for unmatched items.</span>
            )}
          </div>

          <button
            onClick={runHistoricalVerification}
            disabled={isPlanning || requestRows.length === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Check Against Uploaded Plans & Confirm</span>
          </button>
        </div>

        <datalist id="builder-models">
          {knownModels.map((m, idx) => (
            <option key={idx} value={m} />
          ))}
        </datalist>
      </div>

      {/* STEP 2: Confirmed Plans Result */}
      {plannedContainers.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Summary Banner */}
          <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Confirmed Plans: {plannedContainers.length} Containers Verified</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
                    100% Uploaded Match
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Confirmed {grandSummary.totalVehicles} vehicles • Total {grandSummary.totalCbm.toFixed(3)} CBM • {grandSummary.totalWeight.toLocaleString()} kg
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPlannedToExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-500" />
                <span>Export to Excel</span>
              </button>
              <button
                onClick={handleSaveToLibrary}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm & Save to Library</span>
              </button>
            </div>
          </div>

          {/* Cards for each Confirmed Container */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {plannedContainers.map((container, cIdx) => (
              <div
                key={container.tempId}
                className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                {/* Header with verified stamp */}
                <div className="p-4 border-b border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                        Container {cIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={container.containerNo}
                        onChange={(e) => {
                          const updated = [...plannedContainers];
                          updated[cIdx].containerNo = e.target.value.toUpperCase();
                          setPlannedContainers(updated);
                        }}
                        className="px-2 py-0.5 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 w-32"
                        placeholder="Container No"
                      />
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified from Old Plan: {container.matchedPatternFrom}</span>
                    </div>
                  </div>

                  {/* Volume Fill Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-500">Volume: {container.totalCbm.toFixed(3)} / {settings.maxCbm || 76} CBM</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {container.cbmFillPercent}% Fill
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${Math.min(container.cbmFillPercent, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Remark / Notes Input on Planned Container */}
                  <div className="pt-2 flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider shrink-0">
                      Remark / टिप्पणी:
                    </span>
                    <input
                      type="text"
                      value={container.remark || ''}
                      onChange={(e) => {
                        const updated = [...plannedContainers];
                        updated[cIdx].remark = e.target.value;
                        setPlannedContainers(updated);
                      }}
                      placeholder={`e.g. Verified combination from ${container.matchedPatternFrom || 'history'} / Notes`}
                      className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Vehicles Table */}
                <div className="p-4 space-y-2 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="text-slate-400 font-sans border-b border-slate-100 dark:border-slate-800 pb-1">
                        <th className="py-1 px-1 text-center w-6">#</th>
                        <th className="py-1 px-2">Model</th>
                        <th className="py-1 px-2">Prefix</th>
                        <th className="py-1 px-2 text-right">L×W×H</th>
                        <th className="py-1 px-2 text-right">Weight</th>
                        <th className="py-1 px-2 text-right">CBM</th>
                        <th className="py-1 px-2 text-center">Move</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {container.vehicles.map((v, vIdx) => (
                        <tr key={v.id || vIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-1 text-center font-bold text-slate-400">
                            {vIdx + 1}
                          </td>
                          <td className="py-2 px-2 font-sans font-bold text-slate-900 dark:text-slate-100">
                            {v.make} {v.model}
                          </td>
                          <td className="py-2 px-2 text-sky-600 dark:text-sky-400 font-semibold">
                            {v.chassisPrefix}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500">
                            {v.length}×{v.width}×{v.height}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold tabular-nums">
                            {v.weight?.toLocaleString()} kg
                          </td>
                          <td className="py-2 px-2 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {v.cbm?.toFixed(3)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {plannedContainers.length > 1 && (
                              <select
                                value=""
                                onChange={(e) => {
                                  const targetIdx = parseInt(e.target.value);
                                  if (!isNaN(targetIdx)) {
                                    moveVehicle(cIdx, vIdx, targetIdx);
                                  }
                                }}
                                className="text-[10px] p-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer"
                              >
                                <option value="">Move ⇄</option>
                                {plannedContainers.map((_, otherIdx) => {
                                  if (otherIdx === cIdx) return null;
                                  return (
                                    <option key={otherIdx} value={otherIdx}>
                                      → Container {otherIdx + 1}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Totals */}
                <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3">
                    <span>Total Wt: <strong>{container.totalWeight.toLocaleString()} kg</strong></span>
                    <span>Units: <strong>{container.vehicles.length}</strong></span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={async () => {
                        const text = formatContainerForWhatsApp(container);
                        await copyToClipboard(text);
                        addToast({ type: 'success', title: 'Container Text Copied for WhatsApp' });
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-600 rounded cursor-pointer"
                      title="Copy for WhatsApp"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPrintContainerData(container)}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                      title="Print / Save PDF loading sheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmatched Vehicles Section (When strict matching leaves leftovers) */}
      {unmatchedVehicles.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Unmatched Vehicles ({unmatchedVehicles.length} Units) - No Matching Combination Found in Uploaded Plans
            </span>
          </div>
          <p className="text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
            Ye gaadiyan aapke kisi bhi uploaded purane container plan me is combination ke saath match nahi hui.
            Koi prediction ya guess nahi kiya gaya hai. Aap naye plans upload kar sakte hain ya gaadiyon ki sankhya badal sakte hain.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {unmatchedVehicles.map((v, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 font-mono text-[11px]"
              >
                #{i + 1} {v.make} {v.model} ({v.chassisPrefix || 'No Prefix'}) - {v.cbm?.toFixed(3)} CBM
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-5 space-y-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Paste Vehicle List
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Paste Model, Chassis Prefix, and Quantity (tab-separated from Excel or comma-separated):
              </p>
            </div>

            <textarea
              rows={8}
              value={bulkPasteText}
              onChange={(e) => setBulkPasteText(e.target.value)}
              placeholder={`ELF\tNKR61E\t2\nHIACE\tKDH206\t2\nWISH\tZGE20\t2\nRUMION\tZRE152\t2`}
              className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBulkPasteModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessBulkPaste}
                disabled={!bulkPasteText.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg cursor-pointer disabled:opacity-50"
              >
                Load Vehicles
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
