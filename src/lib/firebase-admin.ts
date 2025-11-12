import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, CACHE_SIZE_UNLIMITED, initializeFirestore } from 'firebase/firestore';

// IMPORTANT: These are server-side environment variables.
// They are not prefixed with NEXT_PUBLIC_ and will not be exposed to the client.
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

function initialize() {
    const apps = getApps();
    // Check if the "server-app" already exists
    const serverApp = apps.find(a => a.name === 'server-app');

    if (serverApp) {
        app = serverApp;
    } else {
        // IMPORTANT: Give the server-side app a unique name
        // to avoid conflicts with the client-side app.
        app = initializeApp(firebaseConfig, 'server-app');
    }
     try {
       db = getFirestore(app);
    } catch(e) {
       db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      });
    }
}

// Ensure initialization happens once.
initialize();

export const getDb = (): Firestore => {
  if (!db) {
    initialize();
  }
  return db;
};
