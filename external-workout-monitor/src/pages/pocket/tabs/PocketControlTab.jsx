import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { Card, clamp, formatTime, getCycleState, sumIntervals } from "./shared";

export function PocketControlTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    selectedMode,
    snapshot,
    workoutStateAt,
    activeModeId,
    doPause,
    doExit,
    doStart,
  } = useMonitor();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const mode = selectedMode || null;
  const cycleState = getCycleState(mode, workoutStateAt || now, now);
  const made = Number(snapshot?.basketScore || 0);
  const intervals = Array.isArray(mode?.intervals) ? mode.intervals : [];
  const averageInterval = Math.max(
    sumIntervals(intervals) / Math.max(intervals.length, 1),
    1,
  );
  const plannedShots = Math.max(
    (mode?.repetition || 1) * Math.max(intervals.length, 1),
    1,
  );
  const estimatedAttempts = Math.max(
    1,
    Math.min(
      Math.ceil(cycleState.elapsedSeconds / averageInterval),
      plannedShots,
    ),
  );
  const successRate = clamp(
    Math.round((made / Math.max(estimatedAttempts, 1)) * 100),
    0,
    100,
  );
  const isRunning = snapshot?.workoutState === "running";
  const resumeModeId = Number(snapshot?.activeModeId || activeModeId || 0);
  const runningModeName = selectedMode?.name || t("noModeSelected");
  const handleGreenAction = () => {
    if (resumeModeId > 0) {
      doStart(resumeModeId);
    }
  };

  return (
    <div className="flex flex-col items-end h-fulxl align-bottom">
      <section className=" border-t-2 border-b-2 border-blue-300 p-4 bg-gray-200  w-full shadow-sm">
        <div className="flex mb-2 justify-end items-end w-full flex-wrap gap-2">
          <button
            className="rounded-xl border border-red-900 bg-white px-4 py-2 font-semibold text-red-900 shadow-sm"
            onClick={doExit}
          >
            {t("endMode")}
          </button>
        </div>
        <div
          className={`mb-4 rounded-xl border-2 p-4 shadow-sm ${isRunning ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
        >
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-slate-700">
            {t("workoutState")}
          </p>
          <h2 className="m-0 mt-2 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            {runningModeName}
          </h2>
          <div
            className={`mt-3 w-full rounded-xl px-4 py-4 text-center ${isRunning ? "bg-green-600" : "bg-red-600"}`}
            role="status"
            aria-live="polite"
          >
            <p className="m-0 text-3xl font-extrabold uppercase tracking-wide text-white sm:text-4xl">
              {isRunning ? t("running") : t("paused")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
          <Card title={t("shotsTaken")} value={estimatedAttempts} />
          <Card title={t("shotsMade")} value={made} tone="green" />
          <Card title={t("successRatio")} value={`${successRate}%`} />
          <Card
            title={t("workoutTime")}
            value={isRunning ? formatTime(now - (workoutStateAt || now)) : ""}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            className="min-h-16 rounded-xl border-2 border-orange-600 bg-red-600 px-6 py-4 text-lg font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-red-700"
            onClick={doPause}
          >
            {t("stopWorkout")}
          </button>
          <button
            className="min-h-16 rounded-xl border-2 border-green-600 bg-green-600 px-6 py-4 text-lg font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-green-700"
            onClick={handleGreenAction}
            disabled={!resumeModeId}
          >
            {t("startWorkout")}
          </button>
        </div>
      </section>
    </div>
  );
}
