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

    useEffect(() => {
      const style = document.createElement("style");
      style.innerHTML = `        

        .simple-keyboard .hg-button {
          height: 70px !important;
          font-size: 20px !important;          
        }
      `;
      document.head.appendChild(style);

      return () => {
        document.head.removeChild(style);
      };
    }, []);

    useEffect(() => {
      if (isVisible) {
        document.body.style.overflow = "hidden"; // disables scroll
      } else {
        document.body.style.overflow = ""; // restores scroll
      }

      // Cleanup function to restore scrolling when unmounted
      return () => {
        document.body.style.overflow = "";
      };
    }, [isVisible]);

    useImperativeHandle(ref, () => ({
      showKeyboard: (
        e: React.FocusEvent<HTMLInputElement>,
        setState: React.Dispatch<React.SetStateAction<string>>
      ) => {
        stateSetterRef.current = setState;
        console.log("E bro ", e);
        console.log("set State ", setState);
        setInput(e ? e.target.value : "");
        setIsVisible(true);
        //for some reason - it needs time to load
        setTimeout(() => {
          keyboardRef.current.setInput(e ? e.target.value : "");
        }, 50);
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
        console.log("shift");
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
          <div className="ml-[135px] px-6 py-6 fixed z-50 inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-end">
            <button
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded fixed text-xl top-2 right-6" // 2, 6 - because of 4 padding
              onClick={() => {
                if (ref && typeof ref !== "function" && ref.current) {
                  ref.current.hideKeyboard();
                }
              }}
            >
              Zavřít
            </button>
            <input
              autoFocus
              className="mb-12 py-2 px-2 text-5xl border rounded"
              value={input}
              onChange={(e) => onChange(e.target.value)}
            />

            <Keyboard
              keyboardRef={(r) => (keyboardRef.current = r)}
              layoutName={layoutName}
              onChange={onChange}
              onKeyPress={onKeyPress}
            />
          </div>
        )}
      </div>
    );
  }
);

export default KeyboardOverlay;
