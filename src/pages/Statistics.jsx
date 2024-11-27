import React, { useEffect, useState } from "react";
import { useData } from "../parts/Memory";
import { invoke } from "@tauri-apps/api/core";

export default function Statistics() {
  const [records, setRecords] = useState([]);
  const [statistics, setStatistics] = useState([]);

  useEffect(() => {
    loadRecords(); // Fetch users on component mount
  }, []);

  const loadRecords = async () => {
    try {
      const recordsListRust = await invoke("load_records");
      const recordsList = recordsListRust.map((record) => ({
        historyId: record.history_id,
        made: record.made,
        taken: record.taken,
        userId: record.user_id,
        createdAt: record.created_at,
      }));
      setRecords(recordsList);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  return (
    <div className="flex flex-col items-center h-screen justify-center">
      <p className="headline">Statistics</p>
      <div className="mt-8 flex items-center justify-center px-8 py-4 border-2 text-center gap-4 rounded-xl">
        <div className="w-16">
          <p>made</p>
          <p className="text-center">{statistics.made}</p>
        </div>

        <div className="w-16">
          <p>taken</p>
          <p className="text-center">{statistics.taken}</p>
        </div>

        <div className="w-16">
          <p>success</p>
          <p className="text-center">
            {Math.round((statistics.made / statistics.taken) * 100) + "%"}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center px-8 py-4 border-2 text-center gap-4 rounded-xl">
        {records.map((record, i) => (
          <div key={i}>
            <p>made: {record.made}</p>
            <p>taken: {record.taken}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
