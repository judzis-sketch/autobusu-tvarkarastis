import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, CACHE_SIZE_UNLIMITED, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let db: Firestore;

function initialize() {
  const isServer = typeof window === 'undefined';
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    if(isServer){
      db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      });
    } else {
      db = getFirestore(app);
    }
  } else {
    app = getApp();
    try {
       db = getFirestore(app);
    } catch(e) {
       db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      });
    }
  }
}

initialize();

export const getDb = () => {
  if (!db) {
    initialize();
  }
  return db;
};
