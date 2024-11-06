// ModalButton.js
import React, { useState, forwardRef, useImperativeHandle } from "react";

const Modal = forwardRef((_, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [modalProps, setModalProps] = useState({
    confirmButton: "",
    headline: "XXXAre you sure?",
    question: "XXXDo you want to proceed?",
    color: "lightblue",
    input: false,
    onConfirm: () => console.log("XXXDefault confirm"),
  });

  // Expose the openModal function via the ref
  useImperativeHandle(ref, () => ({
    openModal: ({
      confirmButton,
      headline,
      question,
      color,
      onConfirm,
      input,
    }) => {
      setModalProps({
        confirmButton,
        headline,
        question,
        color,
        onConfirm,
        input,
      });
      setIsOpen(true);
    },
  }));

  const closeModal = () => setIsOpen(false);

  const handleConfirm = () => {
    modalProps.input ? modalProps.onConfirm(input) : modalProps.onConfirm();
    closeModal();
  };

  const selectedColor = () => {
    switch (modalProps.color) {
      case "positive":
        return "bg-green-400";

      case "negative":
        return "bg-red-600";

      case "submit":
        return "bg-indigo-600";
    }
  };

  return (
    <div>
      {/* Modal Component */}
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
              {modalProps.input && (
                <input
                  className="input"
                  onChange={(e) => setInput(e.target.value)}
                ></input>
              )}
              <div className="mt-6 flex gap-6 items-center justify-center">
                {modalProps.confirmButton && (
                  <button
                    className={
                      "text-white w-full py-2 rounded-md " + selectedColor()
                    }
                    onClick={handleConfirm}
                  >
                    {modalProps.confirmButton}
                  </button>
                )}
                <button
                  className="bg-gray-200 w-full py-2 rounded-md"
                  onClick={closeModal}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Modal;
