import React from "react";

export default function CirclePB({
  //circle progress bar
  radius,
  progress,
  color = "lightblue",
  width = 200,
}) {
  let length = 2 * Math.PI * radius;
  return (
    <div>
      <svg width="300" height="300" viewBox="0 0 200 200">
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={15}
          strokeLinecap="round"
          style={{
            strokeDasharray: length,
            strokeDashoffset: length - (progress / 100) * length,
          }}
        />
      </svg>
    </div> //circle progress bar
  );
}
