import React, { useState, useEffect } from "react";
import { useData } from "../parts/Memory";
import { show } from "@tauri-apps/api/app";

export default function ManualSimulation({
  formData,
  setFormData,
  previousData, //previousData (not null) - edit mode (otherwise new mode) - only for loading previous value on beginning
}) {
  const { showKeyboard } = useData();
  const [points, setPoints] = useState([]);
  const [dragIndex, setDragIndex] = useState(null);
  const MAX_POINTS = 5;

  useEffect(() => {
    console.log(points);
  });

  useEffect(() => {
    if (previousData !== null && previousData) {
      const radius = 180; // Half of 360px width
      let tempPoints = previousData.angles.map((angle, i) => {
        const distanceMM = previousData.distances[i]; // Distance is stored in mm
        const distancePx = distanceMM / MM_PER_PIXEL; // Convert to pixels
        const radianAngle = (angle * Math.PI) / 180; // Convert angle to radians

        // Convert to (x, y) based on the center of the semi-circle
        const x = radius + distancePx * Math.cos(radianAngle);
        const y = distancePx * Math.sin(radianAngle);

        return { x, y, angle, distance: distanceMM }; // Keep distance in mm
      });
      setPoints(tempPoints);
    }
  }, []);

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
      let angle = calculateAngle(x - radius, y, radius);
      let distancePx = calculateDistance(x, y, radius);

      let distanceMeters = distancePx * MM_PER_PIXEL; // Convert to meters
      if (distanceMeters > 6750) {
        console.log("distanceMeters ", distanceMeters);
        return;
      } // Prevent going beyond max distance

      setPoints((prev) => {
        const updated = [...prev];
        updated[dragIndex] = { x, y, angle, distance: distanceMeters };
        return updated;
      });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const MM_PER_PIXEL = (6.75 / 180) * 1000; // Scale factor

  const handlePointChange = (index, key, value) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index][key] = Number(value);

      // Convert distance to pixels
      const radius = 180;
      const scaledDistance = updated[index].distance / MM_PER_PIXEL;
      const radianAngle = (updated[index].angle * Math.PI) / 180;

      updated[index].x = radius + scaledDistance * Math.cos(radianAngle);
      updated[index].y = scaledDistance * Math.sin(radianAngle);

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
  }, [points]); // Runs whenever points change

  return (
    <div className="flex items-center relative flex-col justify-center">
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

      <div className="space-y-2 mt-8">
        {points.map((point, index) => (
          <div key={index} className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Úhel:</label>
            <input
              type="number"
              value={point.angle}
              readOnly
              onFocus={(e) =>
                showKeyboard(e, (newValue) =>
                  newValue <= 180 && newValue >= 0
                    ? handlePointChange(index, "angle", newValue)
                    : null
                )
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
                showKeyboard(e, (newValue) =>
                  newValue <= 6750 && newValue >= 0
                    ? handlePointChange(index, "distance", newValue)
                    : null
                )
              }
              className="w-16 border border-gray-300 rounded p-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
