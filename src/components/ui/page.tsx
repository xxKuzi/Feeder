import { useEffect, useState } from "react";
import { Record, columns } from "./columns";
import { DataTable } from "./data-table";
import { useData } from "../../parts/Memory";

async function getData(): Promise<Record[]> {
  return [
    {
      id: "1",
      made: 1,
      taken: 10,
      percentage: 1 / 2 + "%",
      user: "user1",
      time: new Date("2024-12-05"),
    },

    // ...
  ];
}

export default function DemoPage() {
  const [data, setData] = useState<Record[] | null>(null);
  const { records } = useData();
  useEffect(() => {
    // Fetch data from your API here.

    async function fetchData() {
      const fetchedData = await getData();
      setData(fetchedData);
    }
    fetchData();
  }, []);

  useEffect(() => {
    console.log("Data ", records);
  }, [records]);

  if (!data) {
    // Optionally render a loading indicator
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
