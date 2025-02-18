import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function MotorTest() {
  const [servoAngle, setServoAngle] = useState<number>(90); // Default at 90°
  const [motorSpeed, setMotorSpeed] = useState<number>(0); // Default at 0 RPM

  // Function to update values
  const updateValues = async (newServo: number, newSpeed: number) => {
    setServoAngle(newServo);
    setMotorSpeed(newSpeed);
    console.log("settings new values");

    // Send data to backend
    try {
      await invoke("set_servo_angle", { angle: newServo });
    } catch (error) {
      console.error("Failed to update motor/servo value:", error);
    }
  };

  const blink = async () => {
    try {
      await invoke("blink_led", { times: 50 });
    } catch (error) {
      console.error("Failed to update motor/servo value:", error);
    }
  };

  // Stop function
  const stopProgram = () => {
    updateValues(90, 0); // Reset values
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Motor & Servo Control</h1>

      {/* Servo Control */}
      <div className="w-96 p-4 mb-4 shadow-lg bg-white rounded-lg">
        <h2 className="text-lg font-semibold">Servo Angle: {servoAngle}°</h2>
        <input
          type="range"
          min="0"
          max="180"
          value={servoAngle}
          onChange={(e) => updateValues(parseInt(e.target.value), motorSpeed)}
          className="w-full"
        />
      </div>

      {/* Motor Speed Control */}
      <div className="w-96 p-4 mb-4 shadow-lg bg-white rounded-lg">
        <h2 className="text-lg font-semibold">Motor Speed: {motorSpeed} RPM</h2>
        <input
          type="range"
          min="0"
          max="2000"
          step="10"
          value={motorSpeed}
          onChange={(e) => updateValues(servoAngle, parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Stop Button */}
      <button
        className="bg-red-500 text-white px-6 py-2 rounded-lg shadow-md hover:bg-red-600 transition-all"
        onClick={stopProgram}
      >
        STOP PROGRAM
      </button>
      <button
        onClick={() => {
          blink();
        }}
      ></button>
    </div>
  );
}
