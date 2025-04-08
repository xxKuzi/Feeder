import React, { useState, useEffect } from "react";
import ManualSimulation from "@/components/ManualSimulation";
import { useData } from "../parts/Memory.jsx";

export default function Manual() {
  const [formData, setFormData] = useState({
    repetition: 10,
    intervals: [5],
    angles: [90],
    distances: [0],
  });
  const { globalAngle, globalMotorSpeed } = useData();
  const defaultData = {
    repetition: 10,
    intervals: [5],
    angles: [90],
    distances: [0],
  };

  // useEffect(() => {
  //   setFormData(defaultData);
  // }, []);

  useEffect(() => {
    console.log("formData: ", formData);
  });

  return (
    <div className="flex flex-col items-center h-screen justify-center">
      <h1 className="headline mb-10">Manual</h1>
      <ManualSimulation
        formData={formData}
        setFormData={setFormData}
        previousData={defaultData}
      />
      <button className={`button__submit button mt-4 ${true}`}>
        Změnit pozici
      </button>
    </div>
  );
}
