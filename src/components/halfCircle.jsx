import React, { useState } from "react";

export default function HalfCircle({ formData, setFormData }) {
  const [points, setPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const MAX_POINTS = 5;

  const addPoint = () => {
    if (points.length >= MAX_POINTS) return;
    const radius = 180;
    const centerX = radius;
    const centerY = radius;
    setPoints((prev) => [
      ...prev,
      { x: centerX, y: centerY, angle: 90, distance: 0 },
    ]);
  };

  const removePoint = (index) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
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

      if (distance > 240) return;
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

  return (
    <div className="flex items-center relative justify-center">
      <div
        className="circle relative w-[360px] h-[180px] bg-gray-200 rounded-t-full"
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

      <div className="space-y-2 ml-16">
        {points.map((point, index) => (
          <div key={index} className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Úhel:</label>
            <input
              type="number"
              value={point.angle}
              className="w-16 border border-gray-300 rounded p-1"
              onChange={() => {}}
            />
            <label className="text-sm font-medium text-gray-700">
              Vzdálenost:
            </label>
            <input
              type="number"
              value={point.distance}
              className="w-16 border border-gray-300 rounded p-1"
              onChange={() => {}}
            />
            <button
              type="button"
              onClick={() => removePoint(index)}
              className="text-red-600 rounded hover:scale-110 text-4xl"
            >
              -
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addPoint}
          className={`text-4xl ${
            points.length >= MAX_POINTS ? "text-gray-600" : "text-blue-600"
          }`}
          disabled={points.length >= MAX_POINTS}
        >
          +
        </button>
      </div>
    </div>
  );
}
