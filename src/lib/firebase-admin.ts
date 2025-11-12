import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, CACHE_SIZE_UNLIMITED, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;

function initializeForServer() {
    const apps = getApps();
    if (apps.length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = apps[0];
    }
     try {
       db = getFirestore(app);
    } catch(e) {
       db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      });
    }
}

initializeForServer();

export const getDb = (): Firestore => {
  if (!db) {
     initializeForServer();
  }
  return db;
};
