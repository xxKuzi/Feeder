import { useEffect, useMemo, useState } from "react";
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
  return (
    <article className={`pocket-card pocket-card--${tone}`}>
      <p className="pocket-card__title">{title}</p>
      <p className="pocket-card__value">{value}</p>
      {note && <p className="pocket-card__note">{note}</p>}
    </article>
  );
}

function EventList() {
  const { events } = useMonitor();

  return (
    <div className="pocket-event-list">
      {events.slice(0, 18).map((event, index) => (
        <article
          className="pocket-event"
          key={`${event.timestamp_ms || "na"}-${index}`}
        >
          <div className="pocket-event__head">
            <span>{event.event}</span>
            <span>
              {new Date(event.timestamp_ms || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <pre>{JSON.stringify(event.payload || {}, null, 2)}</pre>
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
    <section className="pocket-grid">
      <div className="pocket-grid__main">
        <div className="pocket-hero-card">
          <div className="pocket-hero-card__copy">
            <p className="pocket-kicker">Live court status</p>
            <h2>
              {snapshot?.workoutState === "running"
                ? "Workout running"
                : "Workout paused"}
            </h2>
            <p>
              {mode
                ? `${mode.name} · ${mode.repetition} rounds`
                : "No mode selected"}
            </p>
          </div>
          <div className="pocket-hero-card__rate">
            <span>{successRate}%</span>
            <small>Live success rate</small>
          </div>
        </div>

        <div className="pocket-card-row">
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

      <aside className="pocket-grid__side">
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
    <section className="pocket-panel">
      <div className="pocket-panel__header">
        <div>
          <p className="pocket-kicker">Workout controls</p>
          <h2>Keep it simple</h2>
        </div>
        <p className="pocket-panel__hint">
          User can stop or exit. Developer can also start.
        </p>
      </div>

      <div className="pocket-controls">
        <button
          className="pocket-button pocket-button--ghost"
          onClick={doPause}
        >
          Stop Workout
        </button>
        <button className="pocket-button pocket-button--warm" onClick={doExit}>
          Exit Workout
        </button>
        {isDeveloper && (
          <button
            className="pocket-button pocket-button--primary"
            onClick={() => doStart(activeModeId)}
          >
            Start Workout
          </button>
        )}
      </div>

      <div className="pocket-mode-picker">
        <div className="pocket-mode-picker__row">
          <label htmlFor="mode-select">Selected workout</label>
          <select
            id="mode-select"
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
            className="pocket-button pocket-button--soft"
            onClick={saveSelectedMode}
          >
            Save Selected Mode
          </button>
          <button
            className="pocket-button pocket-button--soft"
            onClick={loadModes}
          >
            Refresh Modes
          </button>
        </div>

        <div className="pocket-mode-grid">
          {modeList.map((mode) => {
            const id = mode.modeId ?? mode.mode_id;
            const active = Number(activeModeId) === Number(id);
            return (
              <button
                key={id}
                className={`pocket-mode-card ${active ? "is-active" : ""}`}
                onClick={() => setActiveModeId(Number(id))}
              >
                <span className="pocket-mode-card__id">#{id}</span>
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
    <section className="pocket-panel">
      <div className="pocket-panel__header">
        <div>
          <p className="pocket-kicker">Manual mode</p>
          <h2>Position and shot testing</h2>
        </div>
        <p className="pocket-panel__hint">
          Move feeder to a try position, fire one shot, or run a custom shot
          count.
        </p>
      </div>

      <div className="pocket-menu-grid">
        <article className="pocket-menu-card">
          <p className="pocket-menu-card__label">Current profile</p>
          <h3>{profile?.name || "Unknown"}</h3>
          <p>#{profile?.number ?? 0}</p>
        </article>

        <article className="pocket-menu-card">
          <p className="pocket-menu-card__label">Workout state</p>
          <h3>{snapshot?.workoutState || "unknown"}</h3>
          <p>Manual controls do not change selected mode.</p>
        </article>
      </div>

      <div className="pocket-dev-stack">
        <section className="pocket-dev-card">
          <h3>Try position</h3>
          <div className="pocket-dev-form">
            <label htmlFor="manual-steps">Position steps (relative)</label>
            <input
              id="manual-steps"
              type="number"
              value={positionSteps}
              onChange={(e) => setPositionSteps(Number(e.target.value || 0))}
              disabled={busy}
            />
            <label htmlFor="manual-safety">
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

          <div className="pocket-controls">
            <button
              className="pocket-button pocket-button--primary"
              onClick={tryPosition}
              disabled={busy}
            >
              Try Position
            </button>
            <button
              className="pocket-button pocket-button--soft"
              onClick={tryShot}
              disabled={busy}
            >
              Try Shot
            </button>
          </div>
        </section>

        <section className="pocket-dev-card">
          <h3>Custom shot sequence</h3>
          <div className="pocket-dev-form">
            <label htmlFor="manual-shots">Number of shots</label>
            <input
              id="manual-shots"
              type="number"
              min={1}
              value={shots}
              onChange={(e) => setShots(Number(e.target.value || 1))}
              disabled={busy}
            />
            <label htmlFor="manual-interval">Delay between shots (ms)</label>
            <input
              id="manual-interval"
              type="number"
              min={120}
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value || 1200))}
              disabled={busy}
            />
          </div>

          <button
            className="pocket-button pocket-button--primary"
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
    <section className="pocket-panel">
      <div className="pocket-panel__header">
        <div>
          <p className="pocket-kicker">Statistics</p>
          <h2>{isDeveloper ? "Live logs and stats" : "Your workout stats"}</h2>
        </div>
        <p className="pocket-panel__hint">
          Developer mode keeps the log feed visible.
        </p>
      </div>

      <div className="pocket-card-row">
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
        <div className="pocket-dev-stack">
          <div className="pocket-dev-actions mt-2">
            <button
              className="pocket-button pocket-button--soft "
              onClick={handleExport}
            >
              Download All Data
            </button>
            <button
              className="pocket-button pocket-button--soft"
              onClick={loadProfiles}
            >
              Refresh Profiles
            </button>
            <button
              className="pocket-button pocket-button--soft"
              onClick={loadModes}
            >
              Refresh Modes
            </button>
          </div>

          <div className="pocket-dev-admin-grid">
            <section className="pocket-dev-card">
              <h3>Profiles</h3>
              <div className="pocket-dev-form">
                <input
                  placeholder="Name"
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
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
                  className="pocket-button pocket-button--primary"
                  onClick={addProfile}
                >
                  Add Profile
                </button>
              </div>

              <div className="pocket-dev-form">
                <input
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
                  className="pocket-button pocket-button--soft"
                  onClick={renameProfile}
                >
                  Update Profile
                </button>
              </div>

              <div className="pocket-list">
                {profiles.map((profile) => (
                  <div key={profile.user_id} className="pocket-list__item">
                    <span>
                      #{profile.user_id} {profile.name} ({profile.number ?? 0})
                    </span>
                    <button
                      className="pocket-button pocket-button--ghost"
                      onClick={() => deleteProfile(profile.user_id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="pocket-dev-card">
              <h3>Modes</h3>
              <div className="pocket-list">
                {modeList.map((mode) => {
                  const id = mode.modeId ?? mode.mode_id;
                  const local = modeEdit[id] || {};
                  return (
                    <div
                      key={id}
                      className="pocket-list__item pocket-list__item--stack"
                    >
                      <input
                        value={local.name ?? mode.name}
                        onChange={(e) =>
                          setModeEdit((prev) => ({
                            ...prev,
                            [id]: { ...(prev[id] || {}), name: e.target.value },
                          }))
                        }
                      />
                      <div className="pocket-inline">
                        <input
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
                          className="pocket-button pocket-button--primary"
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

            <section className="pocket-dev-card">
              <h3>Password management</h3>
              <div className="pocket-dev-form">
                <select
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
                  className="pocket-button pocket-button--soft"
                  onClick={changePassword}
                >
                  Change Password
                </button>
              </div>
            </section>
          </div>

          <div className="pocket-logs-shell">
            <EventList />
          </div>
        </div>
      ) : (
        <p className="pocket-muted">No logs are shown in user mode.</p>
      )}
    </section>
  );
}
