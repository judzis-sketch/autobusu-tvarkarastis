import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

let app: FirebaseApp;
let db: Firestore;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function initialize() {
  const apps = getApps();
  if (apps.length === 0) {
    app = initializeApp(firebaseConfig, 'firebase-admin');
  } else {
    app = apps.find(a => a.name === 'firebase-admin') || initializeApp(firebaseConfig, 'firebase-admin');
  }

  try {
     db = getFirestore(app);
  } catch(e) {
     db = initializeFirestore(app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });
  }
}

initialize();

export const getDb = (): Firestore => {
  if (!db) {
    initialize();
  }
  return db;
};
