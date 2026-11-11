import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings, Container, ContainerPreset, PlannedContainer, AppUserAccess, AccessControlConfig } from '../types';
import { initDatabase, db, getAllContainersWithVehicles, addContainerWithVehicles } from '../db/db';

import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, testConnection, loginWithGoogle, logoutUser } from '../firebase/config';
import {
  saveContainerToFirestore,
  deleteContainerFromFirestore,
  getContainersFromFirestore,
  syncContainersToFirestore,
} from '../firebase/firestoreService';
import {
  fetchAccessConfig,
  saveAccessConfig,
  fetchUsersList,
  saveUserRecord,
  removeUserRecord,
} from '../firebase/adminService';
import { PasswordModal, MASTER_EXCEL_PASSWORD } from '../components/PasswordModal';

export const CONTAINER_PRESETS: ContainerPreset[] = [
  {
    id: '40hc',
    name: '40ft High Cube (40HC)',
    description: 'Standard export container for 4 commercial/passenger vehicles',
    maxVehicles: 4,
    maxCbm: 76.0,
    maxWeightKg: 26500,
    maxLengthCm: 2400,
  },
  {
    id: '40gp',
    name: '40ft Standard (40GP)',
    description: 'Standard height 40ft container',
    maxVehicles: 4,
    maxCbm: 67.0,
    maxWeightKg: 26000,
    maxLengthCm: 2400,
  },
  {
    id: '20gp',
    name: '20ft Standard (20GP)',
    description: 'Smaller container for 1-2 vehicles or heavy machinery',
    maxVehicles: 2,
    maxCbm: 33.0,
    maxWeightKg: 21500,
    maxLengthCm: 1200,
  },
];

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  duration?: number;
  undoAction?: () => void;
  undoLabel?: string;
}

export type AppPage = 'dashboard' | 'library' | 'search' | 'builder' | 'settings' | 'admin';

interface AppContextType {
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  containers: Container[];
  isLoadingContainers: boolean;
  refreshContainers: () => Promise<void>;
  // Cross-page transfers
  builderDraftVehicles: Array<{ model: string; chassisPrefix?: string; qty: number }>;
  setBuilderDraftVehicles: React.Dispatch<React.SetStateAction<Array<{ model: string; chassisPrefix?: string; qty: number }>>>;
  transferContainerToBuilder: (container: Container | PlannedContainer) => void;
  // Printing / Modal
  printContainerData: Container | PlannedContainer | null;
  setPrintContainerData: (c: Container | PlannedContainer | null) => void;
  // Firebase Cloud Persistence & Auth
  isCloudConnected: boolean;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  currentUser: User | null;
  syncToCloud: () => Promise<{ success: number; failed: number }>;
  syncFromCloud: () => Promise<number>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  // Admin & User Access Control (Made by Anil Gaur)
  isAdmin: boolean;
  adminUnlockedWithPin: boolean;
  unlockAdminWithPin: (pin: string) => boolean;
  lockAdmin: () => void;
  accessConfig: AccessControlConfig;
  usersList: AppUserAccess[];
  blockUser: (email: string, reason?: string) => Promise<void>;
  unblockUser: (email: string) => Promise<void>;
  addUserAccess: (user: AppUserAccess) => Promise<void>;
  removeUserAccess: (email: string) => Promise<void>;
  updateAccessConfig: (cfg: Partial<AccessControlConfig>) => Promise<void>;
  isUserBlocked: boolean;
  // Password Protected Actions (Master Password: 8076910181)
  requestPasswordProtectedAction: (action: () => void, title?: string, description?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'cpm_app_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  showHinglish: true,
  theme: 'dark', // Modern dark mode default for enterprise logistics
  activePresetId: '40hc',
  maxVehicles: 4,
  maxCbm: 76.0,
  maxWeightKg: 26500,
  maxLengthCm: 2400,
  autoSaveNewModels: true,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [isLoadingContainers, setIsLoadingContainers] = useState(true);
  const [builderDraftVehicles, setBuilderDraftVehicles] = useState<Array<{ model: string; chassisPrefix?: string; qty: number }>>([]);
  const [printContainerData, setPrintContainerData] = useState<Container | PlannedContainer | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse settings from localStorage', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  // Save settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save settings', e);
      }
      return updated;
    });
  };

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration || (toast.undoAction ? 6000 : 3500);
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshContainers = async () => {
    try {
      setIsLoadingContainers(true);
      const data = await getAllContainersWithVehicles();
      setContainers(data);
    } catch (err) {
      console.error('Error loading containers from Dexie', err);
      addToast({
        type: 'error',
        title: 'Database Load Error',
        description: 'Failed to read records from IndexedDB.',
      });
    } finally {
      setIsLoadingContainers(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        await refreshContainers();
      } catch (err) {
        console.error('Failed to init database', err);
      }
    };
    init();
  }, []);

  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Check Firestore server connection on startup
  useEffect(() => {
    testConnection().then((connected) => {
      setIsCloudConnected(connected);
    });
  }, []);

  const syncToCloud = async (): Promise<{ success: number; failed: number }> => {
    try {
      setCloudSyncStatus('syncing');
      const latest = await getAllContainersWithVehicles();
      const res = await syncContainersToFirestore(latest);
      setCloudSyncStatus('synced');
      addToast({
        type: 'success',
        title: 'Firebase Cloud Synced',
        description: `Successfully uploaded ${res.success} container plans to Google Firestore.`,
      });
      return res;
    } catch (err: any) {
      setCloudSyncStatus('error');
      addToast({
        type: 'error',
        title: 'Cloud Sync Failed',
        description: err.message || 'Could not write to Firebase Firestore.',
      });
      return { success: 0, failed: containers.length };
    }
  };

  const syncFromCloud = async (): Promise<number> => {
    try {
      setCloudSyncStatus('syncing');
      const cloudContainers = await getContainersFromFirestore();
      if (!cloudContainers || cloudContainers.length === 0) {
        setCloudSyncStatus('synced');
        addToast({
          type: 'info',
          title: 'Cloud Storage Empty',
          description: 'No container plans found in Firebase Firestore yet.',
        });
        return 0;
      }

      // Check existing in Dexie
      const existing = await getAllContainersWithVehicles();
      const existingNos = new Set(existing.map((c) => c.containerNo.toUpperCase()));
      const toAdd = cloudContainers.filter((c) => !existingNos.has(c.containerNo.toUpperCase()));

      for (const c of toAdd) {
        await addContainerWithVehicles(c);
      }

      await refreshContainers();
      setCloudSyncStatus('synced');
      addToast({
        type: 'success',
        title: 'Cloud Records Restored',
        description: `Downloaded ${cloudContainers.length} containers (${toAdd.length} new added to local storage).`,
      });
      return cloudContainers.length;
    } catch (err: any) {
      setCloudSyncStatus('error');
      addToast({
        type: 'error',
        title: 'Cloud Fetch Error',
        description: err.message || 'Could not read from Firebase Firestore.',
      });
      return 0;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const res = await loginWithGoogle();
      setCurrentUser(res.user);
      addToast({
        type: 'success',
        title: 'Signed In with Google',
        description: `Welcome, ${res.user.displayName || res.user.email}!`,
      });
    } catch (err: any) {
      console.error(err);
      addToast({
        type: 'error',
        title: 'Google Sign-In Cancelled or Failed',
        description: err.message || 'Unable to sign in.',
      });
    }
  };

  const signOutUser = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      addToast({
        type: 'info',
        title: 'Signed Out',
        description: 'You have been signed out from Firebase.',
      });
    } catch (err: any) {
      console.error(err);
    }
  };

  const [adminUnlockedWithPin, setAdminUnlockedWithPin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('cpm_admin_pin_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const [accessConfig, setAccessConfig] = useState<AccessControlConfig>({
    requireApproval: false,
    adminEmail: 'anilgaurjaaflogi@gmail.com',
    blockedEmails: [],
  });

  const [usersList, setUsersList] = useState<AppUserAccess[]>([]);

  // Password Protection for Excel Download
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingProtectedAction, setPendingProtectedAction] = useState<(() => void) | null>(null);
  const [passwordModalTitle, setPasswordModalTitle] = useState('Master Password Required');
  const [passwordModalDesc, setPasswordModalDesc] = useState('');

  // Initial load of access configuration and users
  useEffect(() => {
    fetchAccessConfig().then(setAccessConfig);
    fetchUsersList().then(setUsersList);
  }, []);

  // Check if current user is an admin
  const isAdmin = Boolean(
    currentUser?.email?.toLowerCase() === 'anilgaurjaaflogi@gmail.com' ||
    adminUnlockedWithPin
  );

  // Check if current user is blocked
  const isUserBlocked = Boolean(
    currentUser?.email &&
    accessConfig.blockedEmails.some((e) => e.toLowerCase() === currentUser.email?.toLowerCase())
  );

  const unlockAdminWithPin = (pin: string): boolean => {
    if (pin.trim() === MASTER_EXCEL_PASSWORD) {
      setAdminUnlockedWithPin(true);
      try {
        sessionStorage.setItem('cpm_admin_pin_unlocked', 'true');
      } catch {}
      return true;
    }
    return false;
  };

  const lockAdmin = () => {
    setAdminUnlockedWithPin(false);
    try {
      sessionStorage.removeItem('cpm_admin_pin_unlocked');
    } catch {}
  };

  const blockUser = async (email: string, reason = 'Kicked out by Anil Gaur') => {
    const clean = email.toLowerCase().trim();
    const updatedUsers = usersList.map((u) =>
      u.email.toLowerCase() === clean ? { ...u, status: 'blocked' as const, blockedReason: reason } : u
    );
    setUsersList(updatedUsers);

    const updatedBlocked = Array.from(new Set([...accessConfig.blockedEmails, clean]));
    const newCfg = { ...accessConfig, blockedEmails: updatedBlocked };
    setAccessConfig(newCfg);
    await saveAccessConfig(newCfg);

    const target = updatedUsers.find((u) => u.email.toLowerCase() === clean);
    if (target) {
      await saveUserRecord(target);
    }
    addToast({
      type: 'warning',
      title: 'User Blocked / Kicked Out',
      description: `${clean} has been kicked out and cannot access the app.`,
    });
  };

  const unblockUser = async (email: string) => {
    const clean = email.toLowerCase().trim();
    const updatedUsers = usersList.map((u) =>
      u.email.toLowerCase() === clean ? { ...u, status: 'active' as const, blockedReason: undefined } : u
    );
    setUsersList(updatedUsers);

    const updatedBlocked = accessConfig.blockedEmails.filter((e) => e.toLowerCase() !== clean);
    const newCfg = { ...accessConfig, blockedEmails: updatedBlocked };
    setAccessConfig(newCfg);
    await saveAccessConfig(newCfg);

    const target = updatedUsers.find((u) => u.email.toLowerCase() === clean);
    if (target) {
      await saveUserRecord(target);
    }
    addToast({
      type: 'success',
      title: 'User Access Restored',
      description: `${clean} has been unblocked.`,
    });
  };

  const addUserAccess = async (user: AppUserAccess) => {
    await saveUserRecord(user);
    const updated = await fetchUsersList();
    setUsersList(updated);
  };

  const removeUserAccess = async (email: string) => {
    await removeUserRecord(email);
    const updated = await fetchUsersList();
    setUsersList(updated);
    addToast({
      type: 'info',
      title: 'User Removed',
      description: `Record for ${email} has been removed.`,
    });
  };

  const updateAccessConfig = async (cfg: Partial<AccessControlConfig>) => {
    const updated = { ...accessConfig, ...cfg };
    setAccessConfig(updated);
    await saveAccessConfig(updated);
    addToast({
      type: 'success',
      title: 'Security Policy Updated',
      description: 'Access control configuration saved to cloud.',
    });
  };

  const requestPasswordProtectedAction = (
    action: () => void,
    title = 'Master Password Required for Excel Download',
    description = 'Container plans are protected. Enter master password (8076910181) to download Excel.'
  ) => {
    setPendingProtectedAction(() => action);
    setPasswordModalTitle(title);
    setPasswordModalDesc(description);
    setPasswordModalOpen(true);
  };

  const transferContainerToBuilder = (container: Container | PlannedContainer) => {
    const draft = container.vehicles.map((v) => ({
      model: v.model,
      chassisPrefix: v.chassisPrefix,
      qty: 1,
    }));
    setBuilderDraftVehicles(draft);
    setActivePage('builder');
    addToast({
      type: 'info',
      title: 'Transferred to Plan Builder',
      description: `Loaded ${container.vehicles.length} vehicles from Container ${container.containerNo || ''}.`,
    });
  };

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage,
        settings,
        updateSettings,
        toasts,
        addToast,
        removeToast,
        containers,
        isLoadingContainers,
        refreshContainers,
        builderDraftVehicles,
        setBuilderDraftVehicles,
        transferContainerToBuilder,
        printContainerData,
        setPrintContainerData,
        isCloudConnected,
        cloudSyncStatus,
        currentUser,
        syncToCloud,
        syncFromCloud,
        signInWithGoogle,
        signOutUser,
        isAdmin,
        adminUnlockedWithPin,
        unlockAdminWithPin,
        lockAdmin,
        accessConfig,
        usersList,
        blockUser,
        unblockUser,
        addUserAccess,
        removeUserAccess,
        updateAccessConfig,
        isUserBlocked,
        requestPasswordProtectedAction,
      }}
    >
      {children}
      <PasswordModal
        isOpen={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false);
          setPendingProtectedAction(null);
        }}
        onSuccess={() => {
          if (pendingProtectedAction) {
            pendingProtectedAction();
            setPendingProtectedAction(null);
          }
        }}
        title={passwordModalTitle}
        description={passwordModalDesc}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
