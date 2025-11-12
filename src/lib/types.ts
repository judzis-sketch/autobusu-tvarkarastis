export type TimetableEntry = {
  id?: string;
  stop: string;
  times: string[];
  coords?: [number, number];
  distanceToNext?: number; // Distance in meters to the next stop
  createdAt?: string;
};

export type Route = {
  id?: string;
  number: string;
  name: string;
  createdAt?: string;
};
