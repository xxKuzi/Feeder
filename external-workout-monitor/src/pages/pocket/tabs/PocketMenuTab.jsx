import { useState } from "react";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";

export function PocketMenuTab() {
  const { t } = useI18n();
  const { profile, doManualMove, doManualTryShot, doManualRunShots, snapshot } =
    useMonitor();
  const [positionSteps, setPositionSteps] = useState(0);
  const [moveWithSafety, setMoveWithSafety] = useState(false);
  const [shots, setShots] = useState(5);
  const [intervalMs, setIntervalMs] = useState(1200);
  const [busy, setBusy] = useState(false);

  const tryPosition = async () => {
    setBusy(true);
    try {
      await doManualMove(positionSteps, moveWithSafety);
    } finally {
      setBusy(false);
    }
  };

  const tryShot = async () => {
    setBusy(true);
    try {
      await doManualTryShot();
    } finally {
      setBusy(false);
    }
  };

  const runManualSequence = async () => {
    setBusy(true);
    try {
      await doManualRunShots(Math.max(1, shots), Math.max(120, intervalMs));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("manualModeTitle")}
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {t("positionShotTesting")}
          </h2>
        </div>
        <p className="text-sm text-slate-500">{t("manualHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("currentProfile")}
          </p>
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {profile?.name || t("unknown")}
          </h3>
          <p>#{profile?.number ?? 0}</p>
        </article>

        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("workoutState")}
          </p>
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {snapshot?.workoutState || t("unknown")}
          </h3>
          <p>{t("manualNoModeChange")}</p>
        </article>
      </div>

      <div className="grid gap-3">
        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {t("tryPositionTitle")}
          </h3>
          <div className="grid gap-3">
            <label htmlFor="manual-steps">{t("positionStepsRelative")}</label>
            <input
              id="manual-steps"
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={positionSteps}
              onChange={(e) => setPositionSteps(Number(e.target.value || 0))}
              disabled={busy}
            />
            <label
              className="inline-flex items-center gap-2"
              htmlFor="manual-safety"
            >
              <input
                id="manual-safety"
                type="checkbox"
                checked={moveWithSafety}
                onChange={(e) => setMoveWithSafety(e.target.checked)}
                disabled={busy}
              />{" "}
              {t("moveWithSafety")}
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
              onClick={tryPosition}
              disabled={busy}
            >
              {t("tryPosition")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={tryShot}
              disabled={busy}
            >
              {t("tryShot")}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {t("customShotSequence")}
          </h3>
          <div className="grid gap-3">
            <label htmlFor="manual-shots">{t("numberOfShots")}</label>
            <input
              id="manual-shots"
              type="number"
              min={1}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={shots}
              onChange={(e) => setShots(Number(e.target.value || 1))}
              disabled={busy}
            />
            <label htmlFor="manual-interval">{t("delayBetweenShots")}</label>
            <input
              id="manual-interval"
              type="number"
              min={120}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value || 1200))}
              disabled={busy}
            />
          </div>

          <button
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
            onClick={runManualSequence}
            disabled={busy}
          >
            {t("runShots", { count: Math.max(1, shots) })}
          </button>
        </section>
      </div>
    </section>
  );
}
