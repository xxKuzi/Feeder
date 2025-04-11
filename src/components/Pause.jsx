import { useState } from "react";
import { FaCirclePause } from "react-icons/fa6";

export default function FullscreenPopup({
  enabled,
  handleClick,
  handleResume,
  handleReset,
  handleExit,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => (setIsOpen(true), handleClick())}
        disabled={!enabled}
      >
        <FaCirclePause color={enabled ? "3167c5" : "4a5668"} size={60} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
          // onClick={() => (setIsOpen(false), handleResume())}
        >
          <div
            className="bg-white px-6 py-10 rounded-2xl shadow-lg flex flex-col gap-4 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-3xl font-semibold">Pause menu</p>
            <div className="flex flex-col items-center justify-center gap-5">
              <button
                className="px-4 mt-8 py-3 bg-blue-500 rounded text-white w-3/4"
                onClick={() => (setIsOpen(false), handleResume())}
              >
                Pokračovat
              </button>
              <button
                className="px-4 py-3 bg-red-500 rounded text-white w-3/4"
                onClick={() => (setIsOpen(false), handleReset())}
              >
                Reset
              </button>
              <button
                className="px-4 py-3 bg-gray-500 rounded text-white w-3/4"
                onClick={() => (setIsOpen(false), handleExit())}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
