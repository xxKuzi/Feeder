import React, { useState, forwardRef, useImperativeHandle } from "react";
import { useData } from "../parts/Memory.jsx";

const CalibrationModal = forwardRef((_, ref) => {
  const { openModal, calibrate, calibrationState } = useData();
  const [isOpen, setIsOpen] = useState(false);

  // Expose openModal method via ref
  useImperativeHandle(ref, () => ({
    openModal: () => {
      setIsOpen(true);
    },
    closeModal: () => {
      setIsOpen(false);
    },
  }));

  const closeModal = () => setIsOpen(false);

  return (
    <div>
      {isOpen && (
        <div
          onClick={calibrationState === "true" ? closeModal : () => {}}
          className="fixed z-40 inset-0 flex justify-center items-center bg-black/20 transition-colors"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="ml-[135px] relative bg-white flex flex-col justify-center items-center w-[40vw] h-[40vh] min-w-[650px] min-h-[350px] rounded-xl shadow px-10 py-6"
          >
            {/* Close button */}
            {calibrationState === "true" && (
              <button
                onClick={closeModal}
                aria-label="Close"
                className="absolute top-0 right-2 p-1 rounded-lg text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600"
              >
                ✕
              </button>
            )}

            {/* Hardcoded content */}
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-800 mb-16">
                Kalibrace
              </h2>
              {calibrationState === "false" && (
                <p className="text-gray-600 mb-32">
                  Odstupte od zařízení a zahajte kalibraci stisknutím tlačítka
                  "Začít".
                </p>
              )}
              {calibrationState === "running" && (
                <p className="text-gray-600 mb-32">Hledání koncového bodu.</p>
              )}
              {calibrationState === "end_place" && (
                <p className="text-gray-600 mb-32">
                  Vracení do základní polohy.
                </p>
              )}
              {calibrationState === "true" && (
                <h1 className="text-4xl text-green-400 mb-32">
                  Kalibrace dokončena!
                </h1>
              )}

              <div className="flex justify-center">
                <button
                  onClick={() =>
                    calibrationState === "true"
                      ? closeModal()
                      : calibrationState === "false"
                      ? calibrate()
                      : null
                  }
                  className={`button text-white duration-300 ${
                    calibrationState === "true"
                      ? "bg-blue-500"
                      : calibrationState === "end_place"
                      ? "bg-yellow-300"
                      : calibrationState === "running"
                      ? "bg-green-400"
                      : "bg-black"
                  }`}
                >
                  {calibrationState === "true"
                    ? "Zavřít"
                    : calibrationState === "end_place"
                    ? "Konec nalezen"
                    : calibrationState === "running"
                    ? "Kalibrování➡️"
                    : "Kalibraci vyžádána❗"}
                </button>

                {calibrationState === "true" && (
                  <button
                    className="absolute left-4 top-2 hover:text-gray-600 duration-300"
                    onClick={() =>
                      openModal({
                        headline: "Opakovaná kalibrace",
                        question: "Opravdu chcete zařízení kalibrovat znovu?",
                        buttons: { confirm: true, cancel: true },
                        confirmHandle: () => {
                          calibrate();
                        },
                      })
                    }
                  >
                    Opakovat
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CalibrationModal;
