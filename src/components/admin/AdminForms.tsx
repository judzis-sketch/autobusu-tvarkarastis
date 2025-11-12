'use client';

import type { Route } from '@/lib/types';
import { useState, useTransition, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addMultipleRoutesAction, addTimetableEntryAction, getRoutes } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/firebase';

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const multipleRoutesSchema = z.object({
  routes: z.array(routeSchema),
});


const timetableSchema = z.object({
  routeId: z.string({ required_error: 'Prašome pasirinkti maršrutą.' }),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(5, 'Laikai yra privalomi (pvz., 08:00)'),
  coords: z.string().optional(),
});

export default function AdminForms() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();
  const auth = useAuth();

  useEffect(() => {
    const fetchRoutes = async () => {
      setIsLoadingRoutes(true);
      const fetchedRoutes = await getRoutes();
      setRoutes(fetchedRoutes);
      setIsLoadingRoutes(false);
    };
    fetchRoutes();
  }, []);

  const routeForm = useForm<z.infer<typeof multipleRoutesSchema>>({
    resolver: zodResolver(multipleRoutesSchema),
    defaultValues: {
      routes: [{ number: '', name: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: routeForm.control,
    name: 'routes',
  });

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', coords: '' },
  });

  const handleAddRoute = (values: z.infer<typeof multipleRoutesSchema>) => {
    startTransitionRoute(async () => {
      const result = await addMultipleRoutesAction(values);
      if (result.success) {
        toast({ title: 'Pavyko!', description: 'Maršrutai sėkmingai pridėti.' });
        routeForm.reset({ routes: [{ number: '', name: '' }] });
        if(result.newRoutes) {
          setRoutes(prev => [...(result.newRoutes || []), ...prev].sort((a, b) => (b.createdAt as any) - (a.createdAt as any)));
        }
      } else {
        toast({
          title: 'Klaida!',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleAddTimetable = (values: z.infer<typeof timetableSchema>) => {
    startTransitionTimetable(async () => {
      const result = await addTimetableEntryAction(values);
      if (result.success) {
        toast({ title: 'Pavyko!', description: 'Tvarkaraščio įrašas pridėtas.' });
        timetableForm.reset();
      } else {
        toast({
          title: 'Klaida!',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };
  
  if (isLoadingRoutes) {
    return <div className="flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Nauji maršrutai</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit(handleAddRoute)} className="space-y-6">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr,2fr,auto] gap-4 items-start">
                    <FormField
                      control={routeForm.control}
                      name={`routes.${index}.number`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index !== 0 ? 'sr-only' : ''}>Nr.</FormLabel>
                          <FormControl>
                            <Input placeholder="10G" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={routeForm.control}
                      name={`routes.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={index !== 0 ? 'sr-only' : ''}>Pavadinimas</FormLabel>
                          <FormControl>
                            <Input placeholder="Stotis - Centras" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <div className={index !== 0 ? 'mt-0' : 'mt-8'}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Pašalinti</span>
                        </Button>
                      </div>
                  </div>
                ))}
              </div>
               <div className="flex items-center gap-4">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ number: '', name: '' })}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Pridėti eilutę
                  </Button>
                <Button type="submit" disabled={isPendingRoute}>
                  {isPendingRoute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pridėti maršrutus
                </Button>
               </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pridėti stotelės laikus</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...timetableForm}>
            <form onSubmit={timetableForm.handleSubmit(handleAddTimetable)} className="space-y-4">
              <FormField
                control={timetableForm.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maršrutas</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="-- Pasirinkti maršrutą --" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id!}>
                            {r.number} — {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={timetableForm.control}
                name="stop"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stotelės pavadinimas</FormLabel>
                    <FormControl>
                      <Input placeholder="Vinco Kudirkos aikštė" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={timetableForm.control}
                name="times"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laikai (atskirti kableliu)</FormLabel>
                    <FormControl>
                      <Input placeholder="08:00, 08:30, 09:15" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={timetableForm.control}
                name="coords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Koordinatės (pvz.: 54.6872, 25.2797)</FormLabel>
                    <FormControl>
                      <Input placeholder="Platuma, Ilguma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" variant="secondary" disabled={isPendingTimetable}>
                {isPendingTimetable && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pridėti laikus
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
