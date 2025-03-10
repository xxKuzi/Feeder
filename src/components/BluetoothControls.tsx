import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const BluetoothControls = () => {
  const [workoutState, setWorkoutState] = useState<string>("Unknown");

  useEffect(() => {
    // Listen for the "state-changed" global event.
    const unlistenPromise = listen<string>("state-changed", (event) => {
      console.log(`State changed event received: ${event.payload}`);
      setWorkoutState(event.payload);
    });

    // Clean up the event listener on component unmount.
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

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
      <h1>Current Workout State: {workoutState}</h1>
      <button onClick={startWorkout}>Start Workout</button>
      <button onClick={pauseWorkout}>Pause Workout</button>
    </div>
  );
};

export default BluetoothControls;
