// lib/firebase-admin.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

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
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
        db = initializeFirestore(app, {
          cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });
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

export const getDb = (): Firestore => {
    if (!db) {
        initialize();
    }
    return db;
};
