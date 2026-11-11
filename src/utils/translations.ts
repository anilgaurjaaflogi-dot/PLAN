/**
 * Bilingual UI Text & Hinglish Helper dictionary
 * Helps users in the Japanese export yard operate quickly and accurately
 */

export interface TranslationItem {
  en: string;
  hi?: string; // Hindi/Hinglish helper
}

export const LABELS: Record<string, TranslationItem> = {
  appName: { en: 'Container Plan Manager', hi: 'Konteynar Plan Mejnejar' },
  dashboard: { en: 'Dashboard', hi: 'Mukhya Dashbord' },
  planLibrary: { en: 'Plan Library', hi: 'Konteynar Plans Sangrah' },
  search: { en: 'Search & Insights', hi: 'Model / Chassis Khoj' },
  planBuilder: { en: 'Plan Builder', hi: 'Auto Plan Banayein' },
  settings: { en: 'Settings', hi: 'Settings & Limits' },

  containerNo: { en: 'Container No', hi: 'Konteynar Number (MSKU...)' },
  sealNo: { en: 'Seal / B/L No', hi: 'Seal / Bill of Lading No' },
  extraValue: { en: 'Extra / Tare (kg)', hi: 'Container Extra / Tare Wajan' },
  vehicleCount: { en: 'Vehicles', hi: 'Gaadiyon ki Sankhya' },
  totalCbm: { en: 'Total CBM (m³)', hi: 'Kul Aayatan (CBM)' },
  totalWeight: { en: 'Total Weight (kg)', hi: 'Kul Wajan (kg)' },
  totalPrice: { en: 'Total Value (JPY)', hi: 'Kul Keemat (¥)' },

  serialNo: { en: 'No', hi: 'Kram' },
  make: { en: 'Make', hi: 'Company (Toyota, Isuzu...)' },
  model: { en: 'Model', hi: 'Model (Hiace, Elf, Wish...)' },
  engineCC: { en: 'Engine (CC)', hi: 'Engine CC' },
  fuel: { en: 'Fuel', hi: 'Fuel (D=Diesel, G=Petrol)' },
  year: { en: 'Year', hi: 'Saal (Model Year)' },
  vehicleId: { en: 'Vehicle ID', hi: '16-Digit ID' },
  chassisNo: { en: 'Chassis No', hi: 'Pura Chassis Number' },
  chassisPrefix: { en: 'Chassis Prefix', hi: 'Chassis Prefix (e.g. KDH206)' },
  dimensions: { en: 'L × W × H (cm)', hi: 'Lambai × Chaudai × Unchai' },
  length: { en: 'Length (cm)', hi: 'Lambai (cm)' },
  width: { en: 'Width (cm)', hi: 'Chaudai (cm)' },
  height: { en: 'Height (cm)', hi: 'Unchai (cm)' },
  qty: { en: 'Qty', hi: 'Matra' },
  price: { en: 'Price (JPY)', hi: 'Rate / Price' },
  weight: { en: 'Weight (kg)', hi: 'Gaadi ka Wajan' },
  cbm: { en: 'CBM (m³)', hi: 'CBM (L*W*H/1M)' },

  // Actions
  importExcel: { en: 'Import Excel / Paste', hi: 'Excel Import / Paste Karein' },
  exportExcel: { en: 'Export to Excel', hi: 'Excel Download Karein' },
  downloadTemplate: { en: 'Download Template', hi: 'Sample Excel Template' },
  newContainer: { en: 'New Container', hi: 'Naya Container Dalein' },
  optimizeAgain: { en: 'Optimize Again', hi: 'Dobara Arrange Karein' },
  patternMatched: { en: 'Historical Pattern Matched', hi: 'Purane Safal Plan Se Match Hua' },
  saveToLibrary: { en: 'Save Plans to Library', hi: 'Library Me Save Karein' },
  copyWhatsApp: { en: 'Copy for WhatsApp', hi: 'WhatsApp Par Bhejne Ke Liye Copy' },
  printPlan: { en: 'Print / PDF Plan', hi: 'Print Karein / PDF Nikalein' },
};

/**
 * Returns rendered label with optional Hinglish helper
 */
export function t(key: string, showHinglish = true): string {
  const item = LABELS[key];
  if (!item) return key;
  if (!showHinglish || !item.hi) return item.en;
  return `${item.en} (${item.hi})`;
}

export function th(key: string, showHinglish = true): { primary: string; secondary?: string } {
  const item = LABELS[key];
  if (!item) return { primary: key };
  return {
    primary: item.en,
    secondary: showHinglish ? item.hi : undefined,
  };
}
