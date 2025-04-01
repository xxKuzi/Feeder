import { useEffect, useState } from "react";
import { Record, columns } from "./columns";
import { DataTable } from "./data-table";
import { useData } from "../../parts/Memory";

export default function DemoPage() {
  const [data, setData] = useState<Record[] | null>(null);
  const { records, users } = useData();

  type User = {
    userId: number;
    name: number;
  };

  useEffect(() => {
    //Getting and Editing data for table
    const data = records.map((record: Record) => {
      const realUser = users.find(
        (user: User) => user.userId === record.userId
      );

      return {
        ...record,
        user: realUser.name,
        percentage: Math.round((record.made / record.taken) * 100) + "%",
      };
    });
    console.log("data :", data);
    setData(data);
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
