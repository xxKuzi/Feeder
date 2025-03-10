import React, { useState, useRef } from "react";
import { useData } from "../parts/Memory.jsx";
import KeyboardOverlay from "../parts/Keyboard";
import MotorTest from "../components/MotorTest.tsx";
import BluetoothControls from "@/components/BluetoothControls.tsx";

export default function Testing() {
  const [text, setText] = useState(["a", "b"]);
  const { openModal, showKeyboard } = useData();

  return (
    <div>
      Testing
      {/* <KeyboardSite /> */}
      <MotorTest />
      <button
        onClick={() =>
          openModal({
            buttons: { cancel: true, ok: true },
            input: true,
            numberOfInputs: 2,
            inputPlaceholders: ["name", "age"],
            inputData: { name: "petr", age: 11 },
          })
        }
      >
        Open modal
      </button>
      <input
        onFocus={(e) =>
          showKeyboard(e, (newValue) => setText((prev) => [newValue, prev[1]]))
        }
        value={text[0]}
        onChange={() => {}}
        className="p-2 border rounded"
      />
      <input
        onFocus={(e) =>
          showKeyboard(e, (newValue) => setText((prev) => [prev[0], newValue]))
        }
        onChange={() => {}}
        value={text[1]}
        className="p-2 border rounded"
      />
      <BluetoothControls />
    </div>
  );
}
