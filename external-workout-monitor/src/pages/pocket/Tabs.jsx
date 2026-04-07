import { useEffect, useState } from "react";
import { useMonitor } from "../../monitor/MonitorContext";
import { useI18n } from "../../i18n/I18nProvider";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(ms) {
  if (!ms || ms < 0) return "0s";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function sumIntervals(intervals = []) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((sum, value) => sum + Number(value || 0), 0);
}

function getCycleState(mode, startedAt, now = Date.now()) {
  if (!mode || !Array.isArray(mode.intervals) || mode.intervals.length === 0) {
    return {
      progress: 0,
      intervalIndex: 0,
      intervalElapsed: 0,
      intervalRemaining: 0,
      cycleElapsed: 0,
      cycleLength: 1,
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

function Card({ title, value, note, tone = "neutral" }) {
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

function EventList() {
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

export function PocketOverviewTab() {
  const { t } = useI18n();
  const { snapshot, selectedMode, workoutState, workoutStateAt, modeList } =
    useMonitor();
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
  const estimatedAttempts = Math.max(
    1,
    Math.min(
      Math.ceil(cycleState.elapsedSeconds / averageInterval),
      Math.max((mode?.repetition || 1) * Math.max(intervals.length, 1), 1),
    ),
  );
  const successRate = clamp(
    Math.round((made / estimatedAttempts) * 100),
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

export function PocketControlTab() {
  const { t } = useI18n();
  const {
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
  const cycleProgressPercent = Math.round(cycleState.progress * 100);
  const currentShot = Math.min(
    cycleState.intervalIndex + 1,
    intervals.length || 1,
  );
  const totalShotsPerRound = Math.max(intervals.length, 1);

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title={t("successRatio")}
          value={`${successRate}%`}
          note={t("madeVsTaken")}
          tone="blue"
        />
        <Card
          title={t("shotsMade")}
          value={made}
          note={t("liveBasketScore")}
          tone="green"
        />
        <Card
          title={t("shotsTaken")}
          value={estimatedAttempts}
          note={t("targetShots", { count: plannedShots })}
          tone="gold"
        />
        <Card
          title={t("workoutTime")}
          value={formatTime(now - (workoutStateAt || now))}
          note={
            snapshot?.workoutState === "running" ? t("running") : t("paused")
          }
        />
      </div>

      <div className="mb-4 rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="m-0 text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("workoutCycleTimebar")}
          </p>
          <p className="m-0 text-sm font-semibold text-slate-700">
            {t("shotProgress", {
              current: currentShot,
              total: totalShotsPerRound,
              left: formatTime(cycleState.intervalRemaining * 1000),
            })}
          </p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-200"
            style={{ width: `${cycleProgressPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>{mode ? mode.name : t("noModeSelected")}</span>
          <span>{t("roundProgress", { progress: cycleProgressPercent })}</span>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("workoutControls")}
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {t("keepItSimple")}
          </h2>
        </div>
        <p className="text-sm text-slate-500">{t("controlsHint")}</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
          onClick={doPause}
        >
          {t("stopWorkout")}
        </button>
        <button
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
          onClick={doExit}
        >
          {t("exitWorkout")}
        </button>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
          onClick={() => doStart(activeModeId)}
        >
          {t("startWorkout")}
        </button>
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mode-select">{t("selectedWorkout")}</label>
          <select
            id="mode-select"
            className="min-w-[220px] rounded-lg border border-slate-300 px-3 py-2"
            value={activeModeId}
            onChange={(e) => setActiveModeId(Number(e.target.value))}
          >
            {modeList.map((mode) => (
              <option
                key={mode.modeId ?? mode.mode_id}
                value={mode.modeId ?? mode.mode_id}
              >
                {mode.modeId ?? mode.mode_id} · {mode.name}
              </option>
            ))}
          </select>
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

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {modeList.map((mode) => {
            const id = mode.modeId ?? mode.mode_id;
            const active = Number(activeModeId) === Number(id);
            return (
              <button
                key={id}
                className={`rounded-lg border p-3 text-left shadow-sm transition ${active ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-white"}`}
                onClick={() => setActiveModeId(Number(id))}
              >
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  #{id}
                </span>
                <strong>{mode.name}</strong>
                <small>
                  {t("rounds", { count: mode.repetition || 1 })} ·{" "}
                  {Array.isArray(mode.intervals) ? mode.intervals.length : 1}{" "}
                  {t("shotsLabel")}
                </small>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

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

export function PocketStatsTab() {
  const { t } = useI18n();
  const {
    snapshot,
    isDeveloper,
    handleExport,
    loadProfiles,
    loadModes,
    profiles,
    newProfile,
    setNewProfile,
    renamePayload,
    setRenamePayload,
    addProfile,
    renameProfile,
    deleteProfile,
    passwordPayload,
    setPasswordPayload,
    changePassword,
    modeList,
    modeEdit,
    setModeEdit,
    saveMode,
  } = useMonitor();
  const made = Number(snapshot?.basketScore || 0);
  const messages = Number(snapshot?.messagesSeen || 0);

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("statistics")}
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {isDeveloper ? t("liveLogsAndStats") : t("yourWorkoutStats")}
          </h2>
        </div>
        <p className="text-sm text-slate-500">{t("devLogHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          title={t("basketScore")}
          value={snapshot?.basketScore ?? 0}
          note={t("currentLiveScore")}
          tone="gold"
        />
        <Card
          title={t("messages")}
          value={messages}
          note={isDeveloper ? t("includesTelemetry") : t("hiddenLogs")}
          tone="blue"
        />
        <Card
          title={t("state")}
          value={snapshot?.workoutState || t("unknown")}
          note={t("roleLine", { role: snapshot?.role || t("roleGuest") })}
          tone="green"
        />
      </div>

      {isDeveloper ? (
        <div className="grid gap-3">
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={handleExport}
            >
              {t("downloadAllData")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadProfiles}
            >
              {t("refreshProfiles")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadModes}
            >
              {t("refreshModes")}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("profiles")}
              </h3>
              <div className="grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder={t("name")}
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("number")}
                  value={newProfile.number}
                  onChange={(e) =>
                    setNewProfile((prev) => ({
                      ...prev,
                      number: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                  onClick={addProfile}
                >
                  {t("addProfile")}
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("userId")}
                  value={renamePayload.user_id}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      user_id: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder={t("newName")}
                  value={renamePayload.new_name}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      new_name: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("newNumber")}
                  value={renamePayload.new_number}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      new_number: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
                  onClick={renameProfile}
                >
                  {t("updateProfile")}
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 p-2 text-sm"
                  >
                    <span>
                      #{profile.user_id} {profile.name} ({profile.number ?? 0})
                    </span>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
                      onClick={() => deleteProfile(profile.user_id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("modes")}
              </h3>
              <div className="mt-3 grid gap-2">
                {modeList.map((mode) => {
                  const id = mode.modeId ?? mode.mode_id;
                  const local = modeEdit[id] || {};
                  return (
                    <div
                      key={id}
                      className="grid items-stretch gap-2 rounded-lg border border-slate-300 p-2 text-sm"
                    >
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={local.name ?? mode.name}
                        onChange={(e) =>
                          setModeEdit((prev) => ({
                            ...prev,
                            [id]: { ...(prev[id] || {}), name: e.target.value },
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          type="number"
                          value={local.repetition ?? mode.repetition}
                          onChange={(e) =>
                            setModeEdit((prev) => ({
                              ...prev,
                              [id]: {
                                ...(prev[id] || {}),
                                repetition: Number(e.target.value),
                              },
                            }))
                          }
                        />
                        <button
                          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                          onClick={() => saveMode(mode)}
                        >
                          {t("save")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("passwordManagement")}
              </h3>
              <div className="grid gap-3">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  value={passwordPayload.role}
                  onChange={(e) =>
                    setPasswordPayload((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                >
                  <option value="user">{t("userPassword")}</option>
                  <option value="developer">{t("developerPassword")}</option>
                </select>
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="password"
                  placeholder={t("newPassword")}
                  value={passwordPayload.new_password}
                  onChange={(e) =>
                    setPasswordPayload((prev) => ({
                      ...prev,
                      new_password: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
                  onClick={changePassword}
                >
                  {t("changePassword")}
                </button>
              </div>
            </section>
          </div>

          <div className="min-h-[260px]">
            <EventList />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t("noUserLogs")}</p>
      )}
    </section>
  );
}
