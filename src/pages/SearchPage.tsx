import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Copy,
  Download,
  Printer,
  ShieldCheck,
  Car,
  Ship,
  TrendingUp,
  Check,
  ChevronDown,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { Container, Vehicle } from '../types';
import { useApp } from '../context/AppContext';
import { getDistinctModels, getDistinctChassisPrefixes, getDistinctMakes } from '../db/db';
import { exportContainersToExcel } from '../utils/excelParser';
import { formatContainerForWhatsApp, copyToClipboard } from '../utils/whatsappFormatter';

export const SearchPage: React.FC = () => {
  const {
    containers,
    settings,
    transferContainerToBuilder,
    setPrintContainerData,
    addToast,
    setActivePage,
    requestPasswordProtectedAction,
  } = useApp();

  // Search parameters
  const [modelInput, setModelInput] = useState('');
  const [modelOperator, setModelOperator] = useState<'AND' | 'OR'>('OR');
  const [makeInput, setMakeInput] = useState('');
  const [chassisPrefixInput, setChassisPrefixInput] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [fuelInput, setFuelInput] = useState('');
  const [freeTextInput, setFreeTextInput] = useState('');

  // View toggle: 'vehicle' | 'container'
  const [viewMode, setViewMode] = useState<'vehicle' | 'container'>('vehicle');

  // Autocomplete lists
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [knownPrefixes, setKnownPrefixes] = useState<string[]>([]);
  const [knownMakes, setKnownMakes] = useState<string[]>([]);

  useEffect(() => {
    getDistinctModels().then(setKnownModels);
    getDistinctChassisPrefixes().then(setKnownPrefixes);
    getDistinctMakes().then(setKnownMakes);
  }, [containers]);

  // Update chassis prefix autocomplete when model changes
  useEffect(() => {
    getDistinctChassisPrefixes(modelInput ? modelInput.split(',')[0].trim() : undefined).then(
      setKnownPrefixes
    );
  }, [modelInput]);

  // Matching Logic
  const { matchingVehicles, matchingContainers } = useMemo(() => {
    // Parse comma-separated models
    const requestedModels = modelInput
      .split(',')
      .map((m) => m.trim().toUpperCase())
      .filter(Boolean);

    const cleanMake = makeInput.trim().toUpperCase();
    const cleanPrefix = chassisPrefixInput.trim().toUpperCase();
    const cleanYear = yearInput.trim() ? parseInt(yearInput.trim()) : null;
    const cleanFuel = fuelInput.trim().toUpperCase();
    const cleanFreeText = freeTextInput.trim().toUpperCase();

    // Check if any filter is active
    const hasAnyFilter =
      requestedModels.length > 0 ||
      cleanMake !== '' ||
      cleanPrefix !== '' ||
      cleanYear !== null ||
      cleanFuel !== '' ||
      cleanFreeText !== '';

    if (!hasAnyFilter) {
      // Default: show all or top 100
      const allV: Array<{ vehicle: Vehicle; container: Container }> = [];
      containers.forEach((c) => {
        c.vehicles.forEach((v) => {
          allV.push({ vehicle: v, container: c });
        });
      });
      return { matchingVehicles: allV, matchingContainers: containers };
    }

    const matchedVehiclesList: Array<{ vehicle: Vehicle; container: Container }> = [];
    const matchedContainersList: Container[] = [];

    containers.forEach((container) => {
      // Check container-level model requirement with AND / OR
      let passesContainerModelFilter = true;
      if (requestedModels.length > 0) {
        if (modelOperator === 'AND') {
          // Container must carry ALL requested models
          passesContainerModelFilter = requestedModels.every((req) =>
            container.models.some((m) => m.toUpperCase().includes(req))
          );
        } else {
          // Container must carry AT LEAST ONE requested model
          passesContainerModelFilter = requestedModels.some((req) =>
            container.models.some((m) => m.toUpperCase().includes(req))
          );
        }
      }

      if (!passesContainerModelFilter) return;

      let containerHasMatchedVehicle = false;

      container.vehicles.forEach((v) => {
        // Vehicle-level criteria
        let match = true;

        if (requestedModels.length > 0) {
          match = requestedModels.some((req) => v.model.toUpperCase().includes(req));
        }

        if (match && cleanMake && !v.make.toUpperCase().includes(cleanMake)) {
          match = false;
        }

        if (match && cleanPrefix && !v.chassisPrefix.toUpperCase().includes(cleanPrefix)) {
          match = false;
        }

        if (match && cleanYear !== null && v.year !== cleanYear) {
          match = false;
        }

        if (match && cleanFuel && v.fuel.toUpperCase() !== cleanFuel) {
          match = false;
        }

        if (match && cleanFreeText) {
          const inChassis = v.chassisNo.toUpperCase().includes(cleanFreeText);
          const inId = v.vehicleIdNo?.toUpperCase().includes(cleanFreeText);
          const inContainer = container.containerNo.toUpperCase().includes(cleanFreeText);
          const inSeal = container.sealOrBlNo?.toUpperCase().includes(cleanFreeText);
          if (!inChassis && !inId && !inContainer && !inSeal) {
            match = false;
          }
        }

        if (match) {
          matchedVehiclesList.push({ vehicle: v, container });
          containerHasMatchedVehicle = true;
        }
      });

      if (containerHasMatchedVehicle) {
        matchedContainersList.push(container);
      }
    });

    return { matchingVehicles: matchedVehiclesList, matchingContainers: matchedContainersList };
  }, [
    containers,
    modelInput,
    modelOperator,
    makeInput,
    chassisPrefixInput,
    yearInput,
    fuelInput,
    freeTextInput,
  ]);

  // Dimension statistics (Min / Max / Avg) for matched vehicles
  const dimensionStats = useMemo(() => {
    if (matchingVehicles.length === 0) return null;

    const vehicles = matchingVehicles.map((m) => m.vehicle);
    const count = vehicles.length;

    const lengths = vehicles.map((v) => v.length).filter(Boolean);
    const widths = vehicles.map((v) => v.width).filter(Boolean);
    const heights = vehicles.map((v) => v.height).filter(Boolean);
    const weights = vehicles.map((v) => v.weight).filter(Boolean);
    const cbms = vehicles.map((v) => v.cbm).filter(Boolean);

    const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
    const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);
    const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
    const avgCbm = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 1000) / 1000 : 0);

    return {
      count,
      length: { min: min(lengths), max: max(lengths), avg: avg(lengths) },
      width: { min: min(widths), max: max(widths), avg: avg(widths) },
      height: { min: min(heights), max: max(heights), avg: avg(heights) },
      weight: { min: min(weights), max: max(weights), avg: avg(weights) },
      cbm: { min: min(cbms), max: max(cbms), avg: avgCbm(cbms) },
    };
  }, [matchingVehicles]);

  const handleExportSearchResults = () => {
    if (matchingContainers.length === 0) {
      addToast({ type: 'warning', title: 'No results to export' });
      return;
    }
    requestPasswordProtectedAction(
      () => {
        exportContainersToExcel(matchingContainers, `Search_Results_${matchingContainers.length}_Plans.xlsx`);
        addToast({
          type: 'success',
          title: 'Excel Download Complete',
          description: `Exported ${matchingContainers.length} matching plans.`,
        });
      },
      'Master Password Required for Excel Download',
      'Search results download karne ke liye master password (8076910181) dalein.'
    );
  };

  const handleClearAll = () => {
    setModelInput('');
    setMakeInput('');
    setChassisPrefixInput('');
    setYearInput('');
    setFuelInput('');
    setFreeTextInput('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Model & Chassis Search Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-semibold">
              Instant Offline Match
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {settings.showHinglish
              ? 'Model, Chassis prefix ya Container No se khojein • AND/OR multiple models support'
              : 'Indexed search across 1000+ past container manifests with dimension statistics & variation analysis'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportSearchResults}
            disabled={matchingContainers.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" />
            <span>Export Matches ({matchingContainers.length})</span>
          </button>
        </div>
      </div>

      {/* Multi-Parameter Search Form */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Model Search with Autocomplete and AND/OR toggle */}
          <div className="lg:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Vehicle Model(s)
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400">Match:</span>
                <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-950">
                  <button
                    onClick={() => setModelOperator('OR')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      modelOperator === 'OR'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    OR (Any)
                  </button>
                  <button
                    onClick={() => setModelOperator('AND')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                      modelOperator === 'AND'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                    title="Container must contain ALL listed models (e.g. ELF, HIACE)"
                  >
                    AND (Both)
                  </button>
                </div>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                list="models-search-list"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                placeholder="e.g. HIACE or multiple like ELF, HIACE"
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="models-search-list">
                {knownModels.map((m, idx) => (
                  <option key={idx} value={m} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Chassis Prefix Autocomplete */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chassis Prefix
            </label>
            <div className="relative">
              <input
                type="text"
                list="prefixes-search-list"
                value={chassisPrefixInput}
                onChange={(e) => setChassisPrefixInput(e.target.value.toUpperCase())}
                placeholder="e.g. KDH206, NPR58P, FE315"
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sky-600 dark:text-sky-400 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="prefixes-search-list">
                {knownPrefixes.map((p, idx) => (
                  <option key={idx} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Make Filter */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Make / Manufacturer
            </label>
            <input
              type="text"
              list="makes-search-list"
              value={makeInput}
              onChange={(e) => setMakeInput(e.target.value.toUpperCase())}
              placeholder="e.g. TOYOTA, ISUZU"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            <datalist id="makes-search-list">
              {knownMakes.map((m, idx) => (
                <option key={idx} value={m} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Secondary Row: Year, Fuel, and Free-Text (Container No / Full Chassis) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Model Year
            </label>
            <input
              type="number"
              value={yearInput}
              onChange={(e) => setYearInput(e.target.value)}
              placeholder="e.g. 2012"
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Engine Fuel
            </label>
            <select
              value={fuelInput}
              onChange={(e) => setFuelInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
            >
              <option value="">Any Fuel Type</option>
              <option value="D">Diesel (D)</option>
              <option value="G">Petrol / Gasoline (G)</option>
              <option value="H">Hybrid (H)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-500 block mb-1">
              Free-Text (Container No, Full Chassis, ID)
            </label>
            <input
              type="text"
              value={freeTextInput}
              onChange={(e) => setFreeTextInput(e.target.value)}
              placeholder="e.g. MSKU, 7106494, 3422024"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Action strip & View Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">View Mode:</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setViewMode('vehicle')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'vehicle'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Vehicle View ({matchingVehicles.length})</span>
              </button>
              <button
                onClick={() => setViewMode('container')}
                className={`px-3 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'container'
                    ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Ship className="w-3.5 h-3.5" />
                <span>Container View ({matchingContainers.length})</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClearAll}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Dimension & Specification Statistics Strip (Crucial for variation detection) */}
      {dimensionStats && (
        <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-900 dark:text-sky-200">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <span>
                Specification Analysis for Matched Vehicles ({dimensionStats.count} Units):
              </span>
            </div>
            <span className="text-[11px] text-sky-700 dark:text-sky-400 font-mono">
              Min / Average / Max
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 block font-sans">Length (cm)</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Avg: {dimensionStats.length.avg}
              </div>
              <div className="text-[10px] text-slate-400">
                {dimensionStats.length.min} - {dimensionStats.length.max} cm
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 block font-sans">Width (cm)</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Avg: {dimensionStats.width.avg}
              </div>
              <div className="text-[10px] text-slate-400">
                {dimensionStats.width.min} - {dimensionStats.width.max} cm
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 block font-sans">Height (cm)</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Avg: {dimensionStats.height.avg}
              </div>
              <div className="text-[10px] text-slate-400">
                {dimensionStats.height.min} - {dimensionStats.height.max} cm
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 block font-sans">Weight (kg)</span>
              <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Avg: {dimensionStats.weight.avg.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400">
                {dimensionStats.weight.min} - {dimensionStats.weight.max} kg
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-sky-100 dark:border-sky-900/40">
              <span className="text-[10px] text-slate-500 block font-sans">CBM (m³)</span>
              <div className="font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                Avg: {dimensionStats.cbm.avg.toFixed(3)}
              </div>
              <div className="text-[10px] text-slate-400">
                {dimensionStats.cbm.min.toFixed(3)} - {dimensionStats.cbm.max.toFixed(3)} m³
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results View A: Vehicle View */}
      {viewMode === 'vehicle' && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <th className="py-2.5 px-3">Make / Model</th>
                  <th className="py-2.5 px-3">Chassis No</th>
                  <th className="py-2.5 px-2">Prefix</th>
                  <th className="py-2.5 px-2 text-center">Fuel</th>
                  <th className="py-2.5 px-2 text-center">Year</th>
                  <th className="py-2.5 px-2 text-right">CC</th>
                  <th className="py-2.5 px-3 text-right">L × W × H (cm)</th>
                  <th className="py-2.5 px-3 text-right">Weight (kg)</th>
                  <th className="py-2.5 px-3 text-right">CBM (m³)</th>
                  <th className="py-2.5 px-3">Container No</th>
                  <th className="py-2.5 px-3">Remark</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {matchingVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      No vehicles found matching these search criteria.
                    </td>
                  </tr>
                ) : (
                  matchingVehicles.slice(0, 50).map(({ vehicle: v, container: c }, idx) => (
                    <tr key={v.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-sans">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {v.make} {v.model}
                        </span>
                        {v.vehicleIdNo && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {v.vehicleIdNo}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {v.chassisNo}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-sky-600 dark:text-sky-400">
                        {v.chassisPrefix}
                      </td>
                      <td className="py-2.5 px-2 text-center">
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
                      <td className="py-2.5 px-2 text-center">{v.year || '-'}</td>
                      <td className="py-2.5 px-2 text-right text-slate-500">{v.engineCC || '-'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                        {v.length}×{v.width}×{v.height}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {v.weight?.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                        {v.cbm?.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => {
                            setFreeTextInput(c.containerNo);
                            setViewMode('container');
                          }}
                          className="font-bold text-sky-600 hover:underline cursor-pointer flex items-center gap-1"
                          title="View entire container plan"
                        >
                          <span>{c.containerNo}</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={v.remark || c.remark || ''}>
                        {v.remark || c.remark || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => transferContainerToBuilder(c)}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 hover:bg-sky-100 cursor-pointer"
                          title="Send container combo to Plan Builder"
                        >
                          Plan Combo
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {matchingVehicles.length > 50 && (
            <div className="p-3 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
              Showing first 50 of {matchingVehicles.length} vehicles. Refine your query or export to Excel to view all.
            </div>
          )}
        </div>
      )}

      {/* Results View B: Container View (with matching vehicle highlighted) */}
      {viewMode === 'container' && (
        <div className="space-y-4">
          {matchingContainers.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
              No containers match your search filters.
            </div>
          ) : (
            matchingContainers.map((c) => {
              // Highlight matched vehicles
              const cleanPrefix = chassisPrefixInput.trim().toUpperCase();
              const reqModels = modelInput
                .split(',')
                .map((m) => m.trim().toUpperCase())
                .filter(Boolean);

              return (
                <div
                  key={c.id || c.containerNo}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                >
                  {/* Container Bar */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-sky-600 dark:text-sky-400">
                          {c.containerNo}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                          {c.vehicles.length || c.vehicleCount} Units
                        </span>
                        {c.sealOrBlNo && (
                          <span className="text-xs text-slate-500 font-mono">
                            • Seal: {c.sealOrBlNo}
                          </span>
                        )}
                        {c.extraValue ? (
                          <span className="text-xs text-slate-400 font-mono">
                            • Tare: {c.extraValue} kg
                          </span>
                        ) : null}
                      </div>

                      {/* Remark pill if present */}
                      {(c.remark || c.notes) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/60 w-fit">
                          <span className="font-semibold uppercase text-[9px]">Remark / टिप्पणी:</span>
                          <span className="font-sans font-medium">{c.remark || c.notes}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 font-sans">Total CBM: </span>
                        <strong className="text-sky-600 dark:text-sky-400">{c.totalCbm.toFixed(3)} m³</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-sans">Total Wt: </span>
                        <strong className="text-slate-900 dark:text-slate-100">{c.totalWeight.toLocaleString()} kg</strong>
                      </div>

                      <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-700">
                        <button
                          onClick={() => transferContainerToBuilder(c)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer inline-flex items-center gap-1 shadow-xs"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Check in Builder</span>
                        </button>
                        <button
                          onClick={() => setPrintContainerData(c)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                          title="Print / Save PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Vehicles grid within container */}
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse font-mono text-[11px]">
                      <thead>
                        <tr className="text-slate-400 font-sans font-semibold border-b border-slate-100 dark:border-slate-800 pb-1">
                          <th className="py-1 px-2 w-8 text-center">#</th>
                          <th className="py-1 px-3">Make / Model</th>
                          <th className="py-1 px-3">Chassis No</th>
                          <th className="py-1 px-2">Prefix</th>
                          <th className="py-1 px-2 text-center">Fuel</th>
                          <th className="py-1 px-2 text-center">Year</th>
                          <th className="py-1 px-3 text-right">Dimensions (cm)</th>
                          <th className="py-1 px-3 text-right">Weight</th>
                          <th className="py-1 px-3 text-right">CBM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {c.vehicles.map((v, i) => {
                          const isModelMatch =
                            reqModels.length > 0 && reqModels.some((m) => v.model.toUpperCase().includes(m));
                          const isPrefixMatch = cleanPrefix && v.chassisPrefix.toUpperCase().includes(cleanPrefix);
                          const isHighlight = isModelMatch || isPrefixMatch;

                          return (
                            <tr
                              key={v.id || i}
                              className={isHighlight ? 'bg-sky-50/80 dark:bg-sky-950/40 font-semibold' : ''}
                            >
                              <td className="py-2 px-2 text-center text-slate-400">{v.serialNo || i + 1}</td>
                              <td className="py-2 px-3 font-sans">
                                <span className={isHighlight ? 'text-sky-700 dark:text-sky-300 font-bold' : ''}>
                                  {v.make} {v.model}
                                </span>
                              </td>
                              <td className="py-2 px-3">{v.chassisNo}</td>
                              <td className="py-2 px-2 text-sky-600 dark:text-sky-400 font-bold">
                                {v.chassisPrefix}
                              </td>
                              <td className="py-2 px-2 text-center">{v.fuel}</td>
                              <td className="py-2 px-2 text-center">{v.year || '-'}</td>
                              <td className="py-2 px-3 text-right text-slate-500">
                                {v.length}×{v.width}×{v.height}
                              </td>
                              <td className="py-2 px-3 text-right tabular-nums">{v.weight?.toLocaleString()} kg</td>
                              <td className="py-2 px-3 text-right font-bold tabular-nums text-sky-600 dark:text-sky-400">
                                {v.cbm?.toFixed(3)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
