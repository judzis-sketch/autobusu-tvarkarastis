'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from './firebase-admin';
import type { Route, TimetableEntry } from './types';
import { getApps } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

export async function addRoute(data: unknown) {
  const db = getDb();
  const parsedData = routeSchema.parse(data);

  const docRef = await db.collection('routes').add({
    ...parsedData,
    createdAt: Timestamp.now(),
  });

  revalidatePath('/admin');
  revalidatePath('/');

  // Grąžiname naujai sukurto dokumento duomenis su ID
  return { id: docRef.id, ...parsedData };
}

export async function getRoutes(): Promise<Route[]> {
  const db = getDb();
  try {
    const routesCollection = db.collection('routes').orderBy('createdAt', 'desc');
    const snap = await routesCollection.get();

    if (snap.empty) {
      return [];
    }
    
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Route, 'id'>) }));
  } catch (error) {
    console.error('Error getting routes: ', error);
    if (getApps().length === 0) {
      console.error(
        'Firebase not initialized on the server. Check your environment variables.'
      );
    }
    throw error;
  }
}

export async function getTimetableForRoute(
  routeId: string
): Promise<TimetableEntry[]> {
  const db = getDb();
  try {
    const timetableCollection = db.collection(`routes/${routeId}/timetable`).orderBy('createdAt', 'asc');
    const snap = await timetableCollection.get();

    if (snap.empty) {
        return [];
    }

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimetableEntry));
  } catch (error) {
    console.error('Error getting timetable: ', error);
    return [];
  }
}
