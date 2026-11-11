/**
 * Types for Container Plan Manager
 * Japanese Used-Vehicle Export Container Planning
 */

export interface Vehicle {
  id: string; // unique UUID
  containerId?: number; // foreign key to Container
  containerNo?: string;
  serialNo: number; // 1, 2, 3, 4
  make: string; // MITSUBISHI, TOYOTA, ISUZU, NISSAN, etc.
  model: string; // CANTER, WISH, HIACE, ELF, etc.
  engineCC: number; // e.g. 3560
  fuel: string; // 'D' (Diesel), 'G' (Petrol/Gasoline), 'H' (Hybrid), 'E' (Electric)
  year: number; // e.g. 1990, 2012
  vehicleIdNo: string; // 16-digit or alpha-num number like 3422024991969555
  chassisNo: string; // FE315BD-445529, NPR58P7106494
  chassisPrefix: string; // FE315BD, ZGE20, KDH206, NPR58P
  length: number; // cm
  width: number; // cm
  height: number; // cm
  qty: number; // usually 1
  price: number; // JPY (e.g. 2340000)
  weight: number; // kg (e.g. 2630)
  cbm: number; // e.g. 15.773
  calculatedCbm?: number; // (L * W * H) / 1,000,000
  cbmMismatch?: boolean;
  remark?: string;
}

export interface Container {
  id?: number; // Dexie auto-increment primary key
  containerNo: string; // e.g. MSKU0113466
  sealOrBlNo: string; // e.g. ML-JP0409806
  extraValue: number | string; // e.g. 4000 / 3790 (Tare/Cargo Extra Weight or customs field)
  vehicles: Vehicle[];
  totalCbm: number;
  totalWeight: number;
  totalPrice: number;
  vehicleCount: number;
  models: string[]; // for fast indexing e.g. ['CANTER', 'WISH', 'HIACE', 'ELF']
  chassisPrefixes: string[]; // for fast indexing
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  notes?: string;
  remark?: string; // Plan Remark / Notes
  matchedFromContainerNo?: string; // if generated via Plan Builder pattern match
}

export interface AppUserAccess {
  id: string; // uid or email key
  email: string;
  displayName?: string;
  role: 'admin' | 'staff' | 'viewer';
  status: 'active' | 'blocked';
  createdAt: number;
  lastActive?: number;
  blockedReason?: string;
}

export interface AccessControlConfig {
  requireApproval: boolean;
  adminEmail: string;
  blockedEmails: string[];
}

export interface ContainerPreset {
  id: string;
  name: string;
  description: string;
  maxVehicles: number;
  maxCbm: number; // e.g. 76 for 40HC
  maxWeightKg: number; // e.g. 26500 kg
  maxLengthCm: number; // e.g. 2400 cm
}

export interface AppSettings {
  showHinglish: boolean;
  theme: 'light' | 'dark' | 'system';
  activePresetId: string;
  maxVehicles: number;
  maxCbm: number;
  maxWeightKg: number;
  maxLengthCm: number;
  autoSaveNewModels: boolean;
}

export interface VehicleLookupSpec {
  make: string;
  model: string;
  chassisPrefix: string;
  engineCC: number;
  fuel: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  cbm: number;
  frequency: number;
  lastSeenYear?: number;
}

export interface PlanBuilderRequestItem {
  id: string;
  model: string;
  chassisPrefix?: string;
  qty: number;
  // Resolved specs
  resolvedSpec?: VehicleLookupSpec;
  isCustomSpec?: boolean;
  length?: number;
  width?: number;
  height?: number;
  weight?: number;
  cbm?: number;
  make?: string;
  engineCC?: number;
  fuel?: string;
  year?: number;
  price?: number;
  saveSpecToDb?: boolean;
}

export interface PlannedContainer {
  tempId: string;
  containerNo: string;
  sealOrBlNo: string;
  extraValue: number;
  matchedPatternFrom?: string; // Past plan container number
  matchedPastPlanId?: number;
  isStrictMatched?: boolean;
  matchType?: 'exact_chassis_prefix' | 'exact_model_combination' | 'partial_pattern';
  vehicles: Vehicle[];
  totalCbm: number;
  totalWeight: number;
  totalPrice: number;
  totalLength: number;
  cbmFillPercent: number;
  weightFillPercent: number;
  hasWarnings: boolean;
  warningMessages: string[];
  remark?: string;
}

export interface PlanBuilderResult {
  plannedContainers: PlannedContainer[];
  unmatchedVehicles: Vehicle[];
  totalVehiclesRequested: number;
  totalVehiclesMatched: number;
}

