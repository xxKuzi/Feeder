import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

const WORKOUT_STATE_PAUSE = 0;
const WORKOUT_STATE_RUNNING = 1;
const WORKOUT_STATE_BREAK = 2;

function stateCodeToLabel(stateCode: number): string {
  if (stateCode === WORKOUT_STATE_RUNNING) {
    return "running";
  }
  if (stateCode === WORKOUT_STATE_PAUSE) {
    return "pause";
  }
  if (stateCode === WORKOUT_STATE_BREAK) {
    return "break";
  }
  return "unknown";
}

const BluetoothControls = () => {
  const [workoutState, setWorkoutState] = useState<string>("Unknown");

  const appWebview = getCurrentWebviewWindow();

  useEffect(() => {
    const unlistenStateChanged = appWebview.listen<number>(
      "state-changed",
      (event) => {
        console.log("Remote state-changed event:", event.payload);
        setWorkoutState(stateCodeToLabel(Number(event.payload)));
      },
    );

    return () => {
      unlistenStateChanged.then((fn) => fn());
    };
  }, []);

  const startWorkout = async () => {
    try {
      await invoke("start_workout");
      setWorkoutState(stateCodeToLabel(WORKOUT_STATE_RUNNING));
    } catch (err) {
      console.error("Error starting workout:", err);
    }
  };

  const pauseWorkout = async () => {
    try {
      await invoke("pause_workout");
      setWorkoutState(stateCodeToLabel(WORKOUT_STATE_PAUSE));
    } catch (err) {
      console.error("Error pausing workout:", err);
    }
  };

  const fetchState = async () => {
    try {
      const state = await invoke<number>("get_workout_state");
      setWorkoutState(stateCodeToLabel(Number(state)));
    } catch (err) {
      console.error("Error fetching workout state:", err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  return (
    <div className="px-16 py-8 mt-8 rounded-xl border-gray-300 border-2 ">
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
