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
    const categoryDatabase: { [key: number]: string } = {
      1: "Dvoubodové střely",
      2: "Tříbodové střely",
      3: "Trestné hody",
    };
    const getCategoryName = (index: number) => categoryDatabase[index];

    //Getting and Editing data for table
    const data = records.map((record: Record) => {
      const realUser = users.find(
        (user: User) => user.userId === record.userId
      );

      return {
        ...record,
        user: realUser.name,
        percentage: Math.round((record.made / record.taken) * 100) + "%",
        name: record.name.charAt(0).toUpperCase() + record.name.slice(1),
        category: getCategoryName(record.category),
      };
    });
    console.log("data :", data);
    const reversedData = data.reverse();
    setData(data);
  }, [records]);

  if (!data) {
    // Optionally render a loading indicator
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10 mt-8">
      <DataTable columns={columns} data={data} />
    </div>
  );
}
