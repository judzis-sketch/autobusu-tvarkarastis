'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { getDocs, collection, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Database, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Route, TimetableEntry } from '@/lib/types';


export default function DataMigration() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [migrationResult, setMigrationResult] = useState<{ status: 'success' | 'error' | 'partial'; message: string; } | null>(null);

    const handleMigration = async () => {
        if (!firestore) {
            toast({ title: 'Klaida', description: 'Duomenų bazė nepasiekiama.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        setMigrationResult(null);

        try {
            const routesQuery = query(collection(firestore, 'routes'));
            const routesSnapshot = await getDocs(routesQuery);
            const allRoutes = routesSnapshot.docs.map(doc => ({ ...doc.data() as Route, id: doc.id }));
            
            let totalUpdates = 0;
            const batch = writeBatch(firestore);

            for (const route of allRoutes) {
                const timetableQuery = query(collection(firestore, `routes/${route.id}/timetable`), orderBy('createdAt', 'asc'));
                const timetableSnapshot = await getDocs(timetableQuery);
                const stops = timetableSnapshot.docs.map(doc => ({ ...doc.data() as TimetableEntry, id: doc.id }));

                if (stops.length < 2) {
                    continue; // Nothing to migrate if less than 2 stops
                }

                for (let i = 0; i < stops.length; i++) {
                    const currentStop = stops[i];

                    // --- The old logic was flawed. Let's trace it.
                    // Old logic stored distance/geometry to get from A->B inside stop B's document.
                    // This is what we need to fix.
                    // The `distanceToNext` and `routeGeometry` on stop B *actually* belong to stop A.

                    if (i > 0) { // Start from the second stop (index 1)
                        const previousStop = stops[i - 1];
                        
                        // Check if the current stop has geometry/distance data (the incorrect old pattern)
                        if (currentStop.routeGeometry || currentStop.distanceToNext) {
                            
                            // Data that should be on the *previous* stop
                            const dataToMove = {
                                routeGeometry: currentStop.routeGeometry || null,
                                distanceToNext: currentStop.distanceToNext || null,
                            };

                            // Update the *previous* stop document with the correct data
                            const previousStopRef = doc(firestore, `routes/${route.id}/timetable/${previousStop.id}`);
                            batch.update(previousStopRef, dataToMove);

                            // Clear the incorrect data from the *current* stop document
                            const currentStopRef = doc(firestore, `routes/${route.id}/timetable/${currentStop.id}`);
                            batch.update(currentStopRef, {
                                routeGeometry: null,
                                distanceToNext: null,
                            });
                            
                            totalUpdates++;
                        }
                    }
                }
            }

            if (totalUpdates > 0) {
                await batch.commit();
                const successMessage = `Migracija sėkminga! Atnaujinta įrašų: ${totalUpdates}. Jūsų maršrutai dabar suderinami su nauja sistema.`;
                setMigrationResult({ status: 'success', message: successMessage });
                toast({ title: 'Pavyko!', description: 'Duomenys sėkmingai migruoti.'});
            } else {
                const noActionMessage = 'Migracija praleista. Atrodo, kad jūsų duomenys jau yra teisingo formato arba nėra maršrutų, kuriuos reikėtų migruoti.';
                setMigrationResult({ status: 'success', message: noActionMessage });
            }

        } catch (error) {
            console.error("Migration failed: ", error);
            const errorMessage = `Migracijos klaida: ${error instanceof Error ? error.message : 'Nežinoma klaida'}`;
            setMigrationResult({ status: 'error', message: errorMessage });
            toast({ title: 'Klaida!', description: 'Nepavyko atlikti duomenų migracijos.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Duomenų valdymas</CardTitle>
                <CardDescription>
                    Atlikite vienkartinę duomenų migraciją, kad pataisytumėte senus maršruto duomenis ir pritaikytumėte juos naujausiai sistemos versijai.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Svarbi informacija</AlertTitle>
                    <AlertDescription>
                        Šį veiksmą reikia atlikti tik vieną kartą. Jis peržiūrės visus Jūsų maršrutus ir automatiškai pataisys duomenų struktūrą. Procesas gali užtrukti kelias akimirkas, priklausomai nuo duomenų kiekio.
                    </AlertDescription>
                </Alert>

                <Button onClick={handleMigration} disabled={isLoading} className="w-full">
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vykdoma migracija...
                        </>
                    ) : (
                        <>
                            <Database className="mr-2 h-4 w-4" />
                            Migruoti senus maršruto duomenis
                        </>
                    )}
                </Button>

                {migrationResult && (
                    <Alert variant={migrationResult.status === 'error' ? 'destructive' : 'default'}>
                         {migrationResult.status === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <AlertTitle>
                           {migrationResult.status === 'error' ? 'Klaida!' : 'Atlikta!'}
                        </AlertTitle>
                        <AlertDescription>
                            {migrationResult.message}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}