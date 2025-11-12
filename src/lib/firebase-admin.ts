import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// This function is intended to be used on the server side.
function initializeForServer(): { app: App; db: Firestore } {
    const apps = getApps();
    let app: App;
    if (apps.length === 0) {
        // When running on Google Cloud (like App Hosting), service account credentials 
        // are automatically discovered. No config object is needed.
        app = initializeApp();
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
