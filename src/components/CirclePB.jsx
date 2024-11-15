import React, { useEffect } from "react";

export default function CirclePB({
  //circle progress bar
  radius,
  progress,
  stroke,
  color = "lightblue",
  width = 200,
  children,
}) {
  let length = 2 * Math.PI * radius;

  return (
    <div className="duration-300 transition">
      <svg width="300" height="300" viewBox="0 0 200 200">
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{
            strokeDasharray: length,
            strokeDashoffset: length - progress * length,
            transition: "stroke-dashoffset 0.3s ease-in-out",
            transitionDelay: "300ms",
          }}
        />
        <text x="50%" y="50%" textAnchor="middle" dy={"0.3em"}></text>
        {children && (
          <foreignObject
            //x="50%"
            //y="50%"
            width={width}
            height={width}
            //textAnchor="middle"
            style={{ pointerEvents: "none" }} // Ensure children don't block interactions
          >
            {children}
          </foreignObject>
        )}
      </svg>
    </div> //circle progress bar
  );
}
