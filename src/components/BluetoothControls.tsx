import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const BluetoothControls = () => {
  const [workoutState, setWorkoutState] = useState<string>("Unknown");

  const appWebview = getCurrentWebviewWindow();
  console.log("appwebview ", appWebview);

  appWebview.listen<string>("state-changed", (event) => {
    // localStorage.setItem("console-message", event.payload);
    console.log("payload ", event.payload);
    if (event.payload === "on") {
      setWorkoutState("running");
    } else if (event.payload === "off") {
      setWorkoutState("pause");
    } else {
      setWorkoutState("bad argument");
    }
  });

  const startWorkout = async () => {
    try {
      await invoke("start_workout");
      // Optionally, you can update the state immediately.
      setWorkoutState("running");
    } catch (err) {
      console.error("Error starting workout:", err);
    }
  };

  const pauseWorkout = async () => {
    try {
      await invoke("pause_workout");
      // Optionally, update the state immediately.
      setWorkoutState("paused");
    } catch (err) {
      console.error("Error pausing workout:", err);
    }
  };

  const fetchState = async () => {
    try {
      const state = await invoke<string>("get_workout_state");
      setWorkoutState(state);
    } catch (err) {
      console.error("Error fetching workout state:", err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1 className="px-6 py-4 text-xl text-center border-2 border-blue1 rounded-xl">
        Current Workout State: {workoutState}
      </h1>
      <div className="flex items-center justify-center space-x-6 mt-4">
        <button className="button button__positive" onClick={startWorkout}>
          Start Workout
        </button>
        <button className="button button__negative" onClick={pauseWorkout}>
          Pause Workout
        </button>
      </div>
    </div>
  );
};

export default BluetoothControls;
