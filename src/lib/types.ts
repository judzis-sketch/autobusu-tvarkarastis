export type TimetableEntry = {
  id?: string;
  stop: string;
  times: string[];
  coords?: [number, number];
  distanceToNext?: number; // Distance in meters to the next stop
  createdAt?: {
    seconds: number,
    nanoseconds: number,
  };
};

export type Route = {
  id?: string;
  number?: string;
  name: string;
  days: string[];
  createdAt?: string;
};
