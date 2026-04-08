import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  Card,
  clamp,
  formatTime,
  getCycleState,
  getModeId,
  sumIntervals,
} from "./shared";

export function PocketControlTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    role,
    modeList,
    selectedMode,
    snapshot,
    workoutStateAt,
    activeModeId,
    setActiveModeId,
    loadModes,
    saveSelectedMode,
    doPause,
    doExit,
    doStart,
  } = useMonitor();
  const basePath = role === "developer" ? "/dev" : "/user";
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const mode = selectedMode || modeList[0] || null;
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
  const handleGreenAction = () => {
    if (resumeModeId > 0) {
      doStart(resumeModeId);
    }
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-slate-300 bg-gray-200 p-4 shadow-sm">
        <div className="mb-4 mt-2 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card title={t("shotsTaken")} value={estimatedAttempts} />
          <Card title={t("shotsMade")} value={made} tone="green" />
          <Card title={t("successRatio")} value={`${successRate}%`} />
          <Card
            title={t("workoutTime")}
            value={formatTime(now - (workoutStateAt || now))}
          />
        </div>

        <div
          className={`mb-4 mt-8 rounded-xl border-2 p-4 shadow-sm ${isRunning ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}
        >
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-slate-700">
            {t("workoutState")}
          </p>
          <div
            className={`mt-3 w-full rounded-xl px-4 py-4 text-center ${isRunning ? "bg-green-600" : "bg-red-600"}`}
            role="status"
            aria-live="polite"
          >
            <p className="m-0 text-3xl font-extrabold uppercase tracking-wide text-white sm:text-4xl">
              {isRunning ? t("running") : t("paused")}
            </p>
          </div>
          <p className="m-0 mt-3 text-sm font-semibold text-slate-700">
            {isRunning ? t("workoutRunning") : t("workoutPaused")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
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

      <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("modeActions")}
            </p>
            <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
              {t("keepItSimple")}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-slate-900 bg-white px-4 py-2 font-semibold text-slate-900 shadow-sm"
              onClick={doExit}
            >
              {t("endMode")}
            </button>
            <button
              className="rounded-xl border border-blue-700 bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm"
              onClick={handleGreenAction}
              disabled={!resumeModeId}
            >
              {t("startMode")}{" "}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("selectedWorkout")}
            </p>
            <p className="m-0 text-sm text-slate-600">
              {selectedMode?.name || t("noModeSelected")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={saveSelectedMode}
            >
              {t("saveSelectedMode")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadModes}
            >
              {t("refreshModes")}
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label
            htmlFor="mode-select"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            {t("selectedWorkout")}
          </label>
          <select
            id="mode-select"
            className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-4 py-3"
            value={activeModeId}
            onChange={(e) => setActiveModeId(Number(e.target.value))}
          >
            {modeList.map((modeItem) => {
              const id = getModeId(modeItem);
              return (
                <option key={id} value={id}>
                  {id} · {modeItem.name}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modeList.map((modeItem) => {
            const id = getModeId(modeItem);
            const active = Number(activeModeId) === Number(id);
            return (
              <article
                key={id}
                className={`rounded-2xl border p-4 shadow-sm transition ${active ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col items-start text-left"
                    onClick={() => setActiveModeId(Number(id))}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        #{id}
                      </span>
                      {active && (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                          {t("selectedMode")}
                        </span>
                      )}
                    </div>
                    <strong className="mt-2 block truncate text-lg text-slate-900">
                      {modeItem.name}
                    </strong>
                    <small className="mt-1 block text-sm text-slate-600">
                      {t("rounds", { count: modeItem.repetition || 1 })} ·{" "}
                      {Array.isArray(modeItem.intervals)
                        ? modeItem.intervals.length
                        : 1}{" "}
                      {t("shotsLabel")}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => navigate(`${basePath}/control/edit/${id}`)}
                  >
                    {t("editMode")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
