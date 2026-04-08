import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { Card, clamp, formatTime, getCycleState, sumIntervals } from "./shared";

const WORKOUT_STATE_PAUSE = 0;
const WORKOUT_STATE_RUNNING = 1;
const WORKOUT_STATE_BREAK = 2;

export function PocketControlTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    runningMode,
    snapshot,
    workoutStateAt,
    activeModeId,
    lastModeId,
    doPause,
    doExit,
    doStart,
  } = useMonitor();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const mode = runningMode || null;
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
  const workoutStateCode = Number(
    snapshot?.workoutState ?? WORKOUT_STATE_BREAK,
  );
  const currentModeId = Number(snapshot?.activeModeId || activeModeId || null);
  const isRunning = workoutStateCode === WORKOUT_STATE_RUNNING;
  const isPaused =
    workoutStateCode === WORKOUT_STATE_PAUSE && currentModeId > 0;
  const isBreak =
    workoutStateCode === WORKOUT_STATE_BREAK ||
    (workoutStateCode === WORKOUT_STATE_PAUSE && currentModeId === 0);
  const statusContainerClass = isRunning
    ? "border-green-300 bg-green-50"
    : isPaused
      ? "border-orange-300 bg-orange-50"
      : "border-slate-300 bg-slate-100";
  const statusBadgeClass =
    workoutStateCode == 1
      ? "bg-green-600"
      : workoutStateCode == 0
        ? "bg-orange-500"
        : "bg-slate-500";
  const statusLabel =
    workoutStateCode == 1
      ? t("running")
      : workoutStateCode == 0
        ? t("paused")
        : t("breakState");
  const resumeModeId = Number(
    snapshot?.activeModeId || activeModeId || lastModeId || 0,
  );
  const runningModeName = runningMode?.name || t("noModeSelected");
  const handleGreenAction = () => {
    doStart(resumeModeId);
  };

  const resumeButtonColor =
    workoutStateCode == 2 ? "bg-gray-300" : " border-green-600 bg-green-600";
  const pauseButtonColor =
    workoutStateCode == 2 ? "bg-gray-300" : "border-orange-600 bg-red-600";

  useEffect(() => {
    console.log("petr ", workoutStateCode != undefined ? workoutStateCode : "");
  }, [workoutStateCode]);

  return (
    <div className="flex flex-col items-end align-bottom">
      <section className=" border-t-2 border-b-2 border-blue-300 p-4 bg-gray-200  w-full shadow-sm">
        <div className="flex mb-2 justify-end items-end w-full flex-wrap gap-2">
          <button
            className="rounded-xl border border-red-900 bg-white px-4 py-2 font-semibold text-red-900 shadow-sm"
            onClick={workoutStateCode != 2 ? doExit : null}
          >
            {t("endMode")}
          </button>
        </div>
        <div
          className={`mb-4 rounded-xl border-2 p-4 shadow-sm ${statusContainerClass}`}
        >
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-slate-700">
            {t("workoutState")}
          </p>
          <h2 className="m-0 mt-2 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl">
            {workoutStateCode != 2 && runningModeName}
          </h2>
          <div
            className={`mt-3 w-full rounded-xl px-4 py-4 text-center ${statusBadgeClass}`}
            role="status"
            aria-live="polite"
          >
            <p className="m-0 text-3xl font-extrabold uppercase tracking-wide text-white sm:text-4xl">
              {statusLabel}
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
            className={`${pauseButtonColor} min-h-16 rounded-xl  px-6 py-4 text-lg border-2  font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-red-700"`}
            onClick={doPause}
            disabled={workoutStateCode === 2}
          >
            {t("stopWorkout")}
          </button>
          <button
            className={`${resumeButtonColor} min-h-16 rounded-xl border-2 px-6 py-4 text-lg font-extrabold uppercase tracking-wide text-white shadow-sm transition hover:bg-green-700"`}
            onClick={handleGreenAction}
            disabled={workoutStateCode === 2}
          >
            {t("startWorkout")}
          </button>
        </div>
      </section>
    </div>
  );
}
