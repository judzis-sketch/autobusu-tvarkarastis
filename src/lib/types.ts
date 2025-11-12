export type TimetableEntry = {
  id?: string;
  stop: string;
  times: string[];
  coords?: [number, number];
  createdAt?: string;
};

export type Route = {
  id?: string;
  number: string;
  name: string;
  createdAt?: string;
};
