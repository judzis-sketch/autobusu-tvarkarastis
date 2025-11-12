import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

let app: App;
let db: Firestore;

function initializeForServer() {
    const apps = getApps();
    if (apps.length === 0) {
        app = initializeApp(); // No config needed with application default credentials
    } else {
        app = apps[0];
    }
    db = getFirestore(app);
}

initializeForServer();

export const getDb = (): Firestore => {
  if (!db) {
     initializeForServer();
  }
  return db;
};
