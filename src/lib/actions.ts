'use server';

import { collection, getDocs, serverTimestamp, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDb } from './firebase-admin'; // Use server-side firebase
import type { Route, TimetableEntry } from './types';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
    const db = getDb();
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

        routes.forEach(routeData => {
            if (routeData.name && routeData.number) {
                const docRef = doc(collection(db, 'routes'));
                const newRoute = {
                    ...routeData,
                    createdAt: serverTimestamp()
                };
                batch.set(docRef, newRoute);
                newRoutesData.push({ id: docRef.id, ...routeData, createdAt: new Date() });
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
   const db = getDb();
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
    
    const timetableColRef = collection(db, `routes/${routeId}/timetable`);
    
    // We can use a blocking operation here since it's a server action
    await addDoc(timetableColRef, payload);

    revalidatePath('/');
    return { success: true };
  } catch (error) {
     console.error("Error adding timetable entry: ", error);
     return { success: false, error: 'Nepavyko pridėti tvarkaraščio įrašo.' };
  }
}
