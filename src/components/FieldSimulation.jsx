import React, { useState, useEffect } from "react";
import { useData } from "../parts/Memory";
import { show } from "@tauri-apps/api/app";

export default function FieldSimulation({
  formData,
  setFormData,
  previousData, //previousData (not null) - edit mode (otherwise new mode) - only for loading previous value on beginning
}) {
  const { showKeyboard } = useData();
  const [points, setPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const MAX_POINTS = 5;

  useEffect(() => {
    if (previousData !== null && previousData) {
      console.log("PREVIOUS DATA: ", previousData);
      let tempPoints = [];
      previousData.angles.map((_, i) => {
        tempPoints.push({
          angle: previousData.angles[i],
          distance: previousData.distances[i],
        });
      });
      console.log("TEMP POINTS: ", tempPoints);
      setPoints(tempPoints);
    }
  }, [previousData]);

  const addPoint = () => {
    if (points.length >= MAX_POINTS) return;
    const radius = 180;
    const centerX = radius;
    const centerY = 0; // Move the center to the bottom part of the container
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

    if (y >= 0 && y <= radius) {
      // Ensure dragging stays within the lower semi-circle
      let angle = calculateAngle(x - radius, y, radius);
      const distance = Math.round(calculateDistance(x, y, radius));

      if (distance > radius) return; // Prevents dragging outside the semi-circle

      setPoints((prev) => {
        const updated = [...prev];
        updated[dragIndex] = { x, y, angle, distance };
        return updated;
      });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handlePointChange = (index, key, value) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index][key] = Number(value);

      // Recalculate position based on the new angle and distance
      const radius = 180;
      const radianAngle = (updated[index].angle * Math.PI) / 180; // Adjusted for bottom curve
      updated[index].x =
        radius + updated[index].distance * Math.cos(radianAngle);
      updated[index].y = updated[index].distance * Math.sin(radianAngle);

      return updated;
    });
  };

  const calculateAngle = (x, y, radius) => {
    let angle = Math.atan2(y, x) * (180 / Math.PI); // Convert to degrees
    if (angle < 0) angle += 180; // Ensure angle remains within 0 - 180 range
    return Math.round(angle);
  };

  const calculateDistance = (x, y, radius) => {
    return Math.sqrt((x - radius) ** 2 + y ** 2).toFixed(2);
  };

  useEffect(() => {
    const angles = points.map((point) => point.angle);
    const distances = points.map((point) => point.distance);
    setFormData((prev) => ({ ...prev, angles, distances }));
  }, [points, setFormData]); // Runs whenever points change

  return (
    <div className="flex items-center relative justify-center">
      <div
        className="circle relative w-[360px] h-[180px] bg-gray-200 rounded-b-full"
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="absolute inset-0 rounded-b-full bg-gradient-to-t from-blue-500 to-blue-700" />
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
              readOnly
              onFocus={(e) =>
                showKeyboard(e, (newValue) => (e.target.value = newValue))
              }
              className="w-16 border border-gray-300 rounded p-1"
            />
            <label className="text-sm font-medium text-gray-700">
              Vzdálenost:
            </label>
            <input
              type="number"
              value={point.distance}
              readOnly
              onFocus={(e) =>
                showKeyboard(e, (newValue) => (e.target.value = newValue))
              }
              className="w-16 border border-gray-300 rounded p-1"
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
