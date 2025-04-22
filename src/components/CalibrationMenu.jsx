import React from "react";
import { useData } from "@/parts/Memory";

export default function CalibrationMenu() {
  const { lastCalibration, openCalibration } = useData();
  return (
    <div className="relative border-2 border-sky-400 hover:border-gray-300 duration-300 w-[492px] px-4 py-1 rounded-lg mt-8">
      <h2 className="text-4xl">Kalibrace</h2>
      <p>Poslední kalibrace byla provedena: {lastCalibration}</p>
      <button
        onClick={() => openCalibration()}
        className="absolute top-2 right-2 button__small button__positive"
      >
        kalibrační menu
      </button>
    </div>
  );
}
