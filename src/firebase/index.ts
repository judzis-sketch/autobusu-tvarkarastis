'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, CACHE_SIZE_UNLIMITED, initializeFirestore } from 'firebase/firestore';

function initializeFirebase(): { firebaseApp: FirebaseApp; auth: Auth; firestore: Firestore } {
  let firebaseApp: FirebaseApp;
  let auth: Auth;
  let firestore: Firestore;

  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }
  
  auth = getAuth(firebaseApp);

  try {
     firestore = getFirestore(firebaseApp);
  } catch(e) {
     firestore = initializeFirestore(firebaseApp, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    });
  }
  
  return { firebaseApp, auth, firestore };
}

export { initializeFirebase };

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
