export type TimetableEntry = {
  id?: string;
  stop: string;
  times: string[];
  coords?: [number, number];
  createdAt?: any;
};

export type Route = {
  id?: string;
  number: string;
  name: string;
  createdAt?: any;
};
