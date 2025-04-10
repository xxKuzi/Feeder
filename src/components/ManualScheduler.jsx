import React, { useState } from "react";
import { useData } from "../parts/Memory";

export default function ManualSchedular({ formData, setFormData }) {
  const { toggleServo, showKeyboard } = useData();

  const updateFormData = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="flex items-center justify-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          Interval střelby
        </label>
        <input
          type="range"
          name="interval"
          min="1"
          max="15"
          value={formData.interval || 5}
          onChange={(e) => updateFormData(e.target.name, e.target.value)}
          className="w-full"
        />
        <input
          type="number"
          value={formData.interval}
          name="interval"
          readOnly
          onFocus={(e) =>
            showKeyboard(e, (newValue) =>
              newValue <= 20 && newValue >= 0
                ? updateFormData(e.target.name, newValue)
                : null
            )
          }
          className="w-16 border border-gray-300 rounded p-1"
        />
      </div>
      <div className="flex items-center justify-center gap-4">
        <label className="text-sm font-medium text-gray-700">
          Počet opakování
        </label>
        <input
          type="range"
          name="repetition"
          min="1"
          max="100"
          value={formData.repetition}
          onChange={(e) => updateFormData(e.target.name, e.target.value)}
          className="w-full"
        />
        <input
          type="number"
          value={formData.repetition}
          name="repetition"
          readOnly
          onFocus={(e) =>
            showKeyboard(e, (newValue) =>
              newValue > 0 && newValue <= 100
                ? updateFormData(e.target.name, newValue)
                : null
            )
          }
          className="w-16 border border-gray-300 rounded p-1"
        />
      </div>
    </div>
  );
}
