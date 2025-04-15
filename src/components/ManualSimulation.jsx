import React, { useState, useEffect } from "react";
import { useData } from "../parts/Memory";
import { show } from "@tauri-apps/api/app";

export default function ManualSimulation({ formData, setFormData }) {
  const { showKeyboard, globalAngle } = useData();
  const [point, setPoint] = useState({});
  const MM_PER_PIXEL = (6.75 / 180) * 1000; // Scale factor
  const [dragIndex, setDragIndex] = useState(null); //for ability to lay down the point

  // useEffect(() => {
  //   console.log("new point: ", point);
  // }, [point]);

  useEffect(() => {
    // setFormData((prev) => ({ ...prev, angle: globalAngle }));
    console.log("setting new angle: ", globalAngle);
    const radius = 180; // Half of 360px width

    const distanceMM = formData.distance; // Distance is stored in mm
    const distancePx = distanceMM / MM_PER_PIXEL; // Convert to pixels
    const radianAngle = (globalAngle * Math.PI) / 180; // Convert angle to radians

    // Convert to (x, y) based on the center of the semi-circle
    const x = radius + distancePx * Math.cos(radianAngle);
    const y = distancePx * Math.sin(radianAngle);

    const tempPoint = { x, y, angle: globalAngle, distance: distanceMM }; // Keep distance in mm
    console.log("tempPoint: ", tempPoint);
    setPoint(tempPoint);
  }, []);

  const handleDragStart = (index) => {
    setDragIndex(index);
  };
  const handleDrag = (e) => {
    if (dragIndex === null) {
      return;
    }

    const circle = e.target.closest(".circle");
    const rect = circle.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (y >= 0 && y <= radius) {
      let rawAngle = calculateAngle(x - radius, y, radius);
      let angle = Math.min(Math.max(rawAngle, 2), 178); // Clamp to 2–178
      let distancePx = calculateDistance(x, y, radius);
      let distanceMeters = distancePx * MM_PER_PIXEL;

      if (distanceMeters > 6750) {
        // Clamp distance to 6750
        distanceMeters = 6750;

        const clampedDistancePx = distanceMeters / MM_PER_PIXEL;
        const radianAngle = (angle * Math.PI) / 180;

        x = radius + clampedDistancePx * Math.cos(radianAngle);
        y = clampedDistancePx * Math.sin(radianAngle);
      }

      setPoint({ x, y, angle, distance: distanceMeters });
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handlePointChange = (key, value) => {
    setPoint((prev) => {
      const updated = { ...prev };

      updated[key] = Number(value);

      // Convert distance to pixels
      const radius = 180;
      const scaledDistance = updated.distance / MM_PER_PIXEL;
      const radianAngle = (updated.angle * Math.PI) / 180;

      updated.x = radius + scaledDistance * Math.cos(radianAngle);
      updated.y = scaledDistance * Math.sin(radianAngle);
      console.log(updated);
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
    const angle = point.angle;
    const distance = point.distance;
    console.log("angle: ", point.angle);
    setFormData((prev) => ({ ...prev, angle, distance }));
  }, [point]); // Runs whenever point change

  return (
    <div className="flex items-center mt-10 flex-col justify-center relative">
      <div
        className="circle relative w-[360px] h-[180px] bg-gray-200 rounded-b-full"
        onMouseMove={handleDrag}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="absolute inset-0 rounded-b-full bg-gradient-to-t from-blue-500 to-blue-700" />

        <div
          className="absolute bg-red-500 w-8 h-8 rounded-full flex justify-center items-center cursor-pointer"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            transform: "translate(-50%, -50%)",
          }}
          onMouseDown={() => handleDragStart(1)}
        >
          <p className="text-white select-none">1</p>
        </div>
      </div>

      <div className="space-y-2 mt-8">
        <div className="flex items-center justify-center gap-8">
          <div className="flex flex-col items-center justify-center">
            <label className="text-md font-medium text-gray-700">Úhel:</label>
            <div className="flex items-center justify-center gap-4">
              <input
                type="range"
                min="2"
                max="178"
                value={point.angle}
                onChange={(e) => handlePointChange("angle", e.target.value)}
                className="w-full"
              />
              <input
                type="number"
                value={point.angle}
                readOnly
                onFocus={(e) =>
                  showKeyboard(e, (newValue) =>
                    newValue <= 178 && newValue >= 2
                      ? handlePointChange("angle", newValue)
                      : null
                  )
                }
                className="w-16 border border-gray-300 rounded p-1"
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <label className="text-md font-medium text-gray-700">
              Vzdálenost:
            </label>
            <div className="flex items-center justify-center gap-4">
              <input
                type="range"
                min="0"
                max="6750"
                value={point.distance}
                onChange={(e) => handlePointChange("distance", e.target.value)}
                className="w-full"
              />
              <input
                type="number"
                value={Math.round(point.distance)}
                readOnly
                onFocus={(e) =>
                  showKeyboard(e, (newValue) =>
                    newValue <= 6750 && newValue >= 0
                      ? handlePointChange("distance", newValue)
                      : null
                  )
                }
                className="w-16 border border-gray-300 rounded p-1"
              />
            </div>
          </div>
        </div>
        <button
          className="duration-300 absolute bottom-20 -right-8 border-2 hover:border-sky-400 rounded-lg px-3 py-1"
          onClick={() => {
            handlePointChange("angle", 90);
            handlePointChange("distance", 3700);
          }}
        >
          Trestné hody
        </button>
      </div>
    </div>
  );
}
