import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

interface KeyboardOverlayProps {
  children?: React.ReactNode;
}

export interface KeyboardOverlayRef {
  showKeyboard: (
    e: React.FocusEvent<HTMLInputElement>,
    setState: React.Dispatch<React.SetStateAction<string>>
  ) => void;
  hideKeyboard: () => void;
}

const KeyboardOverlay = forwardRef<KeyboardOverlayRef, KeyboardOverlayProps>(
  (props, ref) => {
    const [layoutName, setLayoutName] = useState("default");
    const [input, setInput] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const stateSetterRef = useRef<React.Dispatch<
      React.SetStateAction<string>
    > | null>(null);
    const keyboardRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      showKeyboard: (
        e: React.FocusEvent<HTMLInputElement>,
        setState: React.Dispatch<React.SetStateAction<string>>
      ) => {
        stateSetterRef.current = setState;
        setInput(e.target.value);
        setIsVisible(true);
      },
      hideKeyboard: () => {
        setIsVisible(false);
        stateSetterRef.current = null;
      },
    }));

    const onChange = (inputValue: string) => {
      setInput(inputValue);
    };

    const onKeyPress = (button: string) => {
      if (button === "{enter}") {
        stateSetterRef.current?.(input);
        setIsVisible(false);
        stateSetterRef.current = null;
      }

      if (button === "{shift}" || button === "{lock}") {
        handleShift();
      }
    };

    const handleShift = () => {
      setLayoutName((prev) => (prev === "default" ? "shift" : "default"));
    };

    useEffect(() => {
      if (keyboardRef.current && isVisible) {
        keyboardRef.current.setInput(input);
      }
    }, [isVisible, input]);

    return (
      <div>
        {isVisible && (
          <div className="ml-[135px] px-4 fixed inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center">
            <input
              autoFocus
              className="mb-2 p-2 border rounded"
              value={input}
              onChange={(e) => onChange(e.target.value)}
            />

            <Keyboard
              keyboardRef={(r) => (keyboardRef.current = r)}
              layoutName={layoutName}
              onChange={onChange}
              onKeyPress={onKeyPress}
            />

            <button
              className="mt-4 px-4 py-2 bg-gray-200 rounded"
              onClick={() => setIsVisible(false)}
            >
              Close
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default KeyboardOverlay;
