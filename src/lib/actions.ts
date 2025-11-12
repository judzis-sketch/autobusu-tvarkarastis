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

export async function deleteRouteAction(routeId: string) {
    if (!routeId) {
        throw new Error('Nenurodytas maršruto ID.');
    }
    const db = getDb();
    const routeRef = doc(db, 'routes', routeId);
    const timetableRef = collection(db, 'routes', routeId, 'timetable');

    try {
        const batch = writeBatch(db);

        // Delete all timetable entries in a batch
        const timetableSnapshot = await getDocs(timetableRef);
        timetableSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        
        // Delete the route itself
        batch.delete(routeRef);

        await batch.commit();

        revalidatePath('/admin');
        revalidatePath('/');

        return { success: true };
    } catch (error) {
        console.error("Klaida trinant maršrutą:", error);
        return { success: false, error: "Nepavyko ištrinti maršruto." };
    }
}