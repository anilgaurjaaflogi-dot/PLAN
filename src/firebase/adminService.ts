import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './config';
import { AppUserAccess, AccessControlConfig } from '../types';

const ACCESS_CONTROL_COLLECTION = 'access_control';
const USERS_SUBCOLLECTION = 'users';

const DEFAULT_CONFIG: AccessControlConfig = {
  requireApproval: false,
  adminEmail: 'anilgaurjaaflogi@gmail.com',
  blockedEmails: [],
};

const LOCAL_USERS_KEY = 'cpm_admin_users_v1';
const LOCAL_CONFIG_KEY = 'cpm_admin_config_v1';

export async function fetchAccessConfig(): Promise<AccessControlConfig> {
  try {
    const snap = await getDoc(doc(db, ACCESS_CONTROL_COLLECTION, 'global_settings'));
    if (snap.exists()) {
      const data = snap.data() as AccessControlConfig;
      localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('Using local access config cache:', err);
  }

  try {
    const local = localStorage.getItem(LOCAL_CONFIG_KEY);
    if (local) return JSON.parse(local);
  } catch {}

  return DEFAULT_CONFIG;
}

export async function saveAccessConfig(config: AccessControlConfig): Promise<void> {
  try {
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
    await setDoc(doc(db, ACCESS_CONTROL_COLLECTION, 'global_settings'), config, { merge: true });
  } catch (err) {
    console.warn('Firestore access config write note:', err);
  }
}

export async function fetchUsersList(): Promise<AppUserAccess[]> {
  try {
    const snap = await getDocs(collection(db, ACCESS_CONTROL_COLLECTION, 'users_data', USERS_SUBCOLLECTION));
    const list: AppUserAccess[] = [];
    snap.forEach((d) => {
      list.push(d.data() as AppUserAccess);
    });
    if (list.length > 0) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
      return list;
    }
  } catch (err) {
    console.warn('Using local users cache:', err);
  }

  try {
    const local = localStorage.getItem(LOCAL_USERS_KEY);
    if (local) return JSON.parse(local);
  } catch {}

  return [
    {
      id: 'admin-anil',
      email: 'anilgaurjaaflogi@gmail.com',
      displayName: 'Anil Gaur (Master Admin)',
      role: 'admin',
      status: 'active',
      createdAt: Date.now() - 30 * 86400000,
      lastActive: Date.now(),
    },
  ];
}

export async function saveUserRecord(user: AppUserAccess): Promise<void> {
  try {
    const sanitizedId = user.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const local = await fetchUsersList();
    const updated = local.filter((u) => u.email.toLowerCase() !== user.email.toLowerCase());
    updated.push(user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));

    await setDoc(
      doc(db, ACCESS_CONTROL_COLLECTION, 'users_data', USERS_SUBCOLLECTION, sanitizedId),
      user,
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore user save note:', err);
  }
}

export async function removeUserRecord(email: string): Promise<void> {
  try {
    const sanitizedId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const local = await fetchUsersList();
    const updated = local.filter((u) => u.email.toLowerCase() !== email.toLowerCase());
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(updated));

    await deleteDoc(doc(db, ACCESS_CONTROL_COLLECTION, 'users_data', USERS_SUBCOLLECTION, sanitizedId));
  } catch (err) {
    console.warn('Firestore user remove note:', err);
  }
}
