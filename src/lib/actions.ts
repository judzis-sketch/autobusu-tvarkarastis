'use server';

import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from './firebase';
import type { Route, TimetableEntry } from './types';

export async function getRoutes(): Promise<Route[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'routes'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Route, 'id'>) }));
  } catch (error) {
    console.error("Error getting routes: ", error);
    return [];
  }
}

export async function getTimetableForRoute(routeId: string): Promise<TimetableEntry[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, `routes/${routeId}/timetable`), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as TimetableEntry);
  } catch (error) {
    console.error("Error getting timetable: ", error);
    return [];
  }
}

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const multipleRoutesSchema = z.object({
  routes: z.array(routeSchema),
});


export async function addMultipleRoutesAction(values: z.infer<typeof multipleRoutesSchema>): Promise<{ success: boolean; error?: string, newRoutes?: Route[] }> {
    if (!db) return { success: false, error: 'Duomenų bazė nepasiekiama.' };

    const validatedFields = multipleRoutesSchema.safeParse(values);

    if (!validatedFields.success) {
        return { success: false, error: 'Neteisingi duomenys.' };
    }

    const { routes } = validatedFields.data;

    if (!routes || routes.length === 0) {
        return { success: false, error: 'Nėra maršrutų pridėti.' };
    }

    try {
        const batch = writeBatch(db);
        const newRoutesData: Route[] = [];

        routes.forEach(route => {
            if (route.name && route.number) {
                const docRef = doc(collection(db, 'routes'));
                batch.set(docRef, { 
                    ...route, 
                    createdAt: serverTimestamp() 
                });
                newRoutesData.push({ id: docRef.id, ...route, createdAt: new Date() });
            }
        });

        await batch.commit();

        revalidatePath('/admin');
        revalidatePath('/');
        
        return { success: true, newRoutes: newRoutesData };
    } catch (error) {
        console.error("Error adding multiple routes: ", error);
        return { success: false, error: 'Nepavyko pridėti maršrutų.' };
    }
}


const timetableSchema = z.object({
  routeId: z.string().min(1),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(1, 'Laikai yra privalomi'),
  coords: z.string().optional(),
});

export async function addTimetableEntryAction(values: z.infer<typeof timetableSchema>): Promise<{ success: boolean, error?: string }> {
   if (!db) return { success: false, error: 'Duomenų bazė nepasiekiama.' };
   const validatedFields = timetableSchema.safeParse(values);

   if (!validatedFields.success) {
    return { success: false, error: 'Neteisingi duomenys.' };
  }

  const { routeId, stop, times, coords } = validatedFields.data;

  try {
    const parsedTimes = times.split(',').map((t) => t.trim()).filter(Boolean);
    if(parsedTimes.length === 0) {
        return { success: false, error: 'Nurodykite bent vieną laiką.' };
    }
    
    let parsedCoords: [number, number] | undefined = undefined;
    if (coords) {
      const parts = coords.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
        parsedCoords = [parts[0], parts[1]];
      } else {
        return { success: false, error: 'Neteisingas koordinačių formatas. Turi būti "platumą, ilguma".' };
      }
    }

    const payload: Partial<TimetableEntry> & { createdAt: any } = { stop, times: parsedTimes, createdAt: serverTimestamp() };
    if (parsedCoords) {
      payload.coords = parsedCoords;
    }

    await addDoc(collection(db, `routes/${routeId}/timetable`), payload);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
     return { success: false, error: 'Nepavyko pridėti tvarkaraščio įrašo.' };
  }
}
