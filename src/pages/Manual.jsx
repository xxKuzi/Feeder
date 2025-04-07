import React, { useState, useEffect } from "react";
import ManualSimulation from "@/components/ManualSimulation";

export default function Manual() {
  const [formData, setFormData] = useState({});
  const defaultData = {
    name: "",
    image: "",
    category: 1,
    predefined: false,
    repetition: 10,
    intervals: [5],
    angles: [90],
    distances: [0],
  };

  useEffect(() => {
    setFormData(defaultData);
  }, []);

  return (
    <div className="flex flex-col items-center h-screen justify-center">
      <h1 className="headline mb-10">Manual</h1>
      <ManualSimulation
        formData={formData}
        setFormData={setFormData}
        previousData={defaultData}
      />
    </div>
  );
}
