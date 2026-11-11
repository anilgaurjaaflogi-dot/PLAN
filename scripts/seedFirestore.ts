import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json' with { type: 'json' };
import { INITIAL_SEED_CONTAINERS } from '../src/db/seedData';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function sanitizeDocId(containerNo: string): string {
  return containerNo.trim().toUpperCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
}

async function seed() {
  console.log(`Starting to upload ${INITIAL_SEED_CONTAINERS.length} seed plans to Firestore...`);
  console.log(`Target Database: ${firebaseConfig.firestoreDatabaseId}`);

  for (const c of INITIAL_SEED_CONTAINERS) {
    const docId = sanitizeDocId(c.containerNo);
    const dataToSave = {
      containerNo: c.containerNo.trim().toUpperCase(),
      sealOrBlNo: c.sealOrBlNo || '',
      extraValue: c.extraValue ? String(c.extraValue) : '4000',
      totalCbm: Number(c.totalCbm) || 0,
      totalWeight: Number(c.totalWeight) || 0,
      totalPrice: Number(c.totalPrice) || 0,
      vehicleCount: Number(c.vehicleCount || c.vehicles?.length) || 0,
      models: c.models || [],
      chassisPrefixes: c.chassisPrefixes || [],
      createdAt: c.createdAt || Date.now(),
      updatedAt: Date.now(),
      notes: c.notes || '',
      matchedFromContainerNo: c.matchedFromContainerNo || '',
      vehicles: c.vehicles.map((v) => ({
        id: v.id,
        serialNo: v.serialNo || 1,
        make: v.make || '',
        model: v.model || '',
        engineCC: Number(v.engineCC) || 0,
        fuel: v.fuel || 'D',
        year: Number(v.year) || 0,
        vehicleIdNo: v.vehicleIdNo || '',
        chassisNo: v.chassisNo || '',
        chassisPrefix: v.chassisPrefix || '',
        length: Number(v.length) || 0,
        width: Number(v.width) || 0,
        height: Number(v.height) || 0,
        qty: Number(v.qty) || 1,
        price: Number(v.price) || 0,
        weight: Number(v.weight) || 0,
        cbm: Number(v.cbm) || 0,
      })),
    };

    console.log(`Uploading container: ${c.containerNo} (${c.vehicles.length} vehicles)...`);
    await setDoc(doc(db, 'containers', docId), dataToSave, { merge: true });
    console.log(`✓ Uploaded ${c.containerNo}`);
  }

  console.log('All seed containers successfully uploaded to Firebase Cloud Firestore!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed upload error:', err);
  process.exit(1);
});
