import Dexie, { type Table } from 'dexie';
import { Container, Vehicle, VehicleLookupSpec } from '../types';
import { INITIAL_SEED_CONTAINERS } from './seedData';
import { calculateCbm, extractChassisPrefix, hasCbmMismatch } from '../utils/chassisParser';

export class ContainerDatabase extends Dexie {
  containers!: Table<Container, number>;
  vehicles!: Table<Vehicle, string>;

  constructor() {
    super('ContainerPlanManagerDB');
    this.version(1).stores({
      containers: '++id, containerNo, sealOrBlNo, createdAt, updatedAt, *models, *chassisPrefixes',
      vehicles: 'id, containerId, containerNo, make, model, chassisPrefix, chassisNo, year, fuel',
    });
  }
}

export const db = new ContainerDatabase();

/**
 * Initializes the database and seeds it with default data if empty.
 */
export async function initDatabase(): Promise<void> {
  const count = await db.containers.count();
  if (count === 0) {
    console.log('Seeding initial container plans...');
    for (const container of INITIAL_SEED_CONTAINERS) {
      await addContainerWithVehicles(container);
    }
  }
}

/**
 * Saves a container and its child vehicles in a single transaction.
 */
export async function addContainerWithVehicles(container: Container): Promise<number> {
  return await db.transaction('rw', db.containers, db.vehicles, async () => {
    // Calculate cached fields
    const modelsSet = new Set<string>();
    const prefixesSet = new Set<string>();
    let totalCbm = 0;
    let totalWeight = 0;
    let totalPrice = 0;

    container.vehicles.forEach((v, idx) => {
      v.serialNo = idx + 1;
      v.chassisPrefix = v.chassisPrefix || extractChassisPrefix(v.chassisNo);
      const calcCbm = calculateCbm(v.length, v.width, v.height);
      v.calculatedCbm = calcCbm;
      v.cbmMismatch = hasCbmMismatch(v.cbm, calcCbm);
      totalCbm += v.cbm || 0;
      totalWeight += v.weight || 0;
      totalPrice += v.price || 0;
      if (v.model) modelsSet.add(v.model.toUpperCase().trim());
      if (v.chassisPrefix) prefixesSet.add(v.chassisPrefix.toUpperCase().trim());
    });

    container.totalCbm = Math.round(totalCbm * 1000) / 1000;
    container.totalWeight = totalWeight;
    container.totalPrice = totalPrice;
    container.vehicleCount = container.vehicles.length;
    container.models = Array.from(modelsSet);
    container.chassisPrefixes = Array.from(prefixesSet);
    container.createdAt = container.createdAt || Date.now();
    container.updatedAt = Date.now();

    const { vehicles, ...containerMeta } = container;
    const containerId = await db.containers.add(containerMeta as Container);

    const vehicleRows: Vehicle[] = vehicles.map((v) => ({
      ...v,
      id: v.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      containerId,
      containerNo: container.containerNo,
    }));

    await db.vehicles.bulkAdd(vehicleRows);
    return containerId;
  });
}

/**
 * Updates an existing container and synchronizes its vehicles.
 */
export async function updateContainerWithVehicles(containerId: number, container: Container): Promise<void> {
  await db.transaction('rw', db.containers, db.vehicles, async () => {
    // Delete existing vehicle rows for this container
    await db.vehicles.where('containerId').equals(containerId).delete();

    const modelsSet = new Set<string>();
    const prefixesSet = new Set<string>();
    let totalCbm = 0;
    let totalWeight = 0;
    let totalPrice = 0;

    container.vehicles.forEach((v, idx) => {
      v.serialNo = idx + 1;
      v.chassisPrefix = v.chassisPrefix || extractChassisPrefix(v.chassisNo);
      const calcCbm = calculateCbm(v.length, v.width, v.height);
      v.calculatedCbm = calcCbm;
      v.cbmMismatch = hasCbmMismatch(v.cbm, calcCbm);
      totalCbm += v.cbm || 0;
      totalWeight += v.weight || 0;
      totalPrice += v.price || 0;
      if (v.model) modelsSet.add(v.model.toUpperCase().trim());
      if (v.chassisPrefix) prefixesSet.add(v.chassisPrefix.toUpperCase().trim());
    });

    container.id = containerId;
    container.totalCbm = Math.round(totalCbm * 1000) / 1000;
    container.totalWeight = totalWeight;
    container.totalPrice = totalPrice;
    container.vehicleCount = container.vehicles.length;
    container.models = Array.from(modelsSet);
    container.chassisPrefixes = Array.from(prefixesSet);
    container.updatedAt = Date.now();

    const { vehicles, ...containerMeta } = container;
    await db.containers.put({ ...containerMeta, id: containerId } as Container);

    const vehicleRows: Vehicle[] = vehicles.map((v) => ({
      ...v,
      id: v.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      containerId,
      containerNo: container.containerNo,
    }));

    await db.vehicles.bulkAdd(vehicleRows);
  });
}

/**
 * Deletes a container and its vehicles.
 */
export async function deleteContainer(containerId: number): Promise<Container | null> {
  return await db.transaction('rw', db.containers, db.vehicles, async () => {
    const container = await db.containers.get(containerId);
    if (!container) return null;
    const vehicles = await db.vehicles.where('containerId').equals(containerId).toArray();
    await db.vehicles.where('containerId').equals(containerId).delete();
    await db.containers.delete(containerId);
    return { ...container, vehicles };
  });
}

/**
 * Fetches containers with vehicles populated.
 */
export async function getAllContainersWithVehicles(): Promise<Container[]> {
  const containers = await db.containers.orderBy('createdAt').reverse().toArray();
  const allVehicles = await db.vehicles.toArray();

  const vehiclesByContainer = new Map<number, Vehicle[]>();
  for (const v of allVehicles) {
    if (v.containerId) {
      if (!vehiclesByContainer.has(v.containerId)) {
        vehiclesByContainer.set(v.containerId, []);
      }
      vehiclesByContainer.get(v.containerId)!.push(v);
    }
  }

  return containers.map((c) => ({
    ...c,
    vehicles: (vehiclesByContainer.get(c.id!) || []).sort((a, b) => a.serialNo - b.serialNo),
  }));
}

/**
 * Fast model list for autocomplete.
 */
export async function getDistinctModels(): Promise<string[]> {
  const vehicles = await db.vehicles.toArray();
  const set = new Set<string>();
  vehicles.forEach((v) => {
    if (v.model) set.add(v.model.toUpperCase().trim());
  });
  return Array.from(set).sort();
}

/**
 * Fast chassis prefixes list for autocomplete.
 */
export async function getDistinctChassisPrefixes(modelFilter?: string): Promise<string[]> {
  let vehicles = await db.vehicles.toArray();
  if (modelFilter) {
    const clean = modelFilter.toUpperCase().trim();
    vehicles = vehicles.filter((v) => v.model === clean);
  }
  const set = new Set<string>();
  vehicles.forEach((v) => {
    if (v.chassisPrefix) set.add(v.chassisPrefix.toUpperCase().trim());
  });
  return Array.from(set).sort();
}

/**
 * Fast distinct makes list.
 */
export async function getDistinctMakes(): Promise<string[]> {
  const vehicles = await db.vehicles.toArray();
  const set = new Set<string>();
  vehicles.forEach((v) => {
    if (v.make) set.add(v.make.toUpperCase().trim());
  });
  return Array.from(set).sort();
}

/**
 * Finds vehicle specifications from past plans for a given model or chassisPrefix.
 * Returns aggregated specs with frequency and dimensions.
 */
export async function lookupVehicleSpecs(modelQuery: string, chassisPrefixQuery?: string): Promise<VehicleLookupSpec[]> {
  const cleanModel = modelQuery.trim().toUpperCase();
  const cleanPrefix = chassisPrefixQuery?.trim().toUpperCase();

  const allVehicles = await db.vehicles.toArray();
  const matches = allVehicles.filter((v) => {
    const modelMatches = v.model.toUpperCase() === cleanModel || v.model.toUpperCase().includes(cleanModel);
    if (!modelMatches) return false;
    if (cleanPrefix) {
      return v.chassisPrefix.toUpperCase().includes(cleanPrefix);
    }
    return true;
  });

  if (matches.length === 0) return [];

  // Group by model + chassisPrefix + length + width + height
  const groups = new Map<string, { spec: VehicleLookupSpec; count: number }>();

  matches.forEach((v) => {
    const key = `${v.make}_${v.model}_${v.chassisPrefix}_${v.length}_${v.width}_${v.height}_${v.weight}`;
    if (!groups.has(key)) {
      groups.set(key, {
        spec: {
          make: v.make,
          model: v.model,
          chassisPrefix: v.chassisPrefix,
          engineCC: v.engineCC || 0,
          fuel: v.fuel || 'D',
          length: v.length || 0,
          width: v.width || 0,
          height: v.height || 0,
          weight: v.weight || 0,
          cbm: v.cbm || calculateCbm(v.length, v.width, v.height),
          frequency: 1,
          lastSeenYear: v.year,
        },
        count: 1,
      });
    } else {
      const item = groups.get(key)!;
      item.count++;
      item.spec.frequency = item.count;
      if (v.year && (!item.spec.lastSeenYear || v.year > item.spec.lastSeenYear)) {
        item.spec.lastSeenYear = v.year;
      }
    }
  });

  // Sort by frequency descending
  return Array.from(groups.values())
    .map((g) => g.spec)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Bulk insert containers with progress callback.
 */
export async function bulkImportContainers(
  containersList: Container[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ added: number; updated: number; skipped: number }> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const total = containersList.length;
  const chunkSize = 25;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = containersList.slice(i, i + chunkSize);
    for (const container of chunk) {
      await addContainerWithVehicles(container);
      added++;
    }
    if (onProgress) {
      onProgress(Math.min(i + chunkSize, total), total);
    }
  }

  return { added, updated, skipped };
}

/**
 * Generate test containers to simulate 1000+ container database.
 */
export async function generateSyntheticContainers(
  count: number,
  onProgress?: (processed: number, total: number) => void
): Promise<number> {
  const makesAndModels: Array<{
    make: string;
    model: string;
    prefix: string;
    cc: number;
    fuel: string;
    l: number;
    w: number;
    h: number;
    weight: number;
    price: number;
  }> = [
    { make: 'ISUZU', model: 'ELF', prefix: 'NKR66E', cc: 4320, fuel: 'D', l: 469, w: 169, h: 199, weight: 2710, price: 1850000 },
    { make: 'ISUZU', model: 'ELF', prefix: 'NPR58P', cc: 3630, fuel: 'D', l: 674, w: 203, h: 235, weight: 2840, price: 1250000 },
    { make: 'MITSUBISHI', model: 'CANTER', prefix: 'FE315BD', cc: 3560, fuel: 'D', l: 469, w: 169, h: 199, weight: 2630, price: 2340000 },
    { make: 'MITSUBISHI', model: 'CANTER', prefix: 'FE63EEV', cc: 4890, fuel: 'D', l: 679, w: 203, h: 226, weight: 2980, price: 1490000 },
    { make: 'TOYOTA', model: 'HIACE', prefix: 'KDH206', cc: 2980, fuel: 'D', l: 469, w: 170, h: 193, weight: 2190, price: 920000 },
    { make: 'TOYOTA', model: 'HIACE', prefix: 'TRH200', cc: 1990, fuel: 'G', l: 469, w: 169, h: 198, weight: 1940, price: 880000 },
    { make: 'TOYOTA', model: 'WISH', prefix: 'ZGE20', cc: 1790, fuel: 'G', l: 459, w: 169, h: 159, weight: 1350, price: 420000 },
    { make: 'TOYOTA', model: 'RUMION', prefix: 'ZRE152', cc: 1790, fuel: 'G', l: 421, w: 176, h: 163, weight: 1320, price: 360000 },
    { make: 'TOYOTA', model: 'PROBOX', prefix: 'NCP51V', cc: 1490, fuel: 'G', l: 419, w: 169, h: 152, weight: 1080, price: 310000 },
    { make: 'TOYOTA', model: 'DYNA', prefix: 'XZU347', cc: 4100, fuel: 'D', l: 612, w: 199, h: 224, weight: 2890, price: 1420000 },
    { make: 'HINO', model: 'DUTRO', prefix: 'XZU308', cc: 4000, fuel: 'D', l: 469, w: 169, h: 198, weight: 2580, price: 1850000 },
    { make: 'NISSAN', model: 'CARAVAN', prefix: 'VW6E26', cc: 2480, fuel: 'D', l: 469, w: 169, h: 199, weight: 1890, price: 790000 },
    { make: 'NISSAN', model: 'ATLAS', prefix: 'AKR66E', cc: 3150, fuel: 'D', l: 625, w: 201, h: 215, weight: 2920, price: 1250000 },
    { make: 'TOYOTA', model: 'VOXY', prefix: 'ZRR70', cc: 1980, fuel: 'G', l: 459, w: 169, h: 185, weight: 1580, price: 460000 },
  ];

  const shippingLines = ['MSKU', 'TGHU', 'ONEU', 'CMAU', 'EGLV', 'MEDU', 'HLXU', 'COSU'];
  const generated: Container[] = [];

  for (let i = 0; i < count; i++) {
    const line = shippingLines[Math.floor(Math.random() * shippingLines.length)];
    const cNum = `${line}${String(1000000 + i + Math.floor(Math.random() * 8999999)).slice(0, 7)}`;
    const seal = `ML-JP${String(400000 + i + Math.floor(Math.random() * 50000))}`;
    const extra = 3700 + Math.floor(Math.random() * 50) * 10;

    // Pick 4 vehicles (1 big truck + 1 heavy van + 2 cars/light vans)
    const bigTrucks = makesAndModels.filter((m) => m.l > 600);
    const standardTrucks = makesAndModels.filter((m) => m.l <= 600 && m.weight > 2000);
    const vansAndCars = makesAndModels.filter((m) => m.weight <= 2000);

    const v1 = standardTrucks[Math.floor(Math.random() * standardTrucks.length)];
    const v2 = vansAndCars[Math.floor(Math.random() * vansAndCars.length)];
    const v3 = bigTrucks[Math.floor(Math.random() * bigTrucks.length)];
    const v4 = vansAndCars[Math.floor(Math.random() * vansAndCars.length)];

    const chosen = [v1, v2, v3, v4];
    const vehicles: Vehicle[] = chosen.map((spec, sIdx) => {
      const serialPart = String(100000 + Math.floor(Math.random() * 899999));
      const chassisNo = spec.prefix.includes('-') ? `${spec.prefix}-${serialPart}` : `${spec.prefix}${serialPart}`;
      const cbm = calculateCbm(spec.l, spec.w, spec.h);
      return {
        id: `synth-${Date.now()}-${i}-${sIdx}`,
        serialNo: sIdx + 1,
        make: spec.make,
        model: spec.model,
        engineCC: spec.cc,
        fuel: spec.fuel,
        year: 1990 + Math.floor(Math.random() * 25),
        vehicleIdNo: `${3000000000000000 + Math.floor(Math.random() * 900000000000000)}`,
        chassisNo,
        chassisPrefix: spec.prefix,
        length: spec.l,
        width: spec.w,
        height: spec.h,
        qty: 1,
        price: spec.price + Math.floor(Math.random() * 100) * 10000,
        weight: spec.weight,
        cbm,
        calculatedCbm: cbm,
        cbmMismatch: false,
        containerNo: cNum,
      };
    });

    const totalCbm = Math.round(vehicles.reduce((acc, cur) => acc + cur.cbm, 0) * 1000) / 1000;
    const totalWeight = vehicles.reduce((acc, cur) => acc + cur.weight, 0);
    const totalPrice = vehicles.reduce((acc, cur) => acc + cur.price, 0);

    generated.push({
      containerNo: cNum,
      sealOrBlNo: seal,
      extraValue: extra,
      vehicles,
      totalCbm,
      totalWeight,
      totalPrice,
      vehicleCount: vehicles.length,
      models: Array.from(new Set(vehicles.map((v) => v.model))),
      chassisPrefixes: Array.from(new Set(vehicles.map((v) => v.chassisPrefix))),
      createdAt: Date.now() - Math.floor(Math.random() * 120) * 86400000,
      updatedAt: Date.now(),
    });
  }

  await bulkImportContainers(generated, onProgress);
  return count;
}
