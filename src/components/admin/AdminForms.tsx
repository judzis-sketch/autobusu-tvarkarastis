'use client';

import type { Route } from '@/lib/types';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addRouteAction, addTimetableEntryAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

const routeSchema = z.object({
  number: z.string().min(1, 'Numeris yra privalomas'),
  name: z.string().min(3, 'Pavadinimas turi būti bent 3 simbolių ilgio'),
});

const timetableSchema = z.object({
  routeId: z.string({ required_error: 'Prašome pasirinkti maršrutą.' }),
  stop: z.string().min(1, 'Stotelės pavadinimas yra privalomas'),
  times: z.string().min(5, 'Laikai yra privalomi (pvz., 08:00)'),
  coords: z.string().optional(),
});

type AdminFormsProps = {
  routes: Route[];
};

export default function AdminForms({ routes: initialRoutes }: AdminFormsProps) {
  const [routes, setRoutes] = useState(initialRoutes);
  const { toast } = useToast();
  const [isPendingRoute, startTransitionRoute] = useTransition();
  const [isPendingTimetable, startTransitionTimetable] = useTransition();

  const routeForm = useForm<z.infer<typeof routeSchema>>({
    resolver: zodResolver(routeSchema),
    defaultValues: { number: '', name: '' },
  });

  const timetableForm = useForm<z.infer<typeof timetableSchema>>({
    resolver: zodResolver(timetableSchema),
    defaultValues: { routeId: '', stop: '', times: '', coords: '' },
  });

  const handleAddRoute = async (values: z.infer<typeof routeSchema>) => {
    startTransitionRoute(async () => {
      const result = await addRouteAction(values);
      if (result.success) {
        toast({ title: 'Pavyko!', description: 'Maršrutas sėkmingai pridėtas.' });
        routeForm.reset();
        if(result.newRoute) setRoutes(prev => [...prev, result.newRoute!]);
      } else {
        toast({
          title: 'Klaida!',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleAddTimetable = async (values: z.infer<typeof timetableSchema>) => {
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

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Naujas maršrutas</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...routeForm}>
            <form onSubmit={routeForm.handleSubmit(handleAddRoute)} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <FormField
                  control={routeForm.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nr.</FormLabel>
                      <FormControl>
                        <Input placeholder="10G" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={routeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Pavadinimas</FormLabel>
                      <FormControl>
                        <Input placeholder="Stotis - Centras" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={isPendingRoute}>
                {isPendingRoute && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pridėti maršrutą
              </Button>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
