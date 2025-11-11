import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
    if (getApps().length > 0) {
        return getApp();
    }
    // Don't initialize if the config is not provided
    if (!firebaseConfig.projectId) {
        return null;
    }
    return initializeApp(firebaseConfig);
}

function getDb() {
    const app = getFirebaseApp();
    if (!app) {
        return null;
    }
    // When running in a server-side environment, it's possible for getFirestore to be called multiple times,
    // which can lead to a crash. By using initializeFirestore, we can avoid this issue.
    // We also use CACHE_SIZE_UNLIMITED to avoid a warning about the cache size being too small.
    try {
        return getFirestore(app);
    } catch (e) {
        return initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        });
    }
}


export const db = getDb();
