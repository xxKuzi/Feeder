import React, { useEffect, useState } from "react";
import { useData } from "../parts/Memory";
import { useLocation, useNavigate } from "react-router-dom";
import FieldSimulation from "../components/FieldSimulation"; // Import the separated field logic

const MOTOR_DEGREES_PER_SECOND = 15;

const getRequiredIntervalSeconds = (fromAngle, toAngle) =>
  Math.max(
    1,
    Math.ceil(
      Math.abs(Number(toAngle) - Number(fromAngle)) / MOTOR_DEGREES_PER_SECOND,
    ),
  );

const getIntervalRequirements = (angles = []) => {
  if (!Array.isArray(angles) || angles.length === 0) {
    return [];
  }

  return angles.map((angle, index) => {
    const nextAngle = angles[(index + 1) % angles.length];
    return getRequiredIntervalSeconds(angle, nextAngle);
  });
};

export default function ModeSettings() {
  const { createMode, updateMode, showKeyboard } = useData();
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    category: 1,
    predefined: false,
    repetition: 10,
    intervals: [5],
    angles: [30, 170, 90],
    distances: [3000, 6000, 5000],
  });
  const [points, setPoints] = useState([]);

  const defaultLabels = {
    category: [
      { index: 1, label: "Střely za 2 body" },
      { index: 2, label: "Střely za 3 body" },
      { index: 3, label: "Trestné hody" },
    ],
    repetition: [5, 10, 15, 20, 30],
    intervals: [2, 3, 5, 8, 10],
  };

  const location = useLocation();
  const [previousData, setPreviousData] = useState(
    location.state ? location.state.data : null
  );

  useEffect(() => {
    console.log("DATA ", previousData);
    if (previousData !== null) {
      setFormData(previousData);
    }
  }, []);

  const [customInterval, setCustomInterval] = useState(false);
  const navigate = useNavigate();
  const intervalRequirements = getIntervalRequirements(formData.angles);
  const singleIntervalRequirement =
    intervalRequirements.length > 0 ? Math.max(...intervalRequirements) : 1;
  const currentIntervals = customInterval
    ? formData.intervals.slice(0, intervalRequirements.length)
    : [formData.intervals[0]];
  const areIntervalsValid = customInterval
    ? intervalRequirements.every(
        (required, index) => Number(currentIntervals[index] ?? 0) >= required,
      ) && currentIntervals.length === intervalRequirements.length
    : Number(currentIntervals[0] ?? 0) >= singleIntervalRequirement;
  const firstInvalidIntervalIndex = customInterval
    ? intervalRequirements.findIndex(
        (required, index) => Number(currentIntervals[index] ?? 0) < required,
      )
    : Number(currentIntervals[0] ?? 0) < singleIntervalRequirement
      ? 0
      : -1;

  const getIntervalMinimum = (index) =>
    customInterval ? intervalRequirements[index] ?? 1 : singleIntervalRequirement;

  const handleCategoryChange = (indexValue) => {
    setFormData((prev) => ({
      ...prev,
      category: indexValue,
    }));
  };

  const handlePredefinedToggle = () => {
    setFormData((prev) => ({
      ...prev,
      predefined: !prev.predefined,
    }));
  };

  const handleRepetitionChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      repetition: value,
    }));
  };

  const handleIntervalChange = (index, value) => {
    setFormData((prev) => {
      const updatedInterval = [...prev.intervals];
      updatedInterval[index] = value;
      return {
        ...prev,
        intervals: updatedInterval,
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!areIntervalsValid) {
      return;
    }

    const finalData = {
      ...formData,
      interval: customInterval ? formData.intervals : formData.intervals[0],
    };
    console.log("FINAL DATA ", finalData);
    previousData === null ? createMode(finalData) : updateMode(finalData);
  };

  return (
    <div className="flex flex-col items-center py-8">
      <h1 className="text-2xl font-bold mb-6">
        {previousData === null ? "Přidat nový mode" : "Upravit mode"}
      </h1>

      <div className="h-full w-full bg-white shadow-md rounded-lg p-6 space-y-4">
        {/* Name Field */}
        <div className="form-group flex flex-col">
          <label className="text-sm font-medium text-gray-700">Jméno</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onFocus={(e) => {
              showKeyboard(e, (newValue) =>
                setFormData((prev) => ({
                  ...prev,
                  name: newValue,
                }))
              );
            }}
            readOnly
            className="border border-gray-300 rounded p-2"
          />
        </div>

        {/* Category */}
        <div className="form-group flex flex-col mt-4">
          <label className="text-sm font-medium text-gray-700">Categorie</label>
          <div className="flex space-x-4 mt-2">
            {defaultLabels.category.map(({ index, label }) => (
              <button
                key={index}
                type="button"
                onClick={() => handleCategoryChange(index)}
                className={`px-4 py-2 rounded ${
                  formData.category === index
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Field Simulation (Separated) */}
        <div className="flex flex-col items-start justify-center mt-4">
          <label className="text-sm mb-1 font-medium text-gray-700">
            Místa střelby
          </label>
          <FieldSimulation
            formData={formData}
            setFormData={setFormData}
            previousData={previousData}
            points={points}
            setPoints={setPoints}
          />
        </div>

        {/* Repetition */}
        <div className="form-group flex flex-col mt-4">
          <label className="text-sm font-medium text-gray-700">Počet kol</label>
          <div className="flex space-x-4 mt-2">
            {defaultLabels.repetition.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleRepetitionChange(value)}
                className={`px-4 py-2 rounded ${
                  formData.repetition === value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {value}
              </button>
            ))}
            <input
              type="number"
              min="1"
              value={formData.repetition}
              onFocus={(e) =>
                showKeyboard(e, (newValue) =>
                  handleRepetitionChange(Number(newValue))
                )
              }
              readOnly
              className="border border-gray-300 rounded p-2 w-20"
            />
          </div>
        </div>

        {/* Interval Selection */}
        <div className="form-group flex flex-col">
          <div className="flex items-center justify-between text-center">
            <label className="text-sm font-medium text-gray-700">
              Interval mezi střelami (s)
            </label>
            <button
              className={
                "text-blue-600 text-end mt-2 px-2 py-1 rounded-lg duration-300 " +
                (customInterval ? "text-white bg-blue-600" : "text-blue-600")
              }
              onClick={() => setCustomInterval((prev) => !prev)}
            >
              Custom
            </button>
          </div>
          <div className="flex space-x-4 mt-2">
            {defaultLabels.intervals.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleIntervalChange(0, value)}
                disabled={value < getIntervalMinimum(0)}
                className={`px-4 py-2 rounded ${
                  value < getIntervalMinimum(0)
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : formData.intervals[0] === value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {value}
              </button>
            ))}
            <input
              type="number"
              min={getIntervalMinimum(0)}
              value={formData.intervals[0]}
              onFocus={(e) =>
                showKeyboard(e, (newValue) =>
                  handleIntervalChange(
                    0,
                    Math.max(Number(newValue), getIntervalMinimum(0)),
                  )
                )
              }
              onChange={() => {}}
              className="border border-gray-300 rounded p-2 w-20"
            />
          </div>

          <div>
            {points.slice(0, points.length - 1).map((_, i) => (
              <div
                key={i}
                className={`flex space-x-4 mt-2 transform transition-all duration-500 ease-out ${
                  customInterval
                    ? "translate-y-0 opacity-100 max-h-screen "
                    : "-translate-y-full opacity-0 max-h-0"
                }`}
                style={{ overflow: "hidden" }}
              >
                {defaultLabels.intervals.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleIntervalChange(i + 1, value)}
                    disabled={value < getIntervalMinimum(i + 1)}
                    className={`px-4 py-2 rounded transition-opacity duration-00 ease-out ${
                      value < getIntervalMinimum(i + 1)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : formData.intervals[i + 1] === value
                        ? "bg-blue-600 text-white" // Delay on active button
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <input
                  type="number"
                  min={getIntervalMinimum(i + 1)}
                  step={1}
                  value={formData.intervals[i + 1] || ""}
                  onFocus={(e) =>
                    showKeyboard(e, () =>
                      handleIntervalChange(
                        i + 1,
                        Math.max(
                          Number(e.target.value),
                          getIntervalMinimum(i + 1),
                        ),
                      )
                    )
                  }
                  onChange={() => {}}
                  className="border border-gray-300 rounded p-2 w-20 transition-transform duration-500 ease-out delay-300" // Delay only for the input
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:ring focus:ring-blue-300"
          onClick={handleSubmit}
          disabled={!areIntervalsValid}
        >
          {previousData === null ? "Vytvořit mode" : "Upravit mode"}
        </button>
        {!areIntervalsValid && (
          <p className="text-sm text-red-600">
            Interval je moc krátký. Při 15°/s potřebujete alespoň {customInterval
              ? getIntervalMinimum(firstInvalidIntervalIndex >= 0 ? firstInvalidIntervalIndex : 0)
              : singleIntervalRequirement
            } s.
          </p>
        )}
      </div>
    </div>
  );
}
