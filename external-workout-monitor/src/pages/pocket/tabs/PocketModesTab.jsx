import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { getModeId } from "./shared";

export function PocketModesTab() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    role,
    profile,
    snapshot,
    modeList,
    activeModeId,
    setActiveModeId,
    loadModes,
    doStart,
    doManualMove,
    doManualTryShot,
    doManualRunShots,
  } = useMonitor();
  const [view, setView] = useState("modes");
  const [positionSteps, setPositionSteps] = useState(0);
  const [moveWithSafety, setMoveWithSafety] = useState(false);
  const [shots, setShots] = useState(5);
  const [intervalMs, setIntervalMs] = useState(1200);
  const [busy, setBusy] = useState(false);

  const basePath = role === "developer" ? "/dev" : "/user";

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

  const ManualPanel = () => (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm mb-16">
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

  const ModesPanel = () => (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm mb-16">
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
                  className="flex min-w-0 flex-1 flex-col truncate items-start text-left"
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
                  <strong className="mt-2  text-lg truncate text-slate-900">
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
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-blue-700 bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    onClick={async () => {
                      setActiveModeId(Number(id));
                      await doStart(Number(id));
                      navigate(`${basePath}/control`);
                    }}
                  >
                    {t("startMode")}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => navigate(`${basePath}/control/edit/${id}`)}
                  >
                    {t("editMode")}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="grid gap-4">
      <section className=" border-t-2 border-blue-300 bg-gray-200 p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("modesTab")}
            </p>
            <h2 className="m-0 mt-1 text-3xl font-bold leading-tight text-slate-900">
              {view === "manual" ? t("manualModeTitle") : t("modes")}
            </h2>
          </div>
          <div className="inline-flex rounded-2xl border border-slate-300 bg-slate-100 p-1 shadow-sm">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "modes" ? "bg-blue-600 text-white shadow-sm" : "bg-transparent text-slate-700 hover:bg-white"}`}
              onClick={() => setView("modes")}
            >
              {t("modes")}
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${view === "manual" ? "bg-blue-600 text-white shadow-sm" : "bg-transparent text-slate-700 hover:bg-white"}`}
              onClick={() => setView("manual")}
            >
              {t("manualModeTitle")}
            </button>
          </div>
        </div>

        {view === "modes" ? <ModesPanel /> : <ManualPanel />}
      </section>
    </div>
  );
}
