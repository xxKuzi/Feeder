import { useEffect, useMemo, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sumIntervals(intervals = []) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((sum, value) => sum + Number(value || 0), 0);
}

function getArcPoint(progress) {
  const angle = Math.PI * (1 - clamp(progress, 0, 1));
  const centerX = 100;
  const centerY = 96;
  const radius = 74;
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY - radius * Math.sin(angle),
  };
}

export default function HalfCourtGauge({ mode, startedAt, running, label }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(timer);
  }, []);

  const state = useMemo(() => {
    const intervals =
      Array.isArray(mode?.intervals) && mode.intervals.length > 0
        ? mode.intervals.map((value) => Number(value || 0))
        : [5];

    const cycleLength = Math.max(sumIntervals(intervals), 1);
    const elapsedSeconds = Math.max(0, (now - (startedAt || now)) / 1000);
    const cycleElapsed = elapsedSeconds % cycleLength;

    let cursor = 0;
    let index = 0;
    let interval = intervals[0] || 1;
    let intervalElapsed = 0;

    for (let i = 0; i < intervals.length; i += 1) {
      const next = cursor + intervals[i];
      if (cycleElapsed <= next || i === intervals.length - 1) {
        index = i;
        interval = intervals[i] || 1;
        intervalElapsed = cycleElapsed - cursor;
        break;
      }
      cursor = next;
    }

    const intervalProgress = clamp(
      intervalElapsed / Math.max(interval, 1),
      0,
      1,
    );
    const cycleProgress = clamp(cycleElapsed / cycleLength, 0, 1);
    const point = getArcPoint(cycleProgress);
    return {
      intervalProgress,
      cycleProgress,
      point,
      cycleElapsed,
      cycleLength,
      interval,
      index,
      intervalRemaining: Math.max(interval - intervalElapsed, 0),
      pulse: running && intervalProgress > 0.88,
    };
  }, [mode, now, running, startedAt]);

  return (
    <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Release window
          </p>
          <h3 className="m-0 text-lg font-bold">{label}</h3>
        </div>
        <p className="text-sm text-slate-600">
          Shot {state.index + 1} · {Math.ceil(state.intervalRemaining)}s left
        </p>
      </div>

      <svg
        viewBox="0 0 200 120"
        className="block h-auto w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="gauge-gradient"
            x1="26"
            y1="96"
            x2="174"
            y2="96"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>
        <path
          d="M 26 96 A 74 74 0 0 1 174 96"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          stroke="rgba(18,32,51,0.12)"
        />
        <path
          d="M 26 96 A 74 74 0 0 1 174 96"
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          stroke="url(#gauge-gradient)"
          strokeDasharray={`${state.cycleProgress * 232} 232`}
        />
        <circle
          cx={state.point.x}
          cy={state.point.y}
          r="8"
          fill={running ? "#1d4ed8" : "#93c5fd"}
        />
        <line
          x1="100"
          y1="96"
          x2={state.point.x}
          y2={state.point.y}
          stroke="rgba(18,32,51,0.18)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      <div className="mt-2 flex justify-between gap-3 text-sm font-semibold text-slate-500">
        <span>Angle: {Math.round(state.cycleProgress * 180)}°</span>
        <span>{running ? "Ball moving" : "Waiting"}</span>
      </div>
    </article>
  );
}
