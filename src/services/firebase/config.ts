import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
// @ts-expect-error getReactNativePersistence is provided by the RN entry of firebase/auth.
import { getReactNativePersistence } from 'firebase/auth';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase configuration is supplied via EXPO_PUBLIC_* env vars (see .env.example).
 * These keys are not secrets (they are shipped in the client bundle); access
 * control is enforced by Firebase Security Rules, not by hiding the config.
 */
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
};

function createApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseApp: FirebaseApp = createApp();

/**
 * Initialize Auth with AsyncStorage persistence so sessions survive app
 * restarts. `initializeAuth` throws if called twice on the same app (e.g. after
 * a Fast Refresh), so fall back to `getAuth`.
 */
function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const firebaseAuth: Auth = createAuth(firebaseApp);
export const realtimeDb: Database = getDatabase(firebaseApp);
export const firestore: Firestore = getFirestore(firebaseApp);
