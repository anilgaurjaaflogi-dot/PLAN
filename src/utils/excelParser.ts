import * as XLSX from 'xlsx';
import { Container, Vehicle } from '../types';
import { calculateCbm, extractChassisPrefix, hasCbmMismatch } from './chassisParser';

export interface ParsedImportResult {
  containers: Container[];
  errors: Array<{ row?: number; containerNo?: string; message: string; severity: 'error' | 'warning' }>;
  detectedFormat: 'block' | 'flat';
  totalVehicles: number;
}

export interface ColumnMapping {
  serialNoCol: number;
  makeCol: number;
  modelCol: number;
  engineCcCol: number;
  fuelCol: number;
  yearCol: number;
  vehicleIdCol: number;
  chassisNoCol: number;
  lengthCol: number;
  widthCol: number;
  heightCol: number;
  qtyCol: number;
  priceCol: number;
  weightCol: number;
  cbmCol: number;
  remarkCol?: number;
  // If flat format:
  containerNoCol?: number;
  sealNoCol?: number;
  extraCol?: number;
}

export const DEFAULT_BLOCK_MAPPING: ColumnMapping = {
  serialNoCol: 1, // Column B
  makeCol: 2, // Column C
  modelCol: 3, // Column D
  engineCcCol: 4, // Column E
  fuelCol: 5, // Column F
  yearCol: 6, // Column G
  vehicleIdCol: 7, // Column H
  chassisNoCol: 8, // Column I
  lengthCol: 9, // Column J
  widthCol: 10, // Column K
  heightCol: 11, // Column L
  qtyCol: 12, // Column M
  priceCol: 13, // Column N
  weightCol: 14, // Column O
  cbmCol: 15, // Column P
  remarkCol: 16, // Column Q
};

export const DEFAULT_FLAT_MAPPING: ColumnMapping = {
  containerNoCol: 0,
  sealNoCol: 1,
  extraCol: 2,
  serialNoCol: 3,
  makeCol: 4,
  modelCol: 5,
  engineCcCol: 6,
  fuelCol: 7,
  yearCol: 8,
  vehicleIdCol: 9,
  chassisNoCol: 10,
  lengthCol: 11,
  widthCol: 12,
  heightCol: 13,
  qtyCol: 14,
  priceCol: 15,
  weightCol: 16,
  cbmCol: 17,
  remarkCol: 18,
};

function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function safeNumber(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

/**
 * Parses 2D array of rows into containers and vehicles.
 */
export function parseGridData(
  grid: any[][],
  forcedFormat?: 'block' | 'flat',
  mapping: ColumnMapping = DEFAULT_BLOCK_MAPPING
): ParsedImportResult {
  const errors: ParsedImportResult['errors'] = [];
  const containers: Container[] = [];

  if (!grid || grid.length === 0) {
    return { containers, errors: [{ message: 'The uploaded file or text has no data.', severity: 'error' }], detectedFormat: 'block', totalVehicles: 0 };
  }

  // Detect format if not forced
  let detectedFormat: 'block' | 'flat' = forcedFormat || 'block';
  if (!forcedFormat) {
    // Check first few rows
    let hasContainerColHeader = false;
    const headerRow = grid[0] || [];
    const headerText = headerRow.map((c) => safeString(c).toLowerCase()).join(' ');
    if (headerText.includes('container') && headerText.includes('chassis') && headerText.includes('make')) {
      // Looks like a header row. If column A is "Container No", check if multiple consecutive rows have container values
      hasContainerColHeader = true;
    }

    // Check if col A contains container numbers on almost every non-empty row (flat)
    // or if col A only has values on row 1-3 then blanks (block)
    let colAFilledCount = 0;
    let totalNonEmptyRows = 0;
    for (let r = 0; r < Math.min(grid.length, 25); r++) {
      const row = grid[r];
      if (row && row.some((c) => safeString(c) !== '')) {
        totalNonEmptyRows++;
        if (safeString(row[0]) !== '') {
          colAFilledCount++;
        }
      }
    }

    if (hasContainerColHeader || (totalNonEmptyRows > 6 && colAFilledCount / totalNonEmptyRows > 0.85)) {
      detectedFormat = 'flat';
    } else {
      detectedFormat = 'block';
    }
  }

  // Skip header row if it contains column names
  let startRow = 0;
  const firstRowStr = (grid[0] || []).map((c) => safeString(c).toLowerCase()).join(' ');
  if (firstRowStr.includes('make') || firstRowStr.includes('chassis') || firstRowStr.includes('model') || firstRowStr.includes('serial')) {
    startRow = 1;
  }

  if (detectedFormat === 'flat') {
    // FLAT FORMAT PARSER
    const containersMap = new Map<string, Container>();

    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r];
      if (!row || row.every((c) => safeString(c) === '')) continue;

      const cNoCol = mapping.containerNoCol !== undefined ? mapping.containerNoCol : 0;
      const sNoCol = mapping.sealNoCol !== undefined ? mapping.sealNoCol : 1;
      const extCol = mapping.extraCol !== undefined ? mapping.extraCol : 2;

      let cNo = safeString(row[cNoCol]);
      const seal = safeString(row[sNoCol]);
      const extra = safeString(row[extCol]);

      if (!cNo) {
        cNo = `UNKNOWN-${r + 1}`;
        errors.push({ row: r + 1, message: `Row ${r + 1}: Missing container number, labeled as ${cNo}`, severity: 'warning' });
      }

      if (!containersMap.has(cNo)) {
        containersMap.set(cNo, {
          containerNo: cNo,
          sealOrBlNo: seal,
          extraValue: extra || 0,
          vehicles: [],
          totalCbm: 0,
          totalWeight: 0,
          totalPrice: 0,
          vehicleCount: 0,
          models: [],
          chassisPrefixes: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const container = containersMap.get(cNo)!;
      const serialNo = safeNumber(row[mapping.serialNoCol], container.vehicles.length + 1);
      const make = safeString(row[mapping.makeCol]);
      const model = safeString(row[mapping.modelCol]);
      const engineCC = safeNumber(row[mapping.engineCcCol]);
      const fuel = safeString(row[mapping.fuelCol]) || 'D';
      const year = safeNumber(row[mapping.yearCol]);
      const vehicleIdNo = safeString(row[mapping.vehicleIdCol]);
      const chassisNo = safeString(row[mapping.chassisNoCol]);
      const length = safeNumber(row[mapping.lengthCol]);
      const width = safeNumber(row[mapping.widthCol]);
      const height = safeNumber(row[mapping.heightCol]);
      const qty = safeNumber(row[mapping.qtyCol], 1);
      const price = safeNumber(row[mapping.priceCol]);
      const weight = safeNumber(row[mapping.weightCol]);
      const cbm = safeNumber(row[mapping.cbmCol]);
      const remark = mapping.remarkCol !== undefined ? safeString(row[mapping.remarkCol]) : '';
      if (remark && !container.remark) {
        container.remark = remark;
      }

      const prefix = extractChassisPrefix(chassisNo);
      const calcCbm = calculateCbm(length, width, height);
      const cbmMismatch = hasCbmMismatch(cbm, calcCbm);

      if (!chassisNo) {
        errors.push({ row: r + 1, containerNo: cNo, message: `Row ${r + 1}: Missing chassis number for model "${model || 'Unknown'}"`, severity: 'warning' });
      }
      if (cbmMismatch) {
        errors.push({ row: r + 1, containerNo: cNo, message: `Row ${r + 1}: CBM mismatch (Sheet: ${cbm}, Calculated L*W*H: ${calcCbm})`, severity: 'warning' });
      }

      const vehicle: Vehicle = {
        id: `imp-${Date.now()}-${r}`,
        serialNo,
        make: make.toUpperCase(),
        model: model.toUpperCase(),
        engineCC,
        fuel: fuel.toUpperCase(),
        year,
        vehicleIdNo,
        chassisNo,
        chassisPrefix: prefix,
        length,
        width,
        height,
        qty,
        price,
        weight,
        cbm: cbm || calcCbm,
        calculatedCbm: calcCbm,
        cbmMismatch,
        containerNo: cNo,
        remark: remark || undefined,
      };

      container.vehicles.push(vehicle);
    }

    containersMap.forEach((c) => {
      let tCbm = 0;
      let tWeight = 0;
      let tPrice = 0;
      const mSet = new Set<string>();
      const pSet = new Set<string>();
      c.vehicles.forEach((v) => {
        tCbm += v.cbm || 0;
        tWeight += v.weight || 0;
        tPrice += v.price || 0;
        if (v.model) mSet.add(v.model);
        if (v.chassisPrefix) pSet.add(v.chassisPrefix);
      });
      c.totalCbm = Math.round(tCbm * 1000) / 1000;
      c.totalWeight = tWeight;
      c.totalPrice = tPrice;
      c.vehicleCount = c.vehicles.length;
      c.models = Array.from(mSet);
      c.chassisPrefixes = Array.from(pSet);
      containers.push(c);
    });
  } else {
    // STACKED BLOCK FORMAT PARSER
    // Containers are separated by blank rows.
    // Row 1 of block: Col A = containerNo, Col B onward = vehicle 1
    // Row 2 of block: Col A = sealOrBlNo, Col B onward = vehicle 2
    // Row 3 of block: Col A = extraValue, Col B onward = vehicle 3
    // Row 4 of block: Col A is blank, Col B onward = vehicle 4
    let currentContainer: Partial<Container> | null = null;
    let blockRowIndex = 0;

    const finalizeContainer = () => {
      if (currentContainer && (currentContainer.containerNo || (currentContainer.vehicles && currentContainer.vehicles.length > 0))) {
        const vehicles = currentContainer.vehicles || [];
        let tCbm = 0;
        let tWeight = 0;
        let tPrice = 0;
        const mSet = new Set<string>();
        const pSet = new Set<string>();
        vehicles.forEach((v) => {
          tCbm += v.cbm || 0;
          tWeight += v.weight || 0;
          tPrice += v.price || 0;
          if (v.model) mSet.add(v.model);
          if (v.chassisPrefix) pSet.add(v.chassisPrefix);
        });
        containers.push({
          containerNo: currentContainer.containerNo || `TBA-${containers.length + 1}`,
          sealOrBlNo: currentContainer.sealOrBlNo || '',
          extraValue: currentContainer.extraValue || 0,
          vehicles,
          totalCbm: Math.round(tCbm * 1000) / 1000,
          totalWeight: tWeight,
          totalPrice: tPrice,
          vehicleCount: vehicles.length,
          models: Array.from(mSet),
          chassisPrefixes: Array.from(pSet),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      currentContainer = null;
      blockRowIndex = 0;
    };

    for (let r = startRow; r < grid.length; r++) {
      const row = grid[r];
      const isBlankRow = !row || row.every((c) => safeString(c) === '');

      if (isBlankRow) {
        if (currentContainer) {
          finalizeContainer();
        }
        continue;
      }

      const colAVal = safeString(row[0]);
      const hasVehicleData = row.slice(1).some((c) => safeString(c) !== '');

      // Check if this starts a new container block
      // If blockRowIndex === 0 or if colA looks like a container number and we don't have a container
      if (!currentContainer) {
        currentContainer = {
          containerNo: colAVal || `TBA-${containers.length + 1}`,
          sealOrBlNo: '',
          extraValue: 0,
          vehicles: [],
        };
        blockRowIndex = 0;
      } else {
        blockRowIndex++;
        if (blockRowIndex === 1 && colAVal) {
          currentContainer.sealOrBlNo = colAVal;
        } else if (blockRowIndex === 2 && colAVal) {
          currentContainer.extraValue = safeNumber(colAVal, colAVal as any);
        }
      }

      // If columns B onward have vehicle data, parse vehicle
      if (hasVehicleData) {
        const serialNo = safeNumber(row[mapping.serialNoCol], (currentContainer.vehicles?.length || 0) + 1);
        const make = safeString(row[mapping.makeCol]);
        const model = safeString(row[mapping.modelCol]);
        const engineCC = safeNumber(row[mapping.engineCcCol]);
        const fuel = safeString(row[mapping.fuelCol]) || 'D';
        const year = safeNumber(row[mapping.yearCol]);
        const vehicleIdNo = safeString(row[mapping.vehicleIdCol]);
        const chassisNo = safeString(row[mapping.chassisNoCol]);
        const length = safeNumber(row[mapping.lengthCol]);
        const width = safeNumber(row[mapping.widthCol]);
        const height = safeNumber(row[mapping.heightCol]);
        const qty = safeNumber(row[mapping.qtyCol], 1);
        const price = safeNumber(row[mapping.priceCol]);
        const weight = safeNumber(row[mapping.weightCol]);
        const cbm = safeNumber(row[mapping.cbmCol]);
        const remark = mapping.remarkCol !== undefined ? safeString(row[mapping.remarkCol]) : '';
        if (remark && !currentContainer.remark) {
          currentContainer.remark = remark;
        }

        const prefix = extractChassisPrefix(chassisNo);
        const calcCbm = calculateCbm(length, width, height);
        const cbmMismatch = hasCbmMismatch(cbm, calcCbm);

        if (!chassisNo && !model) {
          // Might just be an extra metadata row, skip if completely empty of model/chassis
          continue;
        }

        if (!chassisNo) {
          errors.push({ row: r + 1, containerNo: currentContainer.containerNo, message: `Row ${r + 1}: Missing chassis number for model "${model || 'Unknown'}"`, severity: 'warning' });
        }
        if (cbmMismatch) {
          errors.push({ row: r + 1, containerNo: currentContainer.containerNo, message: `Row ${r + 1}: CBM mismatch (Sheet: ${cbm}, Calculated L*W*H: ${calcCbm})`, severity: 'warning' });
        }

        const vehicle: Vehicle = {
          id: `imp-${Date.now()}-${r}`,
          serialNo,
          make: make.toUpperCase(),
          model: model.toUpperCase(),
          engineCC,
          fuel: fuel.toUpperCase(),
          year,
          vehicleIdNo,
          chassisNo,
          chassisPrefix: prefix,
          length,
          width,
          height,
          qty,
          price,
          weight,
          cbm: cbm || calcCbm,
          calculatedCbm: calcCbm,
          cbmMismatch,
          containerNo: currentContainer.containerNo,
          remark: remark || undefined,
        };

        currentContainer.vehicles!.push(vehicle);
      }
    }

    if (currentContainer) {
      finalizeContainer();
    }
  }

  const totalVehicles = containers.reduce((acc, c) => acc + c.vehicles.length, 0);
  return { containers, errors, detectedFormat, totalVehicles };
}

/**
 * Parses an Excel file (.xlsx, .xls, .csv) into grid data.
 */
export async function parseExcelFile(file: File): Promise<any[][]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const json: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  return json;
}

/**
 * Parses raw pasted tab-separated or comma-separated text into grid data.
 */
export function parsePastedText(text: string): any[][] {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    // If contains tabs, split by tab; otherwise split by comma if comma separated
    if (line.includes('\t')) {
      return line.split('\t');
    }
    // Simple CSV parse with quote handling
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  });
}

/**
 * Exports containers to an Excel (.xlsx) file in the user's authentic stacked block layout.
 */
export function exportContainersToExcel(containers: Container[], filename = 'Container_Plans_Export.xlsx'): void {
  const rows: any[][] = [];

  // Add standard header row
  rows.push([
    'Container / Seal / Extra',
    'No',
    'Make',
    'Model',
    'Engine CC',
    'Fuel',
    'Year',
    'Vehicle ID',
    'Chassis No',
    'Length (cm)',
    'Width (cm)',
    'Height (cm)',
    'Qty',
    'Price (JPY)',
    'Weight (kg)',
    'CBM',
    'Remark',
  ]);

  containers.forEach((c) => {
    const vCount = Math.max(c.vehicles.length, 4);

    for (let i = 0; i < vCount; i++) {
      const v = c.vehicles[i];
      let colA = '';
      if (i === 0) colA = c.containerNo;
      else if (i === 1) colA = c.sealOrBlNo || '';
      else if (i === 2) colA = String(c.extraValue || '');

      // Container remark on first row, or vehicle remark
      const remarkVal = (i === 0 && c.remark) ? c.remark : (v?.remark || '');

      if (v) {
        rows.push([
          colA,
          v.serialNo || i + 1,
          v.make || '',
          v.model || '',
          v.engineCC || '',
          v.fuel || '',
          v.year || '',
          v.vehicleIdNo || '',
          v.chassisNo || '',
          v.length || '',
          v.width || '',
          v.height || '',
          v.qty || 1,
          v.price || '',
          v.weight || '',
          v.cbm || '',
          remarkVal,
        ]);
      } else {
        // Empty vehicle slot
        rows.push([colA, i + 1, '', '', '', '', '', '', '', '', '', '', '', '', '', '', remarkVal]);
      }
    }

    // Blank separator row between containers
    rows.push([]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set nice column widths
  worksheet['!cols'] = [
    { wch: 18 }, // Col A
    { wch: 5 },  // No
    { wch: 14 }, // Make
    { wch: 14 }, // Model
    { wch: 10 }, // CC
    { wch: 6 },  // Fuel
    { wch: 7 },  // Year
    { wch: 20 }, // ID
    { wch: 18 }, // Chassis
    { wch: 10 }, // L
    { wch: 10 }, // W
    { wch: 10 }, // H
    { wch: 5 },  // Qty
    { wch: 13 }, // Price
    { wch: 11 }, // Weight
    { wch: 9 },  // CBM
    { wch: 25 }, // Remark
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Container Plans');
  XLSX.writeFile(workbook, filename);
}

/**
 * Downloads a ready-to-use Excel template with sample stacked blocks.
 */
export function downloadBlankExcelTemplate(): void {
  const sampleContainers: Container[] = [
    {
      containerNo: 'MSKU0113466',
      sealOrBlNo: 'ML-JP0409806',
      extraValue: 4000,
      vehicles: [
        {
          id: 'tpl-1',
          serialNo: 1,
          make: 'MITSUBISHI',
          model: 'CANTER',
          engineCC: 3560,
          fuel: 'D',
          year: 1990,
          vehicleIdNo: '3422024991969555',
          chassisNo: 'FE315BD-445529',
          chassisPrefix: 'FE315BD',
          length: 469,
          width: 169,
          height: 199,
          qty: 1,
          price: 2340000,
          weight: 2630,
          cbm: 15.773,
        },
        {
          id: 'tpl-2',
          serialNo: 2,
          make: 'TOYOTA',
          model: 'WISH',
          engineCC: 1790,
          fuel: 'G',
          year: 2012,
          vehicleIdNo: '36130359C1958023',
          chassisNo: 'ZGE20-0134978',
          chassisPrefix: 'ZGE20',
          length: 459,
          width: 169,
          height: 159,
          qty: 1,
          price: 420000,
          weight: 1350,
          cbm: 12.334,
        },
        {
          id: 'tpl-3',
          serialNo: 3,
          make: 'TOYOTA',
          model: 'HIACE',
          engineCC: 2980,
          fuel: 'D',
          year: 2012,
          vehicleIdNo: '3471034303155005',
          chassisNo: 'KDH206-8053689',
          chassisPrefix: 'KDH206',
          length: 469,
          width: 170,
          height: 193,
          qty: 1,
          price: 920000,
          weight: 2220,
          cbm: 15.388,
        },
        {
          id: 'tpl-4',
          serialNo: 4,
          make: 'ISUZU',
          model: 'ELF',
          engineCC: 3630,
          fuel: 'D',
          year: 1991,
          vehicleIdNo: '2111020112654821',
          chassisNo: 'NPR58P7106494',
          chassisPrefix: 'NPR58P',
          length: 674,
          width: 203,
          height: 235,
          qty: 1,
          price: 1040000,
          weight: 2770,
          cbm: 32.153,
        },
      ],
      totalCbm: 75.648,
      totalWeight: 8970,
      totalPrice: 4720000,
      vehicleCount: 4,
      models: ['CANTER', 'WISH', 'HIACE', 'ELF'],
      chassisPrefixes: ['FE315BD', 'ZGE20', 'KDH206', 'NPR58P'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  exportContainersToExcel(sampleContainers, 'Container_Plan_Template.xlsx');
}

/**
 * Downloads a complete JSON database backup.
 */
export function exportDatabaseBackup(containers: Container[]): void {
  const data = {
    appName: 'Container Plan Manager',
    exportDate: new Date().toISOString(),
    totalContainers: containers.length,
    containers,
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Container_Plans_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
