import React from 'react';
import { X, Printer, Copy, Download, Check } from 'lucide-react';
import { Container, PlannedContainer } from '../types';
import { formatContainerForWhatsApp, copyToClipboard } from '../utils/whatsappFormatter';
import { exportContainersToExcel } from '../utils/excelParser';
import { useApp } from '../context/AppContext';

interface PrintModalProps {
  container: Container | PlannedContainer | null;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({ container, onClose }) => {
  const { addToast } = useApp();
  const [copied, setCopied] = React.useState(false);

  if (!container) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsApp = async () => {
    const text = formatContainerForWhatsApp(container);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast({
        type: 'success',
        title: 'Copied for WhatsApp',
        description: 'Formatted container manifest copied to clipboard.',
      });
    }
  };

  const handleExportSingle = () => {
    const asRealContainer: Container = {
      containerNo: container.containerNo || 'TBA',
      sealOrBlNo: container.sealOrBlNo || '',
      extraValue: container.extraValue || 0,
      vehicles: container.vehicles,
      totalCbm: container.totalCbm,
      totalWeight: container.totalWeight,
      totalPrice: container.totalPrice,
      vehicleCount: container.vehicles.length,
      models: Array.from(new Set(container.vehicles.map((v) => v.model))),
      chassisPrefixes: Array.from(new Set(container.vehicles.map((v) => v.chassisPrefix))),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    exportContainersToExcel([asRealContainer], `Container_${container.containerNo || 'Plan'}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full my-auto overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none print:text-black">
        {/* Top Control Bar (Hidden during print) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Container Loading Sheet / Vanning Plan
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-semibold">
              {container.containerNo || 'TBA'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'WhatsApp'}</span>
            </button>
            <button
              onClick={handleExportSingle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 print:text-black print:bg-white print:p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-slate-900 dark:border-slate-700 print:border-black">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase">
                Container Vanning & Loading Manifest
              </h1>
              <p className="text-xs text-slate-500 print:text-gray-600 mt-1">
                Japanese Used Vehicle Export Logistics Plan • 40HC Shipping Specification
              </p>
            </div>
            <div className="text-right sm:self-end text-xs font-mono">
              <div>Date: {new Date().toLocaleDateString('ja-JP')}</div>
              <div>Doc Ref: CPM-{Date.now().toString().slice(-6)}</div>
            </div>
          </div>

          {/* Container Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:border-gray-300 print:bg-gray-50">
              <span className="text-slate-500 print:text-gray-600 block text-[10px] uppercase font-semibold">
                Container Number
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 print:text-black">
                {container.containerNo || 'TBA'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:border-gray-300 print:bg-gray-50">
              <span className="text-slate-500 print:text-gray-600 block text-[10px] uppercase font-semibold">
                Seal / B/L Number
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 print:text-black">
                {container.sealOrBlNo || 'TBA'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:border-gray-300 print:bg-gray-50">
              <span className="text-slate-500 print:text-gray-600 block text-[10px] uppercase font-semibold">
                Tare / Extra Weight
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 print:text-black">
                {container.extraValue ? `${container.extraValue} kg` : 'N/A'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 print:border-gray-300 print:bg-gray-50">
              <span className="text-slate-500 print:text-gray-600 block text-[10px] uppercase font-semibold">
                Vehicles Loaded
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 print:text-black">
                {container.vehicles.length} Units
              </span>
            </div>
          </div>

          {/* Vehicle Manifest Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg print:border-gray-400">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 print:bg-gray-200 print:text-black font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-3">Vehicle / Model</th>
                  <th className="py-2.5 px-3">Chassis No</th>
                  <th className="py-2.5 px-2">Prefix</th>
                  <th className="py-2.5 px-2 text-center">Fuel</th>
                  <th className="py-2.5 px-2 text-center">Year</th>
                  <th className="py-2.5 px-3 text-right">L × W × H (cm)</th>
                  <th className="py-2.5 px-3 text-right">Weight (kg)</th>
                  <th className="py-2.5 px-3 text-right">CBM (m³)</th>
                  <th className="py-2.5 px-3 text-right">Price (JPY)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-gray-300">
                {container.vehicles.map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-2 text-center font-mono font-semibold">{v.serialNo || i + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 print:text-black">
                        {v.make} {v.model}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{v.vehicleIdNo || ''}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-medium">{v.chassisNo}</td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-sky-600 dark:text-sky-400 print:text-black">
                      {v.chassisPrefix}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${v.fuel === 'D' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                        {v.fuel}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono">{v.year || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300 print:text-black">
                      {v.length}×{v.width}×{v.height}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                      {v.weight?.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-sky-600 dark:text-sky-400 print:text-black tabular-nums">
                      {v.cbm?.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {v.price ? `¥${v.price.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-950 font-bold border-t-2 border-slate-300 dark:border-slate-700 print:bg-gray-100 print:border-black">
                  <td colSpan={7} className="py-3 px-3 text-right uppercase tracking-wider text-[11px]">
                    Container Totals:
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {container.totalWeight?.toLocaleString()} kg
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sky-600 dark:text-sky-400 print:text-black tabular-nums">
                    {container.totalCbm?.toFixed(3)} m³
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {container.totalPrice ? `¥${container.totalPrice.toLocaleString()}` : '-'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Vanning Verification & Signatures */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800 print:border-black text-xs">
            <div>
              <div className="text-[11px] text-slate-500 print:text-gray-600 uppercase font-semibold mb-6">
                Vanning Supervisor / Yard Staff:
              </div>
              <div className="border-b border-dashed border-slate-400 print:border-black h-4 w-48"></div>
              <div className="text-[10px] text-slate-400 mt-1">Signature / Date</div>
            </div>

            <div>
              <div className="text-[11px] text-slate-500 print:text-gray-600 uppercase font-semibold mb-6">
                Customs / BL Verification:
              </div>
              <div className="border-b border-dashed border-slate-400 print:border-black h-4 w-48"></div>
              <div className="text-[10px] text-slate-400 mt-1">Stamp / Clearance</div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 print:border-gray-300 text-[11px]">
              <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Container Utilization
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                <div>Max Volume: 76.0 CBM ({((container.totalCbm / 76) * 100).toFixed(1)}% full)</div>
                <div>Max Weight: 26,500 kg ({((container.totalWeight / 26500) * 100).toFixed(1)}% limit)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
