"use client";

import { ColumnDef } from "@tanstack/react-table";

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type Record = {
  userId: number;
  made: number;
  taken: number;
  percentage: string;
  createdAt: string;
  user: string;
};

export const columns: ColumnDef<Record>[] = [
  {
    accessorKey: "user",
    header: "Hráč",
  },
  {
    accessorKey: "made",
    header: "Proměnil",
  },
  {
    accessorKey: "taken",
    header: "Vstřelil",
  },
  {
    accessorKey: "percentage",
    header: "Úspěšnost",
  },
  {
    accessorKey: "createdAt",
    header: "Datum střelby",
  },
];
