import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";

export default function MotorTest() {
  const {
    rotateStepperMotor,
    toggleServo,
    globalAngle,
    setGlobalAngle,
    globalServoState,
  } = useData();

  const changeMotorAngle = (dif: number) => {
    const newAngle = globalAngle + dif;
    rotateStepperMotor(dif);
    setGlobalAngle(newAngle);
  };

  return (
    <div className="flex flex-col items-center justify-center mt-8 rounded-xl bg-gray-100 px-4 py-2">
      <h1 className="text-2xl font-bold mb-4">Motor & Servo Control</h1>
      <div className="flex flex-col items-center justify-center">
        <div className="border-2 rounded-lg border-red-400 px-3 py-1">
          <h2 className="text-xl">Global states</h2>
          <p>Stepper motor Angle: {globalAngle}</p>
          <p>Servo state: {globalServoState.toString()}</p>
        </div>
      </div>

      <h2 className="text-xl mt-8">Servo control</h2>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          className={`button button__positive`}
          onClick={() => toggleServo(true)}
        >
          Toggle True
        </button>
        <button
          className={`button button__positive`}
          onClick={() => toggleServo(false)}
        >
          Toggle False
        </button>
      </div>
      <h2 className="text-xl mt-32">Stepper motor control</h2>
      <div className="mt-4 flex gap-4 justify-center  items-center ">
        <div className="flex items-center flex-col justify-center gap-4">
          <button
            disabled={globalAngle < 5}
            className={`button button__positive ${
              globalAngle < 5
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(-5)}
          >
            5 degrees to left
          </button>
          <button
            disabled={globalAngle < 15}
            className={`button button__positive ${
              globalAngle < 15
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(-15)}
          >
            15 degrees to left
          </button>
          <button
            disabled={globalAngle < 45}
            className={`button button__positive ${
              globalAngle < 45
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(-45)}
          >
            45 degrees to left
          </button>
        </div>
        <div className="h-32 border-[1px] border-gray-400 rounded"></div>
        <div className="flex items-center flex-col justify-center gap-4">
          <button
            disabled={globalAngle > 175}
            className={`button button__positive ${
              globalAngle > 175
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(5)}
          >
            5 degrees to right
          </button>
          <button
            disabled={globalAngle > 165}
            className={`button button__positive ${
              globalAngle > 165
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(15)}
          >
            15 degrees to right
          </button>
          <button
            disabled={globalAngle > 135}
            className={`button button__positive ${
              globalAngle > 135
                ? "bg-gray-200 text-gray-400 hover:bg-gray-200"
                : ""
            }`}
            onClick={() => changeMotorAngle(45)}
          >
            45 degrees to right
          </button>
        </div>
      </div>
    </div>
  );
}
