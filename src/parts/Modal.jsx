import React, {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from "react";
import { useData } from "@/parts/Memory";
import { Eye, EyeOff } from "lucide-react";

const Modal = forwardRef((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState({}); //expects {name: "petr", age: 18} - name, age are placeholders
  const [modalProps, setModalProps] = useState({});
  const [isPasswordVisible, setIsPasswordVisible] = useState({});
  const { showKeyboard } = useData();

  const togglePasswordVisibility = (index) => {
    setIsPasswordVisible((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Expose the openModal function via the ref
  useImperativeHandle(ref, () => ({
    openModal: ({
      buttons = {},

      areaHandle = () => setIsOpen(false),
      crossEnabled = true,

      cancelLabel = "Cancel",
      cancelColor = "bg-gray-400",
      cancelHandle = () => setIsOpen(false),

      okLabel = "Ok",
      okColor = "bg-blue-500",
      okHandle = () => setIsOpen(false),

      declineLabel = "Special",
      declineColor = "bg-red-500",
      declineHandle = () => setIsOpen(false),

      confirmLabel = "Yes",
      confirmColor = "bg-indigo-500",
      confirmHandle = () => setIsOpen(false),

      headline = "XXXAre you sure?",
      question = "XXXDo you want to proceed?",

      input = false,
      numberOfInputs = 0,
      inputData = [""],
      inputPlaceholders = ["age"], //for order of inputs (input array can have different order of elements than in modal window)
      placeholders = ["Age"], //Visible placeholders
      inputTypes = [],
    }) => {
      setModalProps({
        buttons: {
          cancel: false,
          ok: false,
          decline: false,
          confirm: false,
          ...buttons,
        },

        buttonConfig: {
          cross: {
            enabled: crossEnabled,
          },
          area: {
            handle: areaHandle,
          },
          cancel: {
            label: cancelLabel,
            color: cancelColor,
            handle: cancelHandle,
          },
          ok: { label: okLabel, color: okColor, handle: okHandle },

          decline: {
            label: declineLabel,
            color: declineColor,
            handle: declineHandle,
          },
          confirm: {
            label: confirmLabel,
            color: confirmColor,
            handle: confirmHandle,
          },
        },

        headline,
        question,

        input,
        numberOfInputs,
        inputData,
        inputPlaceholders,
        placeholders,
        inputTypes,
      });
      setInput(inputData);
      setIsPasswordVisible({});
      setIsOpen(true);
    },
  }));

  const closeModal = () => setIsOpen(false);

  const handleConfirm = () => {
    //on confirm I need to send input back
    modalProps.input
      ? modalProps.buttonConfig.confirm.handle(input)
      : modalProps.buttonConfig.confirm.handle;
    closeModal();
  };

  return (
    <div>
      {isOpen && (
        <div
          onClick={() => {
            modalProps.buttonConfig.area.handle();
          }}
          className="ml-[135px] fixed z-50 inset-0 flex justify-center items-center bg-black/20 backdrop-blur-md duration-1000 transition-colors "
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow px-10 py-6 transition-all scale-100 opacity-100"
          >
            {modalProps.buttonConfig.cross.enabled && (
              <button
                onClick={closeModal}
                aria-label="Close"
                className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600"
              >
                ✕
              </button>
            )}
            <div className="flex text-center flex-col items-center justify-center">
              <div className="mb-6 w-6s4">
                <p className="text-xl font-bold text-gray-800">
                  {modalProps.headline}
                </p>
                <p className="text-sm mt-2 text-gray-500">
                  {modalProps.question}
                </p>
              </div>
              {modalProps.input &&
                Array.from({ length: modalProps.numberOfInputs }).map(
                  (_, i) => {
                    const isPassword =
                      modalProps.inputTypes?.[i] === "password" ||
                      modalProps.inputPlaceholders?.[i]?.toLowerCase() === "password";
                    const inputType = isPassword
                      ? (isPasswordVisible[i] ? "text" : "password")
                      : "text";
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-center gap-4 text-start"
                      >
                        <p className="w-32">{modalProps.placeholders[i]}</p>
                        <div className="relative flex items-center">
                          <input
                            type={inputType}
                            className={`input w-[200px] ${isPassword ? "pr-10" : ""}`}
                            value={input[modalProps.inputPlaceholders[i]]}
                            onFocus={(e) =>
                              showKeyboard(e, (newValue) => {
                                setInput((prev) => {
                                  const updated = { ...prev };
                                  console.log("new value ", newValue);
                                  console.log(modalProps.inputPlaceholders[i]);
                                  updated[modalProps.inputPlaceholders[i]] =
                                    newValue;
                                  console.log("updated ", updated);
                                  return updated;
                                });
                              })
                            }
                            onChange={(e) => {
                              setInput((prev) => {
                                const updated = { ...prev };
                                updated[modalProps.inputPlaceholders[i]] =
                                  e.target.value;
                                return updated;
                              });
                            }}
                          />
                          {isPassword && (
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(i)}
                              className="absolute right-2 text-gray-500 hover:text-gray-700 focus:outline-none flex items-center justify-center"
                            >
                              {isPasswordVisible[i] ? (
                                <EyeOff size={20} />
                              ) : (
                                <Eye size={20} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}

              <div className="flex justify-center w-full items-center mt-6 gap-8">
                {Object.entries(modalProps.buttonConfig).map((button, i) => {
                  //button[0] is name - "confirm", button[1] is the values (label, color, handle)

                  if (modalProps.buttons[button[0]]) {
                    //checks if we wanted that button on the modal window - (confirm: true)
                    return (
                      <button
                        key={i}
                        className={`text-white ${String(
                          button[1].color
                        )} w-full  py-2 rounded-md  `}
                        onClick={() => {
                          if (button[0] === "confirm") {
                            button[1].handle(input); // passes the input
                          } else {
                            button[1].handle(); // if cancel it doesn't pass the data
                          }

                          closeModal();
                        }}
                      >
                        {button[1].label}
                      </button>
                    );
                  }
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Modal;
