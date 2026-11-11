import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, type Firestore } from 'firebase/firestore';
import bundledConfig from '../../firebase-applet-config.json';

// Support both Netlify Environment Variables (VITE_FIREBASE_*) and bundled firebase-applet-config.json
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

export const firebaseConfig = {
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string) || bundledConfig.projectId,
  appId: (env.VITE_FIREBASE_APP_ID as string) || bundledConfig.appId,
  apiKey: (env.VITE_FIREBASE_API_KEY as string) || bundledConfig.apiKey,
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string) || bundledConfig.authDomain,
  firestoreDatabaseId: (env.VITE_FIREBASE_DATABASE_ID as string) || bundledConfig.firestoreDatabaseId,
  storageBucket: (env.VITE_FIREBASE_STORAGE_BUCKET as string) || bundledConfig.storageBucket,
  messagingSenderId: (env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || bundledConfig.messagingSenderId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with auto long-polling for iframe / proxy preview environments
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  return await signInWithPopup(auth, googleProvider);
}

export async function logoutUser() {
  return await signOut(auth);
}

/**
 * Validates Firestore server connection on startup as mandated by Firebase skill.
 */
export async function testConnection(maxRetries = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log('Firebase Firestore connection verified successfully.');
      return true;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore connection probe note: client is offline or connecting.');
      } else {
        console.warn('Firestore connection probe note:', error);
      }
      return false;
    }
  }
  return false;
}
