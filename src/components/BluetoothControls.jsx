import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const BluetoothControls = () => {
  const [workoutState, setWorkoutState] = useState("Unknown");

  const startWorkout = async () => {
    try {
      await invoke("start_workout");
      setWorkoutState("running");
    } catch (err) {
      console.error("Error starting workout:", err);
    }
  };

  const pauseWorkout = async () => {
    try {
      await invoke("pause_workout");
      setWorkoutState("paused");
    } catch (err) {
      console.error("Error pausing workout:", err);
    }
  };

  const fetchState = async () => {
    try {
      const state = await invoke("get_workout_state");
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
