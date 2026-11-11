/**
 * Chassis Parser and Dimension Verification Utilities
 */

/**
 * Smart extraction of chassis prefix:
 * 1. If hyphen exists: part before the first '-' (e.g. FE315BD-445529 -> FE315BD)
 * 2. If no hyphen (e.g. NPR58P7106494, NKR66E7102934, FD3HLA10293):
 *    Japanese chassis serials typically end in 6 or 7 numeric digits.
 *    The prefix is the alphanumeric model classification preceding the serial number.
 */
export function extractChassisPrefix(chassisNo: string | undefined | null): string {
  if (!chassisNo) return '';
  const trimmed = chassisNo.trim().toUpperCase();

  // If there's a hyphen, take the part before the first hyphen
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    return parts[0].trim();
  }

  // If there's a space, take the first segment
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(' ');
    return parts[0].trim();
  }

  // If no hyphen, separate trailing 6-8 digits (the production serial number)
  // e.g. NPR58P7106494 -> NPR58P + 7106494
  // e.g. NKR61E7101966 -> NKR61E + 7101966
  // e.g. FE537E520391  -> FE537E + 520391
  const trailingDigitsMatch = trimmed.match(/^([A-Z0-9]+?)([0-9]{6,8})$/);
  if (trailingDigitsMatch && trailingDigitsMatch[1]) {
    return trailingDigitsMatch[1];
  }

  // If trailing digits are at least 5 digits preceded by letters+digits
  const secondaryMatch = trimmed.match(/^([A-Z]{1,4}[0-9]{1,3}[A-Z]{0,3})([0-9]{5,})$/);
  if (secondaryMatch && secondaryMatch[1]) {
    return secondaryMatch[1];
  }

  // Fallback: if it has mixed letters and ends in numbers, separate the first alpha-numeric cluster
  const fallback = trimmed.match(/^([A-Z0-9]{3,8})/);
  if (fallback && fallback[1]) {
    return fallback[1];
  }

  return trimmed;
}

/**
 * Calculates CBM from dimensions in cm: L * W * H / 1,000,000 rounded to 3 decimal places.
 */
export function calculateCbm(lengthCm: number, widthCm: number, heightCm: number): number {
  if (!lengthCm || !widthCm || !heightCm) return 0;
  const raw = (lengthCm * widthCm * heightCm) / 1000000;
  return Math.round(raw * 1000) / 1000;
}

/**
 * Checks if recorded CBM differs from calculated CBM by more than 0.05 CBM
 */
export function hasCbmMismatch(recordedCbm: number, calculatedCbm: number): boolean {
  if (!recordedCbm || !calculatedCbm) return false;
  return Math.abs(recordedCbm - calculatedCbm) > 0.05;
}

/**
 * Helper to normalize make / model string (e.g. "TOYOTA", "HIACE")
 */
export function normalizeKey(text: string | undefined | null): string {
  if (!text) return '';
  return text.trim().toUpperCase();
}
