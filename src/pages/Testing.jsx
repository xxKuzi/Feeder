import React, { useState, useRef } from "react";
import KeyboardOverlay from "../parts/Keyboard";
import MotorTest from "../components/MotorTest.tsx";
import { useData } from "../parts/Memory.jsx";

export default function Testing() {
  const [text, setText] = useState(["a", "b"]);
  const { openModal, showKeyboard } = useData();

  return (
    <div>
      Testing
      {/* <KeyboardSite /> */}
      <MotorTest />
      <button
        onClick={() => openModal({ buttons: { cancel: true, ok: true } })}
      >
        Open modal
      </button>
      <input
        onFocus={(e) =>
          showKeyboard(e, (newValue) => setText((prev) => [newValue, prev[1]]))
        }
        value={text[0]}
        className="p-2 border rounded"
      />
      <input
        onFocus={(e) =>
          showKeyboard(e, (newValue) => setText((prev) => [prev[0], newValue]))
        }
        value={text[1]}
        className="p-2 border rounded"
      />
    </div>
  );
}
