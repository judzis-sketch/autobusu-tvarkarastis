'use server';

import { collection, getDocs, serverTimestamp, query, orderBy, writeBatch, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from './firebase-admin'; // Use server-side firebase
import type { Route, TimetableEntry } from './types';
import { getApps } from 'firebase/app';

export async function getRoutes(): Promise<Route[]> {
  const db = getDb();
  try {
    const q = query(collection(db, 'routes'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Route, 'id'>) }));
  } catch (error) {
    console.error("Error getting routes: ", error);
    // If there are no apps initialized, it's a server-side config issue.
    if (getApps().length === 0) {
        console.error("Firebase not initialized on the server. Check your environment variables.")
        return [];
    }
    // Re-throw other errors to be caught by error boundaries
    throw error;
  }
}

export async function getTimetableForRoute(routeId: string): Promise<TimetableEntry[]> {
  const db = getDb();
  try {
    const q = query(collection(db, `routes/${routeId}/timetable`), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimetableEntry));
  } catch (error) {
    console.error("Error getting timetable: ", error);
    return [];
  }
}
