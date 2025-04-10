import React, { useState, useEffect } from "react";
import ManualSimulation from "@/components/ManualSimulation";
import { useData } from "../parts/Memory.jsx";
import ManualScheduler from "@/components/ManualScheduler";
import { useNavigate } from "react-router-dom";

export default function Manual() {
  const [isDisabled, setIsDisabled] = useState(false);
  const [saveDelay, setSaveDelay] = useState(false);
  const {
    globalAngle,
    setGlobalAngle,
    globalMotorSpeed,
    rotateServo,
    setWorkoutData,
    manualMemory,
    setManualMemory,
  } = useData();
  const navigate = useNavigate();

  const changeAngle = () => {
    let difference = manualMemory.angle - globalAngle;
    rotateServo(difference);
    setGlobalAngle(manualMemory.angle);
    // manualMemory.distance - globalMotorSpeed

    // Disable the button for 3 seconds
    setSaveDelay(true);
    setTimeout(() => {
      setSaveDelay(false);
    }, 3000);
  };

  //Check if saveDelay is false
  useEffect(() => {
    if (globalAngle !== manualMemory.angle && !saveDelay) {
      // add also speed / distance
      setIsDisabled(false);
    } else {
      setIsDisabled(true);
    }
  }, [manualMemory, saveDelay]);

  const startWorkout = (data) => {
    data = {
      name: "Manual",
      category: "4",
      angles: [manualMemory.angle],
      distances: [manualMemory.distance],
      intervals: [manualMemory.interval],
      repetition: [manualMemory.repetition],
      predefined: false,
      image: "",
      modeId: 6,
    };
    setWorkoutData(data);
    navigate("/workout");
  };

  return (
    <div className="flex flex-col items-center h-screen justify-center">
      <h1 className="headline mb-12">Manuální ovládání</h1>
      <ManualScheduler formData={manualMemory} setFormData={setManualMemory} />

      <ManualSimulation formData={manualMemory} setFormData={setManualMemory} />
      <div className="space-x-4">
        <button
          className={`button__positive button mt-8 ${
            isDisabled ? "bg-gray-200 text-gray-400 hover:bg-gray-200" : ""
          }`}
          disabled={isDisabled}
          onClick={changeAngle}
        >
          Vyzkoušet pozici
        </button>
        <button className="button button__submit mt-4" onClick={startWorkout}>
          Start
        </button>
      </div>
    </div>
  );
}
