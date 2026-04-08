import { useMonitor } from "../../../monitor/MonitorContext";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(ms) {
  if (!ms || ms < 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function sumIntervals(intervals = []) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((sum, value) => sum + Number(value || 0), 0);
}

export function getModeId(mode) {
  return Number(mode?.modeId ?? mode?.mode_id ?? 0);
}

export function getCycleState(mode, startedAt, now = Date.now()) {
  if (!mode || !Array.isArray(mode.intervals) || mode.intervals.length === 0) {
    return {
      progress: 0,
      intervalIndex: 0,
      intervalElapsed: 0,
      intervalRemaining: 0,
      cycleElapsed: 0,
      cycleLength: 1,
      elapsedSeconds: 0,
    };
  }

  const cycleLength = Math.max(sumIntervals(mode.intervals), 1);
  const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
  const cycleElapsed = elapsedSeconds % cycleLength;

  let cursor = 0;
  let intervalIndex = 0;
  let intervalElapsed = 0;
  let intervalRemaining = Number(mode.intervals[0] || 0);

  for (let index = 0; index < mode.intervals.length; index += 1) {
    const interval = Number(mode.intervals[index] || 0);
    const nextCursor = cursor + interval;
    if (cycleElapsed <= nextCursor || index === mode.intervals.length - 1) {
      intervalIndex = index;
      intervalElapsed = cycleElapsed - cursor;
      intervalRemaining = Math.max(interval - intervalElapsed, 0);
      break;
    }
    cursor = nextCursor;
  }

  const progress = clamp(cycleElapsed / cycleLength, 0, 1);

  return {
    progress,
    intervalIndex,
    intervalElapsed,
    intervalRemaining,
    cycleElapsed,
    cycleLength,
    elapsedSeconds,
  };
}

export function Card({ title, value, note, tone = "neutral" }) {
  const toneClass = {
    neutral: "border-slate-300 bg-white",
    gold: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
  };

  return (
    <article
      className={`rounded-xl border p-4 shadow-sm ${toneClass[tone] || toneClass.neutral}`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {note && <p className="text-sm text-slate-500">{note}</p>}
    </article>
  );
}

export function EventList() {
  const { events } = useMonitor();

  return (
    <div className="grid max-h-[56vh] gap-3 overflow-auto pr-1">
      {events.slice(0, 18).map((event, index) => (
        <article
          className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
          key={`${event.timestamp_ms || "na"}-${index}`}
        >
          <div className="mb-2 flex justify-between gap-3 text-sm font-semibold text-slate-700">
            <span>{event.event}</span>
            <span>
              {new Date(event.timestamp_ms || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <pre className="m-0 whitespace-pre-wrap break-words text-xs text-slate-600">
            {JSON.stringify(event.payload || {}, null, 2)}
          </pre>
        </article>
      ))}
    </div>
  );
}
