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

  const newRouteDoc = await docRef.get();
  const newRouteData = newRouteDoc.data();

  // Grąžiname naujai sukurto dokumento duomenis su ID ir konvertuotu laiku
  return {
    id: docRef.id,
    ...parsedData,
    createdAt: (newRouteData?.createdAt as Timestamp)?.toDate().toISOString(),
  };
}

export async function getRoutes(): Promise<Route[]> {
  const db = getDb();
  try {
    const routesCollection = db.collection('routes').orderBy('createdAt', 'desc');
    const snap = await routesCollection.get();

    if (snap.empty) {
      return [];
    }
    
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        number: data.number,
        name: data.name,
        // Konvertuojame Timestamp į ISO string
        createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
      } as Route;
    });
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

    return snap.docs.map((d) => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate().toISOString(),
        } as TimetableEntry
    });
  } catch (error) {
    console.error('Error getting timetable: ', error);
    return [];
  }
}
