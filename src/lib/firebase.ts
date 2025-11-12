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
  const apps = getApps();
  if (apps.length === 0) {
    // This check is to prevent client-side code from trying to initialize on the server.
    if (typeof window !== 'undefined') {
      app = initializeApp(firebaseConfig);
    }
  } else {
    app = apps[0];
  }
  
  if (app) {
    try {
       db = getFirestore(app);
    } catch(e) {
       db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      });
    }
  }
}


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


// We need a separate initialization for server-side, because of how Next.js bundles code.
if (typeof window === 'undefined') {
  initializeForServer();
} else {
  initialize();
}


export const getDb = (): Firestore => {
  // This will be called on the server, ensure it's initialized
  if (!db) {
     if (typeof window === 'undefined') {
        initializeForServer();
     } else {
        initialize();
     }
  }
  return db;
};
