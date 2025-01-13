import React, { useState, useRef } from "react";
import Keyboard from "react-simple-keyboard";

import "react-simple-keyboard/build/css/index.css";

const KeyboardSite = () => {
  const [layoutName, setLayoutName] = useState("default");
  const [input, setInput] = useState("");
  const keyboardRef = useRef<any>(null);

  const onChange = (input: any) => {
    setInput(input);
    console.log("Input changed", input);
  };

  const onKeyPress = (button: any) => {
    console.log("Button pressed", button);

    /**
     * If you want to handle the shift and caps lock buttons
     */
    if (button === "{shift}" || button === "{lock}") handleShift();
  };

  const handleShift = () => {
    setLayoutName((prevLayout) =>
      prevLayout === "default" ? "shift" : "default"
    );
  };

  const onChangeInput = (event: any) => {
    const input = event.target.value;
    setInput(input);
    if (keyboardRef.current) {
      keyboardRef.current.setInput(input);
    }
  };

  return (
    <div className="bg-gray-100">
      <p>hello</p>
      <input
        value={input}
        placeholder={"Tap on the virtual keyboard to start"}
        onChange={onChangeInput}
      />
      <input
        value={input}
        placeholder={"Tap on the virtual keyboard to start"}
        onChange={onChangeInput}
      />

      <Keyboard
        keyboardRef={(r: any) => (keyboardRef.current = r)}
        layoutName={layoutName}
        onChange={onChange}
        onKeyPress={onKeyPress}
      />
    </div>
  );
};

export default KeyboardSite;
