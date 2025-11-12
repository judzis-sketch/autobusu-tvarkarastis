
import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function initializeForServer(): { app: App; db: Firestore } {
  const apps = getApps();
  let app: App;

  if (apps.length === 0) {
    // This path is for environments where service account credentials are set in environment variables.
    // It's a more reliable approach for Vercel, local dev, etc.
    if (process.env.FIREBASE_PRIVATE_KEY) {
      app = initializeApp({
        credential: credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // The private key from the .env.local file needs to have its newlines restored.
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
       // This path is for environments like Firebase App Hosting or Cloud Run,
       // where default application credentials are automatically available.
       try {
         app = initializeApp();
       } catch (e) {
          console.error("Firebase Admin initialization failed. Ensure service account credentials are set in your environment variables (.env.local) or that you are running in a supported Google Cloud environment.");
          throw e;
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
