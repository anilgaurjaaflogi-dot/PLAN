import { Container, PlannedContainer, Vehicle, PlanBuilderResult } from '../types';

export interface PlannerConstraints {
  maxVehicles: number;
  maxCbm: number;
  maxWeightKg: number;
  maxLengthCm: number;
}

export const DEFAULT_PLANNER_CONSTRAINTS: PlannerConstraints = {
  maxVehicles: 4,
  maxCbm: 76,
  maxWeightKg: 26000,
  maxLengthCm: 2400,
};

/**
 * Checks if container exceeds constraints and returns warning messages.
 */
export function evaluateContainerHealth(
  vehicles: Vehicle[],
  constraints: PlannerConstraints
): { hasWarnings: boolean; warningMessages: string[] } {
  const warnings: string[] = [];
  const count = vehicles.length;
  const totalCbm = vehicles.reduce((sum, v) => sum + (v.cbm || 0), 0);
  const totalWeight = vehicles.reduce((sum, v) => sum + (v.weight || 0), 0);
  const totalLength = vehicles.reduce((sum, v) => sum + (v.length || 0), 0);

  if (count > constraints.maxVehicles) {
    warnings.push(`Exceeds max vehicle capacity (${count}/${constraints.maxVehicles} units)`);
  }
  if (totalCbm > constraints.maxCbm) {
    warnings.push(`Exceeds volume limit (${totalCbm.toFixed(2)} / ${constraints.maxCbm} CBM)`);
  }
  if (totalWeight > constraints.maxWeightKg) {
    warnings.push(`Exceeds weight limit (${totalWeight.toLocaleString()} / ${constraints.maxWeightKg.toLocaleString()} kg)`);
  }
  if (constraints.maxLengthCm > 0 && totalLength > constraints.maxLengthCm) {
    warnings.push(`Combined vehicle length exceeds limit (${totalLength} / ${constraints.maxLengthCm} cm)`);
  }

  return {
    hasWarnings: warnings.length > 0,
    warningMessages: warnings,
  };
}

/**
 * Calculates container aggregates.
 */
export function recalculateContainerStats(
  tempId: string,
  containerNo: string,
  sealOrBlNo: string,
  extraValue: number,
  vehicles: Vehicle[],
  constraints: PlannerConstraints,
  matchedPatternFrom?: string,
  matchedPastPlanId?: number,
  isStrictMatched = false,
  matchType?: 'exact_chassis_prefix' | 'exact_model_combination' | 'partial_pattern',
  initialRemark?: string
): PlannedContainer {
  const totalCbm = Math.round(vehicles.reduce((sum, v) => sum + (v.cbm || 0), 0) * 1000) / 1000;
  const totalWeight = vehicles.reduce((sum, v) => sum + (v.weight || 0), 0);
  const totalPrice = vehicles.reduce((sum, v) => sum + (v.price || 0), 0);
  const totalLength = vehicles.reduce((sum, v) => sum + (v.length || 0), 0);

  const cbmFillPercent = Math.min(Math.round((totalCbm / constraints.maxCbm) * 100), 120);
  const weightFillPercent = Math.min(Math.round((totalWeight / constraints.maxWeightKg) * 100), 120);

  const health = evaluateContainerHealth(vehicles, constraints);

  // Set serial numbers 1..N
  vehicles.forEach((v, idx) => {
    v.serialNo = idx + 1;
    v.containerNo = containerNo;
  });

  const remark = initialRemark ?? (matchedPatternFrom ? `Checked from historical plan ${matchedPatternFrom}` : '');

  return {
    tempId,
    containerNo,
    sealOrBlNo,
    extraValue,
    matchedPatternFrom,
    matchedPastPlanId,
    isStrictMatched,
    matchType,
    remark,
    vehicles,
    totalCbm,
    totalWeight,
    totalPrice,
    totalLength,
    cbmFillPercent,
    weightFillPercent,
    hasWarnings: health.hasWarnings,
    warningMessages: health.warningMessages,
  };
}

/**
 * STRICT HISTORICAL PLAN CHECKER & BUILDER:
 * 100% deterministic database lookup against user's uploaded container plans.
 * ZERO AI. ZERO PREDICTIONS. ZERO ESTIMATIONS.
 * Only builds containers that are directly verified from the uploaded past plans database.
 */
export function buildContainerPlansStrict(
  vehiclesToPack: Vehicle[],
  pastContainers: Container[],
  constraints: PlannerConstraints = DEFAULT_PLANNER_CONSTRAINTS,
  strictUploadedOnly = true
): PlanBuilderResult {
  if (!vehiclesToPack || vehiclesToPack.length === 0) {
    return {
      plannedContainers: [],
      unmatchedVehicles: [],
      totalVehiclesRequested: 0,
      totalVehiclesMatched: 0,
    };
  }

  // Clone requested pool
  let available = vehiclesToPack.map((v, i) => ({
    ...v,
    id: v.id || `v-req-${Date.now()}-${i}`,
  }));

  const plannedContainers: PlannedContainer[] = [];
  let containerCounter = 1;

  if (pastContainers && pastContainers.length > 0) {
    // -------------------------------------------------------------
    // PASS 1: Exact Match by Model AND Chassis Prefix
    // (e.g. ELF [NKR61E] + RUMION [ZRE152] + ELF [NPR58P] + HIACE [KDH206])
    // -------------------------------------------------------------
    for (const past of pastContainers) {
      if (!past.vehicles || past.vehicles.length < 2) continue;
      if (available.length < past.vehicles.length) continue;

      const pastSpecs = past.vehicles.map((v) => ({
        model: v.model.toUpperCase().trim(),
        prefix: v.chassisPrefix ? v.chassisPrefix.toUpperCase().trim() : '',
      }));

      const matchedIndices: number[] = [];
      let canMatchAll = true;

      for (const reqSpec of pastSpecs) {
        // Find vehicle in available pool with same model AND same chassisPrefix
        const idx = available.findIndex((v, i) => {
          if (matchedIndices.includes(i)) return false;
          const modelMatches = v.model.toUpperCase().trim() === reqSpec.model;
          if (!modelMatches) return false;
          // If request has prefix specified, check prefix match
          if (reqSpec.prefix && v.chassisPrefix) {
            return v.chassisPrefix.toUpperCase().trim() === reqSpec.prefix;
          }
          return true;
        });

        if (idx !== -1) {
          matchedIndices.push(idx);
        } else {
          canMatchAll = false;
          break;
        }
      }

      if (canMatchAll && matchedIndices.length === past.vehicles.length) {
        // Exact 100% specification match with past plan
        matchedIndices.sort((a, b) => b - a);
        const matchedVehicles: Vehicle[] = [];
        for (const idx of matchedIndices) {
          matchedVehicles.push(available[idx]);
          available.splice(idx, 1);
        }
        matchedVehicles.reverse();

        const cNum = `PLAN-${String(containerCounter).padStart(2, '0')}`;
        const container = recalculateContainerStats(
          `c-${Date.now()}-${containerCounter}`,
          cNum,
          past.sealOrBlNo || `SEAL-${String(containerCounter).padStart(2, '0')}`,
          past.extraValue ? Number(past.extraValue) || 4000 : 4000,
          matchedVehicles,
          constraints,
          past.containerNo,
          past.id,
          true,
          'exact_chassis_prefix'
        );

        plannedContainers.push(container);
        containerCounter++;
      }
    }

    // -------------------------------------------------------------
    // PASS 2: Match by exact Model combination from past plans
    // (e.g. 2x ELF + 1x HIACE + 1x WISH)
    // -------------------------------------------------------------
    for (const past of pastContainers) {
      if (!past.vehicles || past.vehicles.length < 2) continue;
      if (available.length < past.vehicles.length) continue;

      const pastModels = past.vehicles.map((v) => v.model.toUpperCase().trim());
      const matchedIndices: number[] = [];
      let canMatchAll = true;

      for (const reqModel of pastModels) {
        const idx = available.findIndex(
          (v, i) => !matchedIndices.includes(i) && v.model.toUpperCase().trim() === reqModel
        );
        if (idx !== -1) {
          matchedIndices.push(idx);
        } else {
          canMatchAll = false;
          break;
        }
      }

      if (canMatchAll && matchedIndices.length === past.vehicles.length) {
        matchedIndices.sort((a, b) => b - a);
        const matchedVehicles: Vehicle[] = [];
        for (const idx of matchedIndices) {
          matchedVehicles.push(available[idx]);
          available.splice(idx, 1);
        }
        matchedVehicles.reverse();

        const cNum = `PLAN-${String(containerCounter).padStart(2, '0')}`;
        const container = recalculateContainerStats(
          `c-${Date.now()}-${containerCounter}`,
          cNum,
          past.sealOrBlNo || `SEAL-${String(containerCounter).padStart(2, '0')}`,
          past.extraValue ? Number(past.extraValue) || 4000 : 4000,
          matchedVehicles,
          constraints,
          past.containerNo,
          past.id,
          true,
          'exact_model_combination'
        );

        plannedContainers.push(container);
        containerCounter++;
      }
    }
  }

  // -------------------------------------------------------------
  // If NOT in strictUploadedOnly mode, pack remaining leftovers
  // If strictUploadedOnly is TRUE (User's explicit requirement), do NOT make up plans!
  // Leave available vehicles as unmatched so user has 100% verified plans only.
  // -------------------------------------------------------------
  if (!strictUploadedOnly && available.length > 0) {
    while (available.length > 0) {
      const currentContainerVehicles: Vehicle[] = [];
      let curCbm = 0;
      let curWeight = 0;

      while (currentContainerVehicles.length < constraints.maxVehicles && available.length > 0) {
        const next = available.shift()!;
        currentContainerVehicles.push(next);
        curCbm += next.cbm;
        curWeight += next.weight;
      }

      const cNum = `PLAN-${String(containerCounter).padStart(2, '0')}`;
      const container = recalculateContainerStats(
        `c-${Date.now()}-${containerCounter}`,
        cNum,
        `SEAL-${String(containerCounter).padStart(2, '0')}`,
        4000,
        currentContainerVehicles,
        constraints,
        undefined,
        undefined,
        false
      );

      plannedContainers.push(container);
      containerCounter++;
    }
  }

  const totalVehiclesMatched = plannedContainers.reduce((acc, c) => acc + c.vehicles.length, 0);

  return {
    plannedContainers,
    unmatchedVehicles: available,
    totalVehiclesRequested: vehiclesToPack.length,
    totalVehiclesMatched,
  };
}
