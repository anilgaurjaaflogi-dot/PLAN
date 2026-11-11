import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Container, Vehicle } from '../types';
import { calculateCbm, extractChassisPrefix, hasCbmMismatch } from '../utils/chassisParser';
import { addContainerWithVehicles, updateContainerWithVehicles, getDistinctModels, getDistinctMakes } from '../db/db';
import { saveContainerToFirestore } from '../firebase/firestoreService';
import { useApp } from '../context/AppContext';

interface NewContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editContainer?: Container | null;
  onSaved: () => void;
}

export const NewContainerModal: React.FC<NewContainerModalProps> = ({
  isOpen,
  onClose,
  editContainer,
  onSaved,
}) => {
  const { addToast } = useApp();
  const [containerNo, setContainerNo] = useState('');
  const [sealOrBlNo, setSealOrBlNo] = useState('');
  const [extraValue, setExtraValue] = useState<number | string>(4000);
  const [remark, setRemark] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [knownModels, setKnownModels] = useState<string[]>([]);
  const [knownMakes, setKnownMakes] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      getDistinctModels().then(setKnownModels);
      getDistinctMakes().then(setKnownMakes);

      if (editContainer) {
        setContainerNo(editContainer.containerNo);
        setSealOrBlNo(editContainer.sealOrBlNo || '');
        setExtraValue(editContainer.extraValue || 4000);
        setRemark(editContainer.remark || '');
        setVehicles(
          editContainer.vehicles.map((v) => ({
            ...v,
            calculatedCbm: calculateCbm(v.length, v.width, v.height),
            cbmMismatch: hasCbmMismatch(v.cbm, calculateCbm(v.length, v.width, v.height)),
          }))
        );
      } else {
        // Initialize with 4 blank vehicle slots
        setContainerNo('');
        setSealOrBlNo('');
        setExtraValue(4000);
        setRemark('');
        const blankVehicles: Vehicle[] = Array.from({ length: 4 }).map((_, i) => ({
          id: `new-v-${Date.now()}-${i}`,
          serialNo: i + 1,
          make: 'TOYOTA',
          model: '',
          engineCC: 2000,
          fuel: 'D',
          year: 2012,
          vehicleIdNo: '',
          chassisNo: '',
          chassisPrefix: '',
          length: 469,
          width: 169,
          height: 198,
          qty: 1,
          price: 1000000,
          weight: 2000,
          cbm: 15.694,
          calculatedCbm: 15.694,
          cbmMismatch: false,
        }));
        setVehicles(blankVehicles);
      }
    }
  }, [isOpen, editContainer]);

  if (!isOpen) return null;

  const handleVehicleChange = (index: number, field: keyof Vehicle, value: any) => {
    const updated = [...vehicles];
    const item = { ...updated[index], [field]: value };

    // Auto-extract chassis prefix if chassisNo changes
    if (field === 'chassisNo') {
      item.chassisPrefix = extractChassisPrefix(String(value));
    }

    // Auto calculate CBM if dimensions change
    if (field === 'length' || field === 'width' || field === 'height') {
      const l = field === 'length' ? Number(value) || 0 : item.length;
      const w = field === 'width' ? Number(value) || 0 : item.width;
      const h = field === 'height' ? Number(value) || 0 : item.height;
      const calc = calculateCbm(l, w, h);
      item.calculatedCbm = calc;
      // Also update recorded cbm if user hasn't overridden
      item.cbm = calc;
      item.cbmMismatch = false;
    }

    if (field === 'cbm') {
      item.cbmMismatch = hasCbmMismatch(Number(value) || 0, item.calculatedCbm || 0);
    }

    updated[index] = item;
    setVehicles(updated);
  };

  const handleAddVehicleSlot = () => {
    const nextSerial = vehicles.length + 1;
    setVehicles([
      ...vehicles,
      {
        id: `new-v-${Date.now()}-${nextSerial}`,
        serialNo: nextSerial,
        make: 'TOYOTA',
        model: '',
        engineCC: 2000,
        fuel: 'D',
        year: 2012,
        vehicleIdNo: '',
        chassisNo: '',
        chassisPrefix: '',
        length: 450,
        width: 170,
        height: 160,
        qty: 1,
        price: 500000,
        weight: 1500,
        cbm: 12.24,
        calculatedCbm: 12.24,
        cbmMismatch: false,
      },
    ]);
  };

  const handleRemoveVehicle = (index: number) => {
    if (vehicles.length <= 1) return;
    const updated = vehicles.filter((_, i) => i !== index);
    updated.forEach((v, i) => (v.serialNo = i + 1));
    setVehicles(updated);
  };

  const totalCbm = Math.round(vehicles.reduce((sum, v) => sum + (Number(v.cbm) || 0), 0) * 1000) / 1000;
  const totalWeight = vehicles.reduce((sum, v) => sum + (Number(v.weight) || 0), 0);
  const totalPrice = vehicles.reduce((sum, v) => sum + (Number(v.price) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!containerNo.trim()) {
      addToast({ type: 'warning', title: 'Container Number Required' });
      return;
    }

    // Filter out completely empty rows
    const validVehicles = vehicles.filter((v) => v.model.trim() || v.chassisNo.trim());
    if (validVehicles.length === 0) {
      addToast({ type: 'warning', title: 'At least 1 vehicle is required' });
      return;
    }

    try {
      const containerObj: Container = {
        containerNo: containerNo.trim().toUpperCase(),
        sealOrBlNo: sealOrBlNo.trim().toUpperCase(),
        extraValue: extraValue,
        remark: remark.trim() || undefined,
        vehicles: validVehicles,
        totalCbm,
        totalWeight,
        totalPrice,
        vehicleCount: validVehicles.length,
        models: Array.from(new Set(validVehicles.map((v) => v.model.trim().toUpperCase()))),
        chassisPrefixes: Array.from(new Set(validVehicles.map((v) => v.chassisPrefix.trim().toUpperCase()))),
        createdAt: editContainer ? editContainer.createdAt : Date.now(),
        updatedAt: Date.now(),
      };

      if (editContainer && editContainer.id) {
        await updateContainerWithVehicles(editContainer.id, containerObj);
        saveContainerToFirestore(containerObj).catch((e) => console.warn('Firestore sync note:', e));
        addToast({
          type: 'success',
          title: 'Container Updated',
          description: `Plan for ${containerObj.containerNo} updated successfully (local & cloud).`,
        });
      } else {
        await addContainerWithVehicles(containerObj);
        saveContainerToFirestore(containerObj).catch((e) => console.warn('Firestore sync note:', e));
        addToast({
          type: 'success',
          title: 'Container Added',
          description: `Plan for ${containerObj.containerNo} saved to library (local & cloud).`,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: err.message || 'Error writing to IndexedDB',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
          <div>
            <h2 className="font-bold text-base text-slate-900 dark:text-slate-100">
              {editContainer ? 'Edit Container Plan' : 'Add New Container Plan'}
            </h2>
            <p className="text-xs text-slate-500">
              Specify container info and vehicle manifest (auto CBM verification)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Container Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Container Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MSKU0113466"
                value={containerNo}
                onChange={(e) => setContainerNo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Seal / B/L Number
              </label>
              <input
                type="text"
                placeholder="e.g. ML-JP0409806"
                value={sealOrBlNo}
                onChange={(e) => setSealOrBlNo(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Extra / Tare Weight (kg)
              </label>
              <input
                type="text"
                placeholder="e.g. 4000"
                value={extraValue}
                onChange={(e) => setExtraValue(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remark / टिप्पणी (Notes)
              </label>
              <input
                type="text"
                placeholder="e.g. Special loading, Priority"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Vehicle Rows Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                Vehicles in Container ({vehicles.length})
              </div>
              <button
                type="button"
                onClick={handleAddVehicleSlot}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 rounded-lg hover:bg-sky-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle Slot</span>
              </button>
            </div>

            <div className="space-y-3">
              {vehicles.map((v, i) => (
                <div
                  key={v.id || i}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">
                      Vehicle #{i + 1}
                    </span>
                    {vehicles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveVehicle(i)}
                        className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        title="Remove vehicle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Primary info row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Make</label>
                      <input
                        type="text"
                        list="makes-list"
                        value={v.make}
                        onChange={(e) => handleVehicleChange(i, 'make', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        placeholder="TOYOTA"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Model *</label>
                      <input
                        type="text"
                        list="models-list"
                        required
                        value={v.model}
                        onChange={(e) => handleVehicleChange(i, 'model', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        placeholder="HIACE"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Chassis No *</label>
                      <input
                        type="text"
                        required
                        value={v.chassisNo}
                        onChange={(e) => handleVehicleChange(i, 'chassisNo', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                        placeholder="KDH206-8053689"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Prefix (Auto)</label>
                      <input
                        type="text"
                        value={v.chassisPrefix}
                        onChange={(e) => handleVehicleChange(i, 'chassisPrefix', e.target.value.toUpperCase())}
                        className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sky-600 dark:text-sky-400"
                        placeholder="KDH206"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Fuel / CC</label>
                      <div className="flex gap-1">
                        <select
                          value={v.fuel}
                          onChange={(e) => handleVehicleChange(i, 'fuel', e.target.value)}
                          className="w-16 px-1.5 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        >
                          <option value="D">D (Diesel)</option>
                          <option value="G">G (Petrol)</option>
                          <option value="H">H (Hybrid)</option>
                          <option value="E">E (EV)</option>
                        </select>
                        <input
                          type="number"
                          value={v.engineCC || ''}
                          onChange={(e) => handleVehicleChange(i, 'engineCC', Number(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                          placeholder="CC"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Year</label>
                      <input
                        type="number"
                        value={v.year || ''}
                        onChange={(e) => handleVehicleChange(i, 'year', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        placeholder="2012"
                      />
                    </div>
                  </div>

                  {/* Dimensions & CBM row */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs pt-1">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Length (cm)</label>
                      <input
                        type="number"
                        value={v.length || ''}
                        onChange={(e) => handleVehicleChange(i, 'length', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        placeholder="469"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Width (cm)</label>
                      <input
                        type="number"
                        value={v.width || ''}
                        onChange={(e) => handleVehicleChange(i, 'width', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        placeholder="170"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Height (cm)</label>
                      <input
                        type="number"
                        value={v.height || ''}
                        onChange={(e) => handleVehicleChange(i, 'height', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        placeholder="193"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Weight (kg)</label>
                      <input
                        type="number"
                        value={v.weight || ''}
                        onChange={(e) => handleVehicleChange(i, 'weight', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-semibold"
                        placeholder="2220"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold flex items-center justify-between">
                        <span>CBM (m³)</span>
                        {v.cbmMismatch && (
                          <span className="text-[9px] text-amber-500 flex items-center gap-0.5" title="Differs from L*W*H/1M">
                            <AlertCircle className="w-2.5 h-2.5" /> mismatch
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={v.cbm || ''}
                        onChange={(e) => handleVehicleChange(i, 'cbm', Number(e.target.value) || 0)}
                        className={`w-full px-2 py-1.5 text-xs rounded border bg-white dark:bg-slate-950 font-mono font-bold ${
                          v.cbmMismatch ? 'border-amber-400 text-amber-600' : 'border-slate-300 dark:border-slate-700 text-sky-600 dark:text-sky-400'
                        }`}
                        placeholder="15.388"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Price (JPY)</label>
                      <input
                        type="number"
                        value={v.price || ''}
                        onChange={(e) => handleVehicleChange(i, 'price', Number(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                        placeholder="920000"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Datalists for autocompletion */}
          <datalist id="models-list">
            {knownModels.map((m, idx) => (
              <option key={idx} value={m} />
            ))}
          </datalist>
          <datalist id="makes-list">
            {knownMakes.map((m, idx) => (
              <option key={idx} value={m} />
            ))}
          </datalist>
        </form>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500">Total CBM: </span>
              <strong className="text-sky-600 dark:text-sky-400">{totalCbm.toFixed(3)} m³</strong>
            </div>
            <div>
              <span className="text-slate-500">Total Wt: </span>
              <strong className="text-slate-900 dark:text-slate-100">{totalWeight.toLocaleString()} kg</strong>
            </div>
            <div>
              <span className="text-slate-500">Value: </span>
              <strong className="text-slate-900 dark:text-slate-100">¥{totalPrice.toLocaleString()}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Save Container Plan</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
