import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";

export default function MotorTest() {
  const { rotateStepperMotor } = useData();

  return (
    <div className="flex flex-col items-center justify-center mt-8 rounded-xl bg-gray-100 px-4 py-2">
      <h1 className="text-2xl font-bold mb-4">Motor & Servo Control</h1>

      <h2 className="text-xl">Servo control</h2>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          className={`button button__positive`}
          onClick={() => rotateStepperMotor(15)}
        >
          15 degrees to left
        </button>
        <button
          className={`button button__positive`}
          onClick={() => rotateStepperMotor(-15)}
        >
          15 degrees to right
        </button>
      </div>
      <h2 className="text-xl mt-32">Stepper motor control</h2>
      <div className="mt-4 flex gap-4 justify-center  items-center ">
        <div className="flex items-center flex-col justify-center gap-4">
          <button
            className={`button button__positive`}
            onClick={() => rotateStepperMotor(15)}
          >
            15 degrees to left
          </button>
          <button
            className={`button button__positive`}
            onClick={() => rotateStepperMotor(45)}
          >
            45 degrees to left
          </button>
        </div>
        <div className="h-32 border-[1px] border-gray-400 rounded"></div>
        <div className="flex items-center flex-col justify-center gap-4">
          <button
            className={`button button__positive`}
            onClick={() => rotateStepperMotor(-15)}
          >
            15 degrees to right
          </button>
          <button
            className={`button button__positive`}
            onClick={() => rotateStepperMotor(-45)}
          >
            45 degrees to right
          </button>
        </div>
      </div>
    </div>
  );
}
