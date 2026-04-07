import { useEffect, useState } from "react";
import { useMonitor } from "../../monitor/MonitorContext";

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
              Live court status
            </p>
            <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
              {snapshot?.workoutState === "running"
                ? "Workout running"
                : "Workout paused"}
            </h2>
            <p className="text-sm text-slate-500">
              {mode
                ? `${mode.name} · ${mode.repetition} rounds`
                : "No mode selected"}
            </p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center">
            <span className="text-3xl font-extrabold text-blue-700">
              {successRate}%
            </span>
            <small className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live success rate
            </small>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card
            title="Workout"
            value={mode ? mode.name : "Unknown"}
            note={
              mode
                ? `Mode #${mode.modeId ?? mode.mode_id}`
                : "Select a workout first"
            }
            tone="gold"
          />
          <Card
            title="Current state"
            value={snapshot?.workoutState || "unknown"}
            note={`Bridge ${snapshot?.connectedToFeeder ? "online" : "offline"}`}
            tone="green"
          />
          <Card
            title="Attempts"
            value={estimatedAttempts}
            note={`Made ${made} shots`}
            tone="blue"
          />
        </div>
      </div>

      <aside className="grid gap-3">
        <Card
          title="Session time"
          value={formatTime(now - (workoutStateAt || now))}
          note="Since last workout change"
        />
        <Card
          title="Basket score"
          value={snapshot?.basketScore ?? 0}
          note="Read from live telemetry"
        />
        <Card
          title="Selected mode"
          value={snapshot?.activeModeId ?? 0}
          note="Used when starting workout"
        />
      </aside>
    </section>
  );
}

export function PocketControlTab() {
  const {
    isDeveloper,
    modeList,
    activeModeId,
    setActiveModeId,
    loadModes,
    saveSelectedMode,
    doPause,
    doExit,
    doStart,
  } = useMonitor();

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Workout controls
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            Keep it simple
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          User can stop or exit. Developer can also start.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
          onClick={doPause}
        >
          Stop Workout
        </button>
        <button
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
          onClick={doExit}
        >
          Exit Workout
        </button>
        {isDeveloper && (
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
            onClick={() => doStart(activeModeId)}
          >
            Start Workout
          </button>
        )}
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mode-select">Selected workout</label>
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
            Save Selected Mode
          </button>
          <button
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
            onClick={loadModes}
          >
            Refresh Modes
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
                  {mode.repetition || 1} rounds ·{" "}
                  {Array.isArray(mode.intervals) ? mode.intervals.length : 1}{" "}
                  shots
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
            Manual mode
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            Position and shot testing
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Move feeder to a try position, fire one shot, or run a custom shot
          count.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Current profile
          </p>
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {profile?.name || "Unknown"}
          </h3>
          <p>#{profile?.number ?? 0}</p>
        </article>

        <article className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Workout state
          </p>
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {snapshot?.workoutState || "unknown"}
          </h3>
          <p>Manual controls do not change selected mode.</p>
        </article>
      </div>

      <div className="grid gap-3">
        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            Try position
          </h3>
          <div className="grid gap-3">
            <label htmlFor="manual-steps">Position steps (relative)</label>
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
              Move with limit-switch safety
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
              onClick={tryPosition}
              disabled={busy}
            >
              Try Position
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={tryShot}
              disabled={busy}
            >
              Try Shot
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            Custom shot sequence
          </h3>
          <div className="grid gap-3">
            <label htmlFor="manual-shots">Number of shots</label>
            <input
              id="manual-shots"
              type="number"
              min={1}
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={shots}
              onChange={(e) => setShots(Number(e.target.value || 1))}
              disabled={busy}
            />
            <label htmlFor="manual-interval">Delay between shots (ms)</label>
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
            Run {Math.max(1, shots)} Shots
          </button>
        </section>
      </div>
    </section>
  );
}

export function PocketStatsTab() {
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
            Statistics
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {isDeveloper ? "Live logs and stats" : "Your workout stats"}
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          Developer mode keeps the log feed visible.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          title="Basket score"
          value={snapshot?.basketScore ?? 0}
          note="Current live score"
          tone="gold"
        />
        <Card
          title="Messages"
          value={messages}
          note={
            isDeveloper
              ? "Includes telemetry and events"
              : "Hidden logs in user mode"
          }
          tone="blue"
        />
        <Card
          title="State"
          value={snapshot?.workoutState || "unknown"}
          note={`Role ${snapshot?.role || "guest"}`}
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
              Download All Data
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadProfiles}
            >
              Refresh Profiles
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadModes}
            >
              Refresh Modes
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                Profiles
              </h3>
              <div className="grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Name"
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder="Number"
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
                  Add Profile
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder="User ID"
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
                  placeholder="New Name"
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
                  placeholder="New Number"
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
                  Update Profile
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
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                Modes
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
                          Save
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                Password management
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
                  <option value="user">User password</option>
                  <option value="developer">Developer password</option>
                </select>
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="password"
                  placeholder="New password"
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
                  Change Password
                </button>
              </div>
            </section>
          </div>

          <div className="min-h-[260px]">
            <EventList />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No logs are shown in user mode.
        </p>
      )}
    </section>
  );
}
