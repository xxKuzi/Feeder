import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function ServoTest() {
  const [angle, setAngle] = useState(0);

  const handleSetServoAngle = async () => {
    try {
      // Pass the angle to set_servo_angle command
      const result = await invoke("set_servo_angle", {
        angle: angle >= 0 && angle <= 180 ? angle : undefined,
      });
      console.log(result);
    } catch (error) {
      console.error("Error setting servo angle:", error);
    }
  };

  return (
    <div className="flex mt-4 flex-col justify-center items-center border-2 px-6 py-4 rounded-lg">
      <p className="text-3xl">Servo Control</p>
      <p>
        Servo Angle (0-180):
        <input
          className="mt-4"
          type="number"
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
          min="0"
          max="180"
        />
      </p>
      <div className="gap-2 flex mt-4">
        <button
          className="button__positive button__small"
          onClick={handleSetServoAngle}
        >
          Set Servo Angle
        </button>
      </div>
    </div>
  );
}

export default ServoTest;
