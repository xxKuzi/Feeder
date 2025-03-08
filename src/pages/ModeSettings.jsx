import React, { useEffect, useState, useRef } from "react";
import { useData } from "../parts/Memory";
import { useLocation, useNavigate } from "react-router-dom";

export default function ModeSettings({ onAddMode }) {
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

  const defaultLabels = {
    category: [
      { index: 1, label: "Two-point" },
      { index: 2, label: "Three-point" },
      { index: 3, label: "Free-throws" },
    ],
    repetition: [5, 10, 15, 20, 30],
    intervals: [2, 3, 5, 8, 10],
  };

  const location = useLocation();
  const previousData = location.state ? location.state.data : null;

  useEffect(() => {
    console.log("DATA ", previousData);
    if (previousData !== null) {
      setFormData(previousData);
    }
  }, []);

  const [customInterval, setCustomInterval] = useState(false);
  const navigate = useNavigate();

  const [points, setPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);

  const MAX_POINTS = 5;

  //#region POINTS MANAGEMENT
  const addPoint = () => {
    if (points.length >= MAX_POINTS) return;

    const radius = 180; // Half the width of the circle (fixed)
    const centerX = radius; // Center of the semi-circle
    const centerY = radius; // Top center

    setPoints((prev) => [
      ...prev,
      { x: centerX, y: centerY, angle: 90, distance: 0 },
    ]);
  };

  const removePoint = (index) => {
    setPoints((prev) => {
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDrag = (e) => {
    if (dragIndex === null) return;

    const circle = e.target.closest(".circle");
    const rect = circle.getBoundingClientRect();
    const radius = rect.width / 2;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y <= radius) {
      const angle = Math.round(calculateAngle(-x, -y, -radius));
      const distance = Math.round(calculateDistance(x, y, radius));

      if (distance > 240) {
        return;
      }
      setPoints((prev) => {
        const updated = [...prev];
        updated[dragIndex] = { x, y, angle, distance };
        updateFormData(updated);
        return updated;
      });
    }
  };

  const handlePointChange = (index, key, value) => {
    setPoints((prev) => {
      const updated = [...prev];
      const point = updated[index];
      point[key] = value;

      // Recalculate position based on the new angle and distance
      const radius = 180; // Assume a fixed radius for the semi-circle
      const radianAngle = (point.angle * Math.PI) / 180; // Convert angle to radians
      point.x = radius + point.distance * Math.cos(radianAngle); // Calculate new x
      point.y = radius + point.distance * Math.sin(radianAngle); // Calculate new y

      updateFormData(updated); // Sync with schema
      return updated;
    });
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const calculateAngle = (x, y, radius) => {
    const angle = Math.atan2(y - radius, x - radius) * (180 / Math.PI);
    return angle < 0 ? 360 + angle : angle;
  };

  const calculateDistance = (x, y, radius) => {
    return Math.sqrt((x - radius) ** 2 + (y - radius) ** 2).toFixed(2);
  };

  const updateFormData = (updatedPoints) => {
    const angles = updatedPoints.map((point) => point.angle);
    const distances = updatedPoints.map((point) => point.distance);
    setFormData((prev) => ({ ...prev, angles, distances }));
  };

  //#endregion

  //#region UPDATE FORM DATA
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
  //#endregion

  const handleSubmit = (e) => {
    e.preventDefault();
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
          <label className="text-sm font-medium text-gray-700">Name</label>
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
            onChange={() => {}}
            className="border border-gray-300 rounded p-2"
          />
        </div>
        {/* Category */}
        <div className="form-group flex flex-col mt-4">
          <label className="text-sm font-medium text-gray-700">Category</label>
          <div className="flex space-x-4 mt-2">
            {defaultLabels.category.map(({ index, label }) => (
              <button
                key={index}
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, category: index }))
                }
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
        {/* Predefined
        <div className="form-group flex flex-col mt-4">
          <label className="text-sm font-medium text-gray-700">
            Predefined
          </label>
          <button
            type="button"
            onClick={handlePredefinedToggle}
            className={`px-4 py-2 mt-2 rounded w-full ${
              formData.predefined
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {formData.predefined ? "Yes" : "No"}
          </button>
        </div> */}

        <label className="text-sm mt-8 font-medium text-gray-700">Points</label>
        <div className="flex items-center relative justify-center">
          {/* Semi-Circle */}

          <div
            className="circle relative w-[360px] h-[180px] bg-gray-200  rounded-t-full"
            onMouseMove={handleDrag}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <div className="absolute inset-0 rounded-t-full bg-gradient-to-b from-blue-500 to-blue-700" />
            {points.map((point, index) => (
              <div
                key={index}
                className="absolute bg-red-500 w-8 h-8 rounded-full flex justify-center items-center cursor-pointer"
                style={{
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseDown={() => handleDragStart(index)}
              >
                <p className="text-white select-none">{index + 1}</p>
              </div>
            ))}
          </div>
          {/* #region Hello */}
          {/* Points List */}
          <div className="space-y-2 ml-16">
            {points.map((point, index) => (
              <div key={index} className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">
                  Úhel:
                </label>
                <input
                  type="number"
                  value={point.angle}
                  onFocus={(e) =>
                    showKeyboard(e, (newValue) =>
                      handlePointChange(index, "angle", Number(newValue))
                    )
                  }
                  onChange={() => {}}
                  className="w-16 border border-gray-300 rounded p-1"
                />
                <label className="text-sm font-medium text-gray-700">
                  Vzdálenost:
                </label>
                <input
                  type="number"
                  value={point.distance}
                  onFocus={(e) =>
                    showKeyboard(e, (newValue) =>
                      handlePointChange(index, "distance", Number(newValue))
                    )
                  }
                  onChange={() => {}}
                  className="w-16 border border-gray-300 rounded p-1"
                />
                <button
                  type="button"
                  onClick={() => removePoint(index)}
                  className=" text-red-600 rounded hover:scale-110 w-full text-end duration-300 text-4xl"
                >
                  -
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPoint}
              className={`  w-full text-end duration-300 text-4xl ${
                points.length >= MAX_POINTS
                  ? "text-gray-600"
                  : "text-blue-600 rounded"
              }`}
              disabled={points.length >= MAX_POINTS}
            >
              +
            </button>
          </div>
          {/* #endregion */}
        </div>
        {/* Repetition */}
        <div className="form-group flex flex-col mt-4">
          <label className="text-sm font-medium text-gray-700">
            Repetition
          </label>
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
              onChange={() => {}}
              className="border border-gray-300 rounded p-2 w-20"
            />
          </div>
        </div>
        {/* Interval */}
        <div className="form-group flex flex-col">
          <div className="flex items-center justify-between text-center">
            <label className="text-sm font-medium text-gray-700">
              Interval
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
                className={`px-4 py-2 rounded ${
                  formData.intervals[0] === value
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
              value={formData.intervals[0]}
              onFocus={(e) =>
                showKeyboard(e, (newValue) =>
                  handleIntervalChange(0, Number(newValue))
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
                    className={`px-4 py-2 rounded transition-opacity duration-00 ease-out ${
                      formData.intervals[i + 1] === value
                        ? "bg-blue-600 text-white" // Delay on active button
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  step={1}
                  value={formData.intervals[i + 1] || ""}
                  onFocus={(e) =>
                    showKeyboard(e, () =>
                      handleIntervalChange(i + 1, Number(e.target.value))
                    )
                  }
                  onChange={() => {}}
                  className="border border-gray-300 rounded p-2 w-20 transition-transform duration-500 ease-out delay-300" // Delay only for the input
                />
              </div>
            ))}
          </div>
        </div>

        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 focus:ring focus:ring-blue-300"
          onClick={handleSubmit}
        >
          {previousData === null ? "Vytvořit mode" : "Upravit mode"}
        </button>
      </div>
    </div>
  );
}
