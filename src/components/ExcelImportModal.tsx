import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileDown,
  Layers,
  FileCheck,
  Clipboard,
  Check,
  ChevronRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { Container } from '../types';
import {
  parseExcelFile,
  parsePastedText,
  parseGridData,
  DEFAULT_BLOCK_MAPPING,
  DEFAULT_FLAT_MAPPING,
  downloadBlankExcelTemplate,
  ColumnMapping,
} from '../utils/excelParser';
import { bulkImportContainers, db } from '../db/db';
import { syncContainersToFirestore } from '../firebase/firestoreService';
import { useApp } from '../context/AppContext';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { addToast, containers: existingContainers } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Steps: 'upload' -> 'preview' -> 'importing'
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Raw parsed grid
  const [rawGrid, setRawGrid] = useState<any[][]>([]);
  const [formatMode, setFormatMode] = useState<'block' | 'flat'>('block');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(DEFAULT_BLOCK_MAPPING);
  const [showMappingConfig, setShowMappingConfig] = useState(false);

  // Parsed results
  const [parsedContainers, setParsedContainers] = useState<Container[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ row?: number; containerNo?: string; message: string; severity: 'error' | 'warning' }>
  >([]);
  const [duplicateMode, setDuplicateMode] = useState<'skip' | 'overwrite' | 'keep_both'>('skip');

  // Progress state
  const [importProgress, setImportProgress] = useState({ processed: 0, total: 0 });

  if (!isOpen) return null;

  const handleProcessGrid = (grid: any[][], format?: 'block' | 'flat', mapping?: ColumnMapping) => {
    setRawGrid(grid);
    const chosenFormat = format || formatMode;
    const chosenMapping = mapping || (chosenFormat === 'flat' ? DEFAULT_FLAT_MAPPING : DEFAULT_BLOCK_MAPPING);
    setFormatMode(chosenFormat);
    setColumnMapping(chosenMapping);

    const result = parseGridData(grid, chosenFormat, chosenMapping);
    setParsedContainers(result.containers);
    setValidationErrors(result.errors);
    setFormatMode(result.detectedFormat);
    setStep('preview');
  };

  const handleFileSelect = async (file: File) => {
    try {
      setIsLoadingFile(true);
      const grid = await parseExcelFile(file);
      handleProcessGrid(grid);
    } catch (err: any) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'File Read Failed',
        description: err.message || 'Could not parse Excel spreadsheet.',
      });
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handlePasteProcess = () => {
    if (!pastedText.trim()) return;
    const grid = parsePastedText(pastedText);
    handleProcessGrid(grid);
  };

  const handleReParseWithFormat = (newFormat: 'block' | 'flat') => {
    const newMapping = newFormat === 'flat' ? DEFAULT_FLAT_MAPPING : DEFAULT_BLOCK_MAPPING;
    setFormatMode(newFormat);
    setColumnMapping(newMapping);
    const result = parseGridData(rawGrid, newFormat, newMapping);
    setParsedContainers(result.containers);
    setValidationErrors(result.errors);
  };

  const executeImport = async () => {
    if (parsedContainers.length === 0) return;
    setStep('importing');

    try {
      const existingMap = new Map<string, number>();
      existingContainers.forEach((c) => {
        if (c.containerNo && c.id) existingMap.set(c.containerNo.trim().toUpperCase(), c.id);
      });

      const finalToImport: Container[] = [];

      for (const candidate of parsedContainers) {
        const cKey = candidate.containerNo.trim().toUpperCase();
        const existingId = existingMap.get(cKey);

        if (existingId) {
          if (duplicateMode === 'skip') {
            continue; // Skip
          } else if (duplicateMode === 'overwrite') {
            // Delete old one before inserting
            await db.transaction('rw', db.containers, db.vehicles, async () => {
              await db.vehicles.where('containerId').equals(existingId).delete();
              await db.containers.delete(existingId);
            });
            finalToImport.push(candidate);
          } else {
            // Keep both: rename duplicate
            candidate.containerNo = `${candidate.containerNo}-DUP`;
            finalToImport.push(candidate);
          }
        } else {
          finalToImport.push(candidate);
        }
      }

      setImportProgress({ processed: 0, total: finalToImport.length });

      await bulkImportContainers(finalToImport, (processed, total) => {
        setImportProgress({ processed, total });
      });

      // Background cloud sync to Firebase Firestore
      syncContainersToFirestore(finalToImport).catch((e) =>
        console.warn('Background Firestore sync note:', e)
      );

      addToast({
        type: 'success',
        title: 'Import Successful',
        description: `Imported ${finalToImport.length} containers (${finalToImport.reduce(
          (acc, c) => acc + c.vehicles.length,
          0
        )} vehicles) into database & syncing to Firebase.`,
      });

      onImportComplete();
      onClose();
    } catch (err: any) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Import Failed',
        description: err.message || 'An error occurred during database write.',
      });
      setStep('preview');
    }
  };

  // Find duplicate container count
  const duplicateCount = parsedContainers.filter((c) =>
    existingContainers.some((ec) => ec.containerNo?.toUpperCase() === c.containerNo?.toUpperCase())
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Excel Container Plan Import</span>
                <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300">
                  .xlsx / .csv / paste
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                1000+ container plans offline parsing • Auto-detects stacked blocks or flat tables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadBlankExcelTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Download empty Excel template matching your stacked block layout"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Blank Template</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && (
            <div className="space-y-5">
              {/* Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg w-fit">
                <button
                  onClick={() => setActiveTab('file')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'file'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Upload File (.xlsx, .xls, .csv)
                </button>
                <button
                  onClick={() => setActiveTab('paste')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === 'paste'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Paste Excel Text (TSV)
                </button>
              </div>

              {activeTab === 'file' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/20'
                      : 'border-slate-300 dark:border-slate-700 hover:border-sky-500 bg-slate-50/50 dark:bg-slate-950/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="w-12 h-12 mx-auto rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-3">
                    {isLoadingFile ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>

                  <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {isLoadingFile ? 'Parsing Spreadsheet...' : 'Drop your container Excel sheet here or click to browse'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Supports both stacked container blocks (Container/Seal/Extra in Col A) and flat multi-row format.
                    Handles 1000+ containers in seconds.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    Copy cells from your Excel sheet (<kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">Ctrl+C</kbd>) and paste them directly below:
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste rows here (e.g. MSKU0113466	1	MITSUBISHI	CANTER	3560	D...)"
                    rows={8}
                    className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handlePasteProcess}
                      disabled={!pastedText.trim()}
                      className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Parse Pasted Content</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step-by-Step Hindi / English Guide & Visual Format Table */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-sky-600" />
                    <span>Excel File Format Guide / एक्सेल में डेटा कैसे रखें:</span>
                  </div>
                  <button
                    onClick={downloadBlankExcelTemplate}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Download Blank Template (.xlsx)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      1. File Format
                    </span>
                    <p>
                      Aap <strong>.xlsx</strong>, <strong>.xls</strong>, ya <strong>.csv</strong> file upload kar sakte hain, ya Excel se copy karke paste kar sakte hain.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      2. Stacked 4-Row Block
                    </span>
                    <p>
                      Column A me pehle 3 rows me <strong>Container No</strong>, <strong>Seal No</strong>, aur <strong>Tare Weight</strong> aata hai. 4th row blank rehti hai.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      3. Columns B to P (Vehicles)
                    </span>
                    <p>
                      Columns B onward 4 gaadiyon ki details hoti hain: Make, Model, CC, Fuel, Year, Chassis No, Dims, Weight, CBM.
                    </p>
                  </div>
                </div>

                {/* Visual Columns Mini-Table */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto bg-white dark:bg-slate-900 text-[10px] font-mono">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-1.5 px-2 text-sky-600">Col A</th>
                        <th className="py-1.5 px-1.5">Col B</th>
                        <th className="py-1.5 px-2">Col C</th>
                        <th className="py-1.5 px-2">Col D</th>
                        <th className="py-1.5 px-1.5">Col E</th>
                        <th className="py-1.5 px-1.5 text-center">Col F</th>
                        <th className="py-1.5 px-1.5 text-center">Col G</th>
                        <th className="py-1.5 px-2">Col H</th>
                        <th className="py-1.5 px-2 text-sky-600">Col I</th>
                        <th className="py-1.5 px-2 text-right">Col J×K×L</th>
                        <th className="py-1.5 px-1.5 text-right">Col O</th>
                        <th className="py-1.5 px-1.5 text-right text-emerald-600">Col P</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-sky-600">MSKU0113466</td>
                        <td className="py-1.5 px-1.5 text-slate-400">1</td>
                        <td className="py-1.5 px-2 font-bold">MITSUBISHI</td>
                        <td className="py-1.5 px-2 font-bold">CANTER</td>
                        <td className="py-1.5 px-1.5">3560</td>
                        <td className="py-1.5 px-1.5 text-center">D</td>
                        <td className="py-1.5 px-1.5 text-center">1990</td>
                        <td className="py-1.5 px-2 text-slate-400">3422024991...</td>
                        <td className="py-1.5 px-2 font-bold text-sky-600">FE315BD-445529</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">469×169×199</td>
                        <td className="py-1.5 px-1.5 text-right">2630</td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-emerald-600">15.773</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-sky-600">ML-JP0409806</td>
                        <td className="py-1.5 px-1.5 text-slate-400">2</td>
                        <td className="py-1.5 px-2 font-bold">TOYOTA</td>
                        <td className="py-1.5 px-2 font-bold">WISH</td>
                        <td className="py-1.5 px-1.5">1790</td>
                        <td className="py-1.5 px-1.5 text-center">G</td>
                        <td className="py-1.5 px-1.5 text-center">2012</td>
                        <td className="py-1.5 px-2 text-slate-400">36130359C1...</td>
                        <td className="py-1.5 px-2 font-bold text-sky-600">ZGE20-0134978</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">459×169×159</td>
                        <td className="py-1.5 px-1.5 text-right">1350</td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-emerald-600">12.334</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-sky-600">4000</td>
                        <td className="py-1.5 px-1.5 text-slate-400">3</td>
                        <td className="py-1.5 px-2 font-bold">TOYOTA</td>
                        <td className="py-1.5 px-2 font-bold">HIACE</td>
                        <td className="py-1.5 px-1.5">2980</td>
                        <td className="py-1.5 px-1.5 text-center">D</td>
                        <td className="py-1.5 px-1.5 text-center">2012</td>
                        <td className="py-1.5 px-2 text-slate-400">3471034303...</td>
                        <td className="py-1.5 px-2 font-bold text-sky-600">KDH206-8053689</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">469×170×193</td>
                        <td className="py-1.5 px-1.5 text-right">2220</td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-emerald-600">15.388</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-400 italic">(blank)</td>
                        <td className="py-1.5 px-1.5 text-slate-400">4</td>
                        <td className="py-1.5 px-2 font-bold">ISUZU</td>
                        <td className="py-1.5 px-2 font-bold">ELF</td>
                        <td className="py-1.5 px-1.5">3630</td>
                        <td className="py-1.5 px-1.5 text-center">D</td>
                        <td className="py-1.5 px-1.5 text-center">1991</td>
                        <td className="py-1.5 px-2 text-slate-400">2111020112...</td>
                        <td className="py-1.5 px-2 font-bold text-sky-600">NPR58P7106494</td>
                        <td className="py-1.5 px-2 text-right text-slate-500">674×203×235</td>
                        <td className="py-1.5 px-1.5 text-right">2770</td>
                        <td className="py-1.5 px-1.5 text-right font-bold text-emerald-600">32.153</td>
                      </tr>
                      <tr className="bg-slate-50/60 dark:bg-slate-950/40">
                        <td colSpan={12} className="py-1 px-2 text-center text-slate-400 italic text-[9px]">
                          --- (Empty blank line separates next container) ---
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-5">
              {/* Stats & Format Detector Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-500">Detected: </span>
                    <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                      {parsedContainers.length} Containers
                    </strong>
                    <span className="text-slate-500 ml-1">
                      ({parsedContainers.reduce((acc, c) => acc + c.vehicles.length, 0)} vehicles)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Layout:</span>
                    <button
                      onClick={() => handleReParseWithFormat('block')}
                      className={`px-2 py-1 rounded font-medium text-xs cursor-pointer ${
                        formatMode === 'block'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Stacked Block
                    </button>
                    <button
                      onClick={() => handleReParseWithFormat('flat')}
                      className={`px-2 py-1 rounded font-medium text-xs cursor-pointer ${
                        formatMode === 'flat'
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Flat Table
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowMappingConfig(!showMappingConfig)}
                  className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline cursor-pointer"
                >
                  {showMappingConfig ? 'Hide Column Mapping' : 'Adjust Column Mapping'}
                </button>
              </div>

              {/* Column Mapping Adjuster (Collapsible) */}
              {showMappingConfig && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 text-xs space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    Verify / Adjust 0-Indexed Column Positions
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {[
                      { key: 'makeCol', label: 'Make Col' },
                      { key: 'modelCol', label: 'Model Col' },
                      { key: 'engineCcCol', label: 'CC Col' },
                      { key: 'fuelCol', label: 'Fuel Col' },
                      { key: 'yearCol', label: 'Year Col' },
                      { key: 'chassisNoCol', label: 'Chassis Col' },
                      { key: 'lengthCol', label: 'Length Col' },
                      { key: 'widthCol', label: 'Width Col' },
                      { key: 'heightCol', label: 'Height Col' },
                      { key: 'weightCol', label: 'Weight Col' },
                      { key: 'cbmCol', label: 'CBM Col' },
                      { key: 'priceCol', label: 'Price Col' },
                    ].map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[11px] text-slate-500">{label}</label>
                        <input
                          type="number"
                          value={(columnMapping as any)[key] ?? 0}
                          onChange={(e) => {
                            const updated = { ...columnMapping, [key]: parseInt(e.target.value) || 0 };
                            setColumnMapping(updated);
                            const res = parseGridData(rawGrid, formatMode, updated);
                            setParsedContainers(res.containers);
                            setValidationErrors(res.errors);
                          }}
                          className="w-full px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate Handling Section */}
              {duplicateCount > 0 && (
                <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>{duplicateCount} container numbers</strong> already exist in the database.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400">Action:</span>
                    <select
                      value={duplicateMode}
                      onChange={(e) => setDuplicateMode(e.target.value as any)}
                      className="px-2 py-1 rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs font-semibold"
                    >
                      <option value="skip">Skip duplicates (Keep existing)</option>
                      <option value="overwrite">Overwrite existing records</option>
                      <option value="keep_both">Keep both (Rename with -DUP)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Validation Warnings */}
              {validationErrors.length > 0 && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs max-h-28 overflow-y-auto space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Data Validation Warnings ({validationErrors.length}):</span>
                  </div>
                  {validationErrors.slice(0, 10).map((err, i) => (
                    <div key={i} className="text-[11px] text-slate-600 dark:text-slate-400 pl-5">
                      • {err.message}
                    </div>
                  ))}
                  {validationErrors.length > 10 && (
                    <div className="text-[10px] text-slate-400 pl-5">
                      ...and {validationErrors.length - 10} more warnings.
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table of Containers */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Container No</th>
                      <th className="py-2 px-3">Seal / BL</th>
                      <th className="py-2 px-3">Extra (kg)</th>
                      <th className="py-2 px-2 text-center">Vehicles</th>
                      <th className="py-2 px-3">Models Inside</th>
                      <th className="py-2 px-3 text-right">Total CBM</th>
                      <th className="py-2 px-3 text-right">Total Wt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedContainers.slice(0, 15).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {c.containerNo}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">{c.sealOrBlNo || '-'}</td>
                        <td className="py-2 px-3 font-mono">{c.extraValue}</td>
                        <td className="py-2 px-2 text-center font-mono font-semibold">{c.vehicles.length}</td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {c.models.map((m, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                          {c.totalCbm.toFixed(3)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {c.totalWeight.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedContainers.length > 15 && (
                <div className="text-center text-[11px] text-slate-500">
                  Showing first 15 of {parsedContainers.length} containers. All will be imported into IndexedDB.
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 px-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Writing Containers to Local Database...
              </h3>
              <p className="text-xs text-slate-500">
                Processed {importProgress.processed} of {importProgress.total} container records
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-md mx-auto bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-sky-600 h-full transition-all duration-150 rounded-full"
                  style={{
                    width: `${importProgress.total > 0 ? (importProgress.processed / importProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
          {step === 'preview' ? (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Back to Upload
              </button>
              <button
                onClick={executeImport}
                disabled={parsedContainers.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Import {parsedContainers.length} Plans</span>
              </button>
            </>
          ) : step === 'upload' ? (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="w-full text-center text-xs text-slate-400">Please do not close this window</div>
          )}
        </div>
      </div>
    </div>
  );
};
