export type TimetableEntry = {
  id?: string;
  stop: string;
  arrivalTimes: string[];
  departureTimes?: string[];
  coords?: [number, number];
  distanceToNext?: number; // Distance in meters to the next stop
  routeGeometry?: { lat: number; lng: number }[]; // The geometry of the path to the next stop
  createdAt?: any;
};

export type RouteType = 'Vietinio susisiekimo' | 'Tolimojo susisiekimo';

export type Route = {
  id?: string;
  number?: string;
  name: string;
  days: string[];
  type: RouteType;
  createdAt?: string;
};
