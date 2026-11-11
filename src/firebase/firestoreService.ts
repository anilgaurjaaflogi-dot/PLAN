import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errorHandler';
import { Container, Vehicle } from '../types';

const CONTAINERS_COLLECTION = 'containers';

function sanitizeDocId(containerNo: string): string {
  // Firestore document IDs cannot contain slashes and must be clean alphanumeric/hyphen
  return containerNo.trim().toUpperCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
}

/**
 * Saves or updates a single container in Firebase Firestore.
 */
export async function saveContainerToFirestore(container: Container): Promise<void> {
  const docId = sanitizeDocId(container.containerNo);
  const path = `${CONTAINERS_COLLECTION}/${docId}`;

  try {
    const dataToSave = {
      containerNo: container.containerNo.trim().toUpperCase(),
      sealOrBlNo: container.sealOrBlNo || '',
      extraValue: container.extraValue ? String(container.extraValue) : '4000',
      totalCbm: Number(container.totalCbm) || 0,
      totalWeight: Number(container.totalWeight) || 0,
      totalPrice: Number(container.totalPrice) || 0,
      vehicleCount: Number(container.vehicleCount || container.vehicles?.length) || 0,
      models: container.models || [],
      chassisPrefixes: container.chassisPrefixes || [],
      createdAt: container.createdAt || Date.now(),
      updatedAt: Date.now(),
      notes: container.notes || '',
      matchedFromContainerNo: container.matchedFromContainerNo || '',
      vehicles: container.vehicles.map((v) => ({
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

    await setDoc(doc(db, CONTAINERS_COLLECTION, docId), dataToSave, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes a container from Firebase Firestore.
 */
export async function deleteContainerFromFirestore(containerNo: string): Promise<void> {
  const docId = sanitizeDocId(containerNo);
  const path = `${CONTAINERS_COLLECTION}/${docId}`;

  try {
    await deleteDoc(doc(db, CONTAINERS_COLLECTION, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Fetches all containers currently stored in Firebase Firestore.
 */
export async function getContainersFromFirestore(): Promise<Container[]> {
  try {
    const snap = await getDocs(collection(db, CONTAINERS_COLLECTION));
    const containers: Container[] = [];

    snap.forEach((d) => {
      const data = d.data();
      containers.push({
        containerNo: data.containerNo || d.id,
        sealOrBlNo: data.sealOrBlNo || '',
        extraValue: data.extraValue || 4000,
        totalCbm: Number(data.totalCbm) || 0,
        totalWeight: Number(data.totalWeight) || 0,
        totalPrice: Number(data.totalPrice) || 0,
        vehicleCount: Number(data.vehicleCount) || (data.vehicles?.length || 0),
        models: data.models || [],
        chassisPrefixes: data.chassisPrefixes || [],
        createdAt: Number(data.createdAt) || Date.now(),
        updatedAt: Number(data.updatedAt) || Date.now(),
        notes: data.notes || '',
        matchedFromContainerNo: data.matchedFromContainerNo || '',
        vehicles: (data.vehicles || []).map((v: any, idx: number) => ({
          id: v.id || `v-${d.id}-${idx}`,
          serialNo: v.serialNo || idx + 1,
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
      });
    });

    return containers;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, CONTAINERS_COLLECTION);
  }
}

/**
 * Real-time listener for Firestore container changes.
 */
export function subscribeToContainers(
  onUpdate: (containers: Container[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = collection(db, CONTAINERS_COLLECTION);

  return onSnapshot(
    q,
    (snapshot) => {
      const containers: Container[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        containers.push({
          containerNo: data.containerNo || d.id,
          sealOrBlNo: data.sealOrBlNo || '',
          extraValue: data.extraValue || 4000,
          totalCbm: Number(data.totalCbm) || 0,
          totalWeight: Number(data.totalWeight) || 0,
          totalPrice: Number(data.totalPrice) || 0,
          vehicleCount: Number(data.vehicleCount) || (data.vehicles?.length || 0),
          models: data.models || [],
          chassisPrefixes: data.chassisPrefixes || [],
          createdAt: Number(data.createdAt) || Date.now(),
          updatedAt: Number(data.updatedAt) || Date.now(),
          notes: data.notes || '',
          matchedFromContainerNo: data.matchedFromContainerNo || '',
          vehicles: (data.vehicles || []).map((v: any, idx: number) => ({
            id: v.id || `v-${d.id}-${idx}`,
            serialNo: v.serialNo || idx + 1,
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
        });
      });
      onUpdate(containers);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, CONTAINERS_COLLECTION);
      } catch (err: any) {
        if (onError) onError(err);
      }
    }
  );
}

/**
 * Bulk syncs local containers up to Firestore in batched chunks.
 */
export async function syncContainersToFirestore(
  containers: Container[],
  onProgress?: (processed: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  const chunkSize = 20;

  for (let i = 0; i < containers.length; i += chunkSize) {
    const chunk = containers.slice(i, i + chunkSize);
    try {
      const batch = writeBatch(db);
      for (const c of chunk) {
        const docId = sanitizeDocId(c.containerNo);
        const ref = doc(db, CONTAINERS_COLLECTION, docId);
        batch.set(
          ref,
          {
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
            vehicles: (c.vehicles || []).map((v) => ({
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
          },
          { merge: true }
        );
      }
      await batch.commit();
      success += chunk.length;
    } catch (e) {
      console.error('Batch sync error:', e);
      failed += chunk.length;
    }

    if (onProgress) {
      onProgress(Math.min(i + chunkSize, containers.length), containers.length);
    }
  }

  return { success, failed };
}
