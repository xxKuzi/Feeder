import React, { useState, useRef, useEffect } from "react";
import { useData } from "../parts/Memory.jsx";
import KeyboardOverlay from "../parts/Keyboard";
import MotorTest from "../components/MotorTest.tsx";
import BluetoothControls from "@/components/BluetoothControls.tsx";
import { FaPowerOff } from "react-icons/fa6";
import { FaSignOutAlt } from "react-icons/fa";
import { invoke } from "@tauri-apps/api/core";

export default function Testing() {
  const [text, setText] = useState(["a", "b"]);
  const {
    openModal,
    showKeyboard,
    checkLimitSwitch,
    setCalibrationState,
    developerMode,
    unlockDeveloperMode,
    singOutDeveloperMode,
    setGlobalAngle,
  } = useData();

  useEffect(() => {
    if (!developerMode) {
      unlockDeveloperMode();
    }
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center">
      <h1 className="headline mt-8">Testing</h1>
      <button
        onClick={() => {
          invoke("exit_app");
        }}
        className="absolute right-4 top-4"
      >
        <div className="flex mt-6 justify-center items-center">
          <p className="mr-2 text-xl">Vypnout</p> <FaPowerOff size={20} />
        </div>
      </button>
      <button
        onClick={() => {
          singOutDeveloperMode();
        }}
        className="absolute right-4 top-12"
      >
        <div className="flex mt-6 justify-center items-center">
          <p className="mr-2 text-xl">Odhlásit Developer Mode</p>{" "}
          <FaSignOutAlt size={20} />
        </div>
      </button>
      <MotorTest />
      <BluetoothControls />
      <p className="mt-32">
        --------------------------------------------------------------------------------------------------------------------------------
      </p>
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => checkLimitSwitch()}
          className="button button__negative"
        >
          check switch
        </button>
        <button
          onClick={() => setCalibrationState("false")}
          className="button button__negative"
        >
          calibration false
        </button>
        <button
          onClick={() => setGlobalAngle(90)}
          className="button button__negative"
        >
          calibration 90
        </button>
      </div>
      <div className="flex flex-col items-center justify-center bg-gray-200 rounded-xl mt-10 px-4 py-2">
        <h1 className="text-2xl font-bold">Keyboard & Input Testing</h1>
        <input
          onFocus={(e) =>
            showKeyboard(e, (newValue) =>
              setText((prev) => [newValue, prev[1]])
            )
          }
          value={text[0]}
          onChange={() => {}}
          className="p-2 border rounded mt-4"
        />
        <input
          onFocus={(e) =>
            showKeyboard(e, (newValue) =>
              setText((prev) => [prev[0], newValue])
            )
          }
          onChange={() => {}}
          value={text[1]}
          className="p-2 border rounded"
        />
      </div>
    </div>
  );
}
