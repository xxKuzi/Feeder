import React, { useState, forwardRef, useImperativeHandle } from "react";

const Modal = forwardRef((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState({});
  const [modalProps, setModalProps] = useState({});

  // Expose the openModal function via the ref
  useImperativeHandle(ref, () => ({
    openModal: ({
      buttons = {},

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
      inputData = [],
      inputPlaceholders = ["1"],
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
      });
      setInput(inputData);
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
          onClick={closeModal}
          className="fixed inset-0 flex justify-center items-center bg-black/20 duration-1000 transition-colors "
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow p-6 transition-all scale-100 opacity-100"
          >
            <button
              onClick={closeModal}
              aria-label="Close"
              className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600"
            >
              ✕
            </button>
            <div className="text-center w-56">
              <div className="mx-auto my-4 w-48">
                <h3 className="text-lg font-black text-gray-800">
                  {modalProps.headline}
                </h3>
                <p className="text-sm text-gray-500">{modalProps.question}</p>
              </div>
              {modalProps.input &&
                Array.from({ length: modalProps.numberOfInputs }).map(
                  (_, i) => (
                    <input
                      key={i}
                      placeholder={modalProps.inputPlaceholders[i]}
                      className="input"
                      value={input[modalProps.inputPlaceholders[i]]}
                      onChange={(e) =>
                        setInput((prev) => {
                          const updated = { ...prev };
                          updated[modalProps.inputPlaceholders[i]] =
                            e.target.value;
                          return updated;
                        })
                      }
                    />
                  )
                )}

              <div className="flex justify-center items-center mt-4 gap-4">
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
