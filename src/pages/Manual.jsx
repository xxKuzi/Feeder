import React, { useState, useEffect } from "react";
import ManualSimulation from "@/components/ManualSimulation";
import { useData } from "../parts/Memory.jsx";
import ManualScheduler from "@/components/ManualScheduler";
import { useNavigate } from "react-router-dom";

export default function Manual() {
  const [isPositionDisabled, setIsPositionDisabled] = useState(false);
  const [isPassDisabled, setIsPassDisabled] = useState(false);
  const [saveDelay, setSaveDelay] = useState(false);
  const {
    globalAngle,
    setGlobalAngle,
    globalMotorSpeed,
    rotateStepperMotor,
    setWorkoutData,
    manualMemory,
    setManualMemory,
    toggleServo,
  } = useData();
  const navigate = useNavigate();

  const changeAngle = () => {
    let difference = manualMemory.angle - globalAngle;
    rotateStepperMotor(difference);
    setGlobalAngle(manualMemory.angle);
    // manualMemory.distance - globalMotorSpeed

    // Disable the button for 3 seconds
    setSaveDelay(true);
    setTimeout(() => {
      setSaveDelay(false);
    }, 3000);
  };

  const pass = () => {
    setIsPassDisabled(true);
    toggleServo(true);
    setTimeout(() => {
      setIsPassDisabled(false);
      toggleServo(false);
    }, 2000);
  };

  //Check if saveDelay is false
  useEffect(() => {
    if (globalAngle !== manualMemory.angle && !saveDelay) {
      // add also speed / distance
      setIsPositionDisabled(false);
    } else {
      setIsPositionDisabled(true);
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
            isPositionDisabled
              ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
              : ""
          }`}
          disabled={isPositionDisabled}
          onClick={changeAngle}
        >
          Vyzkoušet pozici
        </button>
        <button
          className={`button__positive button mt-8 ${
            isPassDisabled ? "bg-gray-200 text-gray-400 hover:bg-gray-200" : ""
          }`}
          disabled={isPassDisabled}
          onClick={pass}
        >
          Vyzkoušet přihrávku
        </button>
      </div>
      <button
        className="button px-10 py-4 button__submit mt-4"
        onClick={startWorkout}
      >
        Start
      </button>
    </div>
  );
}
