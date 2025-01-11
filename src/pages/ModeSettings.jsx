import React, { useState } from "react";

export default function ModeSettings({ onAddMode }) {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    time: "",
    motorSpeed: "",
    points: [], // Stores both angles and distances
    interval: "",
    predefined: "",
    difficulty: "medium", // Default value
  });

  const [points, setPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);

  const handleCircleClick = (e) => {
    if (points.length < 3) {
      const rect = e.target.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const radius = rect.width / 2;

      // Ensure click is in the top half
      if (y <= radius) {
        const angle = calculateAngle(x, y, radius);
        const distance = calculateDistance(x, y, radius);

        setPoints((prev) => [...prev, { x, y, angle, distance }]);
        updateFormData([...points, { angle, distance }]);
      }
    }
  };

  const calculateAngle = (x, y, radius) => {
    const angle = Math.atan2(y - radius, x - radius) * (180 / Math.PI);
    return angle < 0 ? 360 + angle : angle; // Normalize to 0-360
  };

  const calculateDistance = (x, y, radius) => {
    return Math.sqrt((x - radius) ** 2 + (y - radius) ** 2).toFixed(2);
  };

  const updateFormData = (updatedPoints) => {
    setFormData((prev) => ({
      ...prev,
      points: updatedPoints.map(({ angle, distance }) => ({ angle, distance })),
    }));
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
      const angle = calculateAngle(x, y, radius);
      const distance = calculateDistance(x, y, radius);

      setPoints((prev) => {
        const updated = [...prev];
        updated[dragIndex] = { x, y, angle, distance };
        updateFormData(updated);
        return updated;
      });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleDistanceChange = (index, newDistance) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index].distance = newDistance;

      // Recalculate x, y based on distance and angle
      const { angle } = updated[index];
      const radius = 128; // Half the width of the circle (assumed fixed)
      const radianAngle = (angle * Math.PI) / 180;
      updated[index].x = radius + newDistance * Math.cos(radianAngle);
      updated[index].y = radius + newDistance * Math.sin(radianAngle);

      updateFormData(updated);
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onAddMode) {
      onAddMode(formData);
    }
    console.log("New Mode Data:", formData);
  };

  return (
    <div className="add-mode-page flex flex-col items-center py-8">
      <h1 className="text-2xl font-bold mb-6">Přidat nový mode</h1>
      <form
        onSubmit={handleSubmit}
        className="add-mode-form w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4"
      >
        {Object.keys(formData)
          .filter((key) => key !== "points" && key !== "difficulty")
          .map((key) => (
            <div key={key} className="form-group flex flex-col">
              <p className="text-sm font-medium text-gray-700 capitalize">
                {key}
              </p>
              <input
                type="text"
                id={key}
                name={key}
                placeholder={`Enter ${key}`}
                value={formData[key]}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    [e.target.name]: e.target.value,
                  }))
                }
                required
                aria-label={key}
                className="mt-1 p-2 border border-gray-300 rounded focus:ring focus:ring-indigo-200"
              />
            </div>
          ))}

        {/* Circle Component */}
        <div
          className="circle relative w-64 h-32 bg-gray-200 rounded-t-full overflow-hidden"
          onClick={handleCircleClick}
          onMouseMove={handleDrag}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div className="absolute inset-0 rounded-t-full bg-gradient-to-b from-indigo-500 to-indigo-700" />
          {points.map((point, index) => (
            <div
              key={index}
              className="absolute bg-red-500 w-4 h-4 rounded-full cursor-pointer"
              style={{
                left: `${point.x}px`,
                top: `${point.y}px`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={() => handleDragStart(index)}
            />
          ))}
        </div>

        {/* Points and Distances */}
        <div className="space-y-2">
          {points.map((point, index) => (
            <div key={index} className="flex items-center space-x-4">
              <p className="text-sm font-medium text-gray-700">
                Angle: {point.angle.toFixed(2)}°, Distance:
              </p>
              <input
                type="number"
                value={point.distance}
                min="0"
                max="128"
                step="1"
                onChange={(e) =>
                  handleDistanceChange(index, parseFloat(e.target.value))
                }
                className="w-16 border border-gray-300 rounded p-1"
              />
            </div>
          ))}
        </div>

        {/* Difficulty Input */}
        <div className="difficulty-input">
          <p className="text-sm font-medium text-gray-700">Difficulty</p>
          <div className="flex items-center space-x-4 mt-2">
            {["small", "medium", "hard"].map((level) => (
              <label
                key={level}
                className="flex items-center space-x-2 text-gray-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name="difficulty"
                  value={level}
                  checked={formData.difficulty === level}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      difficulty: e.target.value,
                    }))
                  }
                  className="focus:ring-indigo-500"
                />
                <span className="capitalize">{level}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 focus:ring focus:ring-indigo-300"
        >
          Create Mode
        </button>
      </form>
    </div>
  );
}
