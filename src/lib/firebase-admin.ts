
import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function initializeForServer(): { app: App; db: Firestore } {
  const apps = getApps();
  let app: App;

  if (apps.length === 0) {
    try {
      // Try to initialize with default credentials (works in App Hosting)
      app = initializeApp();
    } catch (e) {
      console.warn("Default initialization failed. Falling back to env vars.", e);
      // Fallback for local development or other environments
      if (process.env.FIREBASE_PRIVATE_KEY) {
        app = initializeApp({
          credential: credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            // Replace newline characters with actual newlines
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      } else {
         console.error("Firebase Admin initialization failed. Missing FIREBASE_PRIVATE_KEY env var.")
         // This will likely cause subsequent Firestore operations to fail.
         // As a last resort, try initializing without any credentials.
         // This might work for emulators or unauthenticated access in some cases, but not for production Firestore.
         app = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
         });
      }
    }
  } else {
    app = apps[0];
  }

  const db = getFirestore(app);
  return { app, db };
}

let dbInstance: Firestore;

export const getDb = (): Firestore => {
  if (!dbInstance) {
    dbInstance = initializeForServer().db;
  }
  return dbInstance;
};
