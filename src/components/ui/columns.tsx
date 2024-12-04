"use client";

import { ColumnDef } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Record = {
  id: string;
  made: number;
  taken: number;
  percentage: string;
  time: Date;
  user: string;
};

export const columns: ColumnDef<Record>[] = [
  {
    accessorKey: "made",
    header: "Made",
  },
  {
    accessorKey: "taken",
    header: "Taken",
  },
  {
    accessorKey: "percentage",
    header: "Percentage",
  },
  {
    accessorKey: "time",
    header: "Time",
  },
  {
    accessorKey: "user",
    header: "User",
  },
];
