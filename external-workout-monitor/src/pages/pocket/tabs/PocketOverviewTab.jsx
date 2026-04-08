import { useEffect, useState } from "react";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { Card, clamp, formatTime, getCycleState, sumIntervals } from "./shared";

export function PocketOverviewTab() {
  const { t } = useI18n();
  const { snapshot, selectedMode, workoutStateAt, modeList } = useMonitor();
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

  return (
    <section className="grid gap-4 lg:grid-cols-[1.8fr_0.9fr]">
      <div className="grid gap-3">
        <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("liveCourtStatus")}
            </p>
            <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
              {snapshot?.workoutState === "running"
                ? t("workoutRunning")
                : t("workoutPaused")}
            </h2>
            <p className="text-sm text-slate-500">
              {mode
                ? `${mode.name} · ${t("rounds", { count: mode.repetition })}`
                : t("noModeSelected")}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
            <span className="text-3xl font-extrabold text-blue-700">
              {successRate}%
            </span>
            <small className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("liveSuccessRate")}
            </small>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card
            title={t("workout")}
            value={mode ? mode.name : t("unknown")}
            note={
              mode
                ? `Mode #${mode.modeId ?? mode.mode_id}`
                : t("selectWorkoutFirst")
            }
            tone="gold"
          />
          <Card
            title={t("currentState")}
            value={snapshot?.workoutState || t("unknown")}
            note={
              snapshot?.connectedToFeeder
                ? t("bridgeOnline")
                : t("bridgeOffline")
            }
            tone="green"
          />
          <Card
            title={t("attempts")}
            value={estimatedAttempts}
            note={t("madeShots", { count: made })}
            tone="blue"
          />
        </div>
      </div>

      <aside className="grid gap-3">
        <Card
          title={t("sessionTime")}
          value={formatTime(now - (workoutStateAt || now))}
          note={t("sinceLastWorkoutChange")}
        />
        <Card
          title={t("basketScore")}
          value={snapshot?.basketScore ?? 0}
          note={t("readFromTelemetry")}
        />
        <Card
          title={t("selectedMode")}
          value={snapshot?.activeModeId ?? 0}
          note={t("usedWhenStarting")}
        />
      </aside>
    </section>
  );
}
