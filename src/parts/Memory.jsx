import React, { useState, useEffect, createContext, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
const DataContext = createContext();

export function Memory({ children }) {
  const [statistics, setStatistics] = useState({ taken: 0, made: 0 });
  const [profile, setProfile] = useState({ userId: 0, name: "x" });
  const [records, setRecords] = useState([{}]);

  useEffect(() => {
    loadCurrentData();
    loadRecords();
  }, []);

  const loadCurrentData = async () => {
    let userDataRust = (await invoke("load_current_data"))[0]; //because it returns an object in an array
    const userData = {
      userId: userDataRust.user_id,
      name: userDataRust.name,
      number: userDataRust.number,
    };
    if (userData) {
      updateProfile(userData);
    }
  };

  const loadRecords = async () => {
    const loadedRecords = await invoke("load_records");
    setRecords(loadedRecords);
  };

  const updateStatistics = (made, taken) => {
    console.log("deleting", made, " ", taken);
    setStatistics({ made: made, taken: taken });
  };

  const updateProfile = (userData) => {
    setProfile(userData);
  };

  const shoot = (success) => {
    success
      ? setStatistics((prev) => ({
          ...prev,
          made: prev.made + 1,
          taken: prev.taken + 1,
        }))
      : setStatistics((prev) => ({ ...prev, taken: prev.taken + 1 }));
  };

  async function addRecord(made, taken) {
    try {
      await invoke("add_record", {
        data: { made, taken, user_id: profile.userId },
      });
      console.log("Record added successfully");
    } catch (error) {
      console.error("Failed to add record:", error);
    }
    await loadRecords();
  }

  const contextData = {
    statistics,
    updateStatistics,
    shoot,
    profile,
    updateProfile,
    addRecord,
    loadRecords,
    records,
  };

  return (
    <DataContext.Provider value={contextData}>{children}</DataContext.Provider>
  );
}

export const useData = () => {
  return useContext(DataContext);
};
