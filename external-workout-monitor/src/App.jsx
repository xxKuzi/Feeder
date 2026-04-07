import { useEffect, useMemo, useState } from "react";

const BRIDGE_URL =
  import.meta.env.VITE_MONITOR_BRIDGE_URL || "ws://127.0.0.1:8787";
const SNAPSHOT_URL =
  (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
  "/snapshot";

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [commandInfo, setCommandInfo] = useState("");
  const [modeList, setModeList] = useState([]);
  const [activeModeId, setActiveModeId] = useState(0);
  const [profiles, setProfiles] = useState([]);
  const [newProfile, setNewProfile] = useState({ name: "", number: 0 });
  const [renamePayload, setRenamePayload] = useState({
    user_id: 0,
    new_name: "",
    new_number: 0,
  });
  const [passwordPayload, setPasswordPayload] = useState({
    role: "user",
    new_password: "",
  });
  const [modeEdit, setModeEdit] = useState({});
  const [activeTab, setActiveTab] = useState("control");

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const response = await fetch(SNAPSHOT_URL);
        const data = await response.json();
        setSnapshot(data);
        setEvents(data.latestEvents || []);
      } catch {
        // Ignore fetch errors; websocket may still connect.
      }
    };

    loadInitial();

    const ws = new WebSocket(BRIDGE_URL);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (msg) => {
      try {
        const packet = JSON.parse(msg.data);

        if (packet.type === "snapshot") {
          setSnapshot(packet.payload);
          setEvents(packet.payload.latestEvents || []);
          setActiveModeId(Number(packet.payload.activeModeId || 0));
        }

        if (packet.type === "telemetry") {
          const event = packet.payload;

          setEvents((prev) => [event, ...prev].slice(0, 100));
          setSnapshot((prev) => {
            const next = {
              ...(prev || {}),
              connectedToFeeder: true,
              messagesSeen: (prev?.messagesSeen || 0) + 1,
              latestEvents: [event, ...(prev?.latestEvents || [])].slice(
                0,
                100,
              ),
            };

            if (event.event === "workout_state") {
              next.workoutState = event.payload?.state || next.workoutState;
            }
            if (event.event === "basket_score_updated") {
              next.basketScore = event.payload?.score ?? next.basketScore;
            }
            if (event.event === "arduino_rx") {
              next.lastArduinoLine =
                event.payload?.line || next.lastArduinoLine;
            }

            return next;
          });
        }
      } catch {
        // Ignore malformed bridge packets.
      }
    };

    return () => ws.close();
  }, []);

  const workoutState = snapshot?.workoutState || "unknown";
  const role = snapshot?.role || "guest";
  const isDeveloper = role === "developer";
  const isAuthenticated = Boolean(snapshot?.authenticated);

  const runCommand = async (command, args = {}) => {
    const result = await postJson(
      (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
        "/command",
      {
        command,
        args,
      },
    );

    if (!result.ok) {
      throw new Error(result.error || "Command failed");
    }

    return result.data;
  };

  const loadModes = async () => {
    const result = await runCommand("load_modes");
    setModeList(result.modes || []);
    setActiveModeId(Number(result.activeModeId || 0));
  };

  const loadProfiles = async () => {
    const result = await runCommand("list_profiles");
    setProfiles(result.users || []);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setModeList([]);
      setProfiles([]);
      return;
    }

    loadModes().catch(() => {});
    if (role === "developer") {
      loadProfiles().catch(() => {});
    }
  }, [isAuthenticated, role]);

  const handleAuth = async () => {
    setAuthError("");
    try {
      const response = await postJson(
        (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
          "/auth",
        { password },
      );

      if (!response.ok) {
        setAuthError(response.error || "Invalid password");
        return;
      }

      const snapshotResponse = await fetch(SNAPSHOT_URL);
      const refreshed = await snapshotResponse.json();
      setSnapshot(refreshed);

      await loadModes();
      await loadProfiles();
      setCommandInfo(`Logged in as ${response.role}`);
    } catch (error) {
      setAuthError(error.message || String(error));
    }
  };

  const handleSignOut = async () => {
    try {
      await postJson(
        (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
          "/logout",
        {},
      );
      setSnapshot((prev) => ({
        ...(prev || {}),
        authenticated: false,
        role: null,
      }));
      setModeList([]);
      setProfiles([]);
      setCommandInfo("Signed out");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const handleExport = async () => {
    try {
      const data = await runCommand("export_all_data");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `feeder-full-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCommandInfo("All data downloaded");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doPause = async () => {
    try {
      await runCommand("pause_workout");
      setCommandInfo("Workout paused");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doStart = async () => {
    try {
      await runCommand("start_workout", { mode_id: Number(activeModeId) });
      setCommandInfo(`Workout started with mode ${activeModeId}`);
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doExit = async () => {
    try {
      await runCommand("exit_workout");
      setCommandInfo("Workout exited to menu");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const saveSelectedMode = async () => {
    try {
      await runCommand("select_mode", { mode_id: Number(activeModeId) });
      setCommandInfo(`Selected mode ${activeModeId}`);
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const addProfile = async () => {
    try {
      await runCommand("add_user", {
        name: newProfile.name,
        number: Number(newProfile.number || 0),
      });
      await loadProfiles();
      setNewProfile({ name: "", number: 0 });
      setCommandInfo("Profile added");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const renameProfile = async () => {
    try {
      await runCommand("rename_user", {
        user_id: Number(renamePayload.user_id),
        new_name: renamePayload.new_name,
        new_number: Number(renamePayload.new_number || 0),
      });
      await loadProfiles();
      setCommandInfo("Profile updated");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const deleteProfile = async (userId) => {
    try {
      await runCommand("delete_user", { user_id: Number(userId) });
      await loadProfiles();
      setCommandInfo("Profile deleted");
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const saveMode = async (mode) => {
    try {
      const patch = modeEdit[mode.mode_id] || {};
      const payload = {
        ...mode,
        ...patch,
        mode_id: Number(mode.mode_id),
        category: Number((patch.category ?? mode.category) || 0),
        repetition: Number((patch.repetition ?? mode.repetition) || 1),
        predefined: Boolean(patch.predefined ?? mode.predefined),
      };
      await runCommand("update_mode", payload);
      await loadModes();
      setCommandInfo(`Mode ${mode.mode_id} updated`);
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const changePassword = async () => {
    try {
      await runCommand("change_password", {
        role: passwordPayload.role,
        new_password: passwordPayload.new_password,
      });
      setPasswordPayload((prev) => ({ ...prev, new_password: "" }));
      setCommandInfo(`Password for ${passwordPayload.role} updated`);
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const workoutStateClass = useMemo(() => {
    if (workoutState === "running") return "pill running";
    if (workoutState === "paused") return "pill paused";
    return "pill";
  }, [workoutState]);

  const needsAccessGate = !connected || !isAuthenticated;

  if (needsAccessGate) {
    return (
      <div className="page">
        <header className="hero">
          <h1>Feeder Live Workout Monitor</h1>
          <p>
            External dashboard for BLE/TCP telemetry and real-time workout
            stats.
          </p>
          <div className={connected ? "connection ok" : "connection bad"}>
            Bridge: {connected ? "connected" : "disconnected"}
          </div>
          <div className="connection-role">
            Access: {isAuthenticated ? role : "locked"}
          </div>
        </header>

        <section className="card auth-gate">
          <h2>{connected ? "Remote Login" : "Bridge Not Connected"}</h2>
          <p className="hint">
            {connected
              ? "Enter password to unlock remote control."
              : "Start Feeder app and bridge first, then login becomes available."}
          </p>
          <div className="controls-line">
            <input
              type="password"
              placeholder="Enter user or developer password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!connected}
            />
            <button onClick={handleAuth} disabled={!connected}>
              Unlock
            </button>
          </div>
          {authError && <p className="error-text">{authError}</p>}
        </section>

        <section className="events card auth-row">
          <h2>Live Telemetry Events</h2>
          <div className="event-list">
            {events.length === 0 && (
              <p className="hint">Waiting for telemetry...</p>
            )}
            {events.map((event, idx) => (
              <div
                className="event-row"
                key={`${event.timestamp_ms || "na"}-${idx}`}
              >
                <div className="event-meta">
                  <span>{event.event}</span>
                  <span>{formatTimestamp(event.timestamp_ms)}</span>
                </div>
                <pre>{JSON.stringify(event.payload || {}, null, 2)}</pre>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>Feeder Live Workout Monitor</h1>
        <p>
          External dashboard for BLE/TCP telemetry and real-time workout stats.
        </p>
        <div className={connected ? "connection ok" : "connection bad"}>
          Bridge: {connected ? "connected" : "disconnected"}
        </div>
        <div className="connection-role">
          Access: {isAuthenticated ? role : "locked"}
        </div>
        {isAuthenticated && (
          <div className="controls-line auth-row">
            <button onClick={handleSignOut}>Sign Out</button>
          </div>
        )}
      </header>

      <section className="stats-grid">
        <article className="card">
          <h2>Workout State</h2>
          <div className={workoutStateClass}>{workoutState}</div>
        </article>

        <article className="card">
          <h2>Basket Score</h2>
          <div className="metric">{snapshot?.basketScore ?? 0}</div>
        </article>

        <article className="card">
          <h2>Messages Seen</h2>
          <div className="metric">{snapshot?.messagesSeen ?? 0}</div>
        </article>

        <article className="card">
          <h2>Last Arduino Line</h2>
          <p className="mono">{snapshot?.lastArduinoLine || "No data yet"}</p>
        </article>
      </section>

      {isAuthenticated && (
        <section className="card auth-row">
          <h2>Remote Tabs</h2>
          <div className="controls-line">
            <button
              className={activeTab === "control" ? "tab-active" : ""}
              onClick={() => setActiveTab("control")}
            >
              Control
            </button>
            <button
              className={activeTab === "modes" ? "tab-active" : ""}
              onClick={() => setActiveTab("modes")}
            >
              Modes
            </button>
            <button
              className={activeTab === "profiles" ? "tab-active" : ""}
              onClick={() => setActiveTab("profiles")}
            >
              Profiles
            </button>
            <button
              className={activeTab === "events" ? "tab-active" : ""}
              onClick={() => setActiveTab("events")}
            >
              Events
            </button>
          </div>
        </section>
      )}

      {isAuthenticated && activeTab === "control" && (
        <section className="card auth-row">
          <h2>Normal User Control</h2>
          <div className="controls-line">
            <button onClick={doPause}>Stop Workout</button>
            <button onClick={doExit}>Exit Workout</button>
            {isDeveloper && <button onClick={doStart}>Start Workout</button>}
          </div>
          <div className="controls-line">
            <select
              value={activeModeId}
              onChange={(e) => setActiveModeId(Number(e.target.value))}
            >
              {modeList.map((mode) => (
                <option key={mode.mode_id} value={mode.mode_id}>
                  {mode.mode_id} - {mode.name}
                </option>
              ))}
            </select>
            <button onClick={saveSelectedMode}>Save Selected Mode</button>
            <button onClick={loadModes}>Refresh Modes</button>
          </div>
        </section>
      )}

      {isDeveloper && activeTab === "profiles" && (
        <section className="card auth-row">
          <h2>Profiles</h2>
          <div className="controls-line">
            <button onClick={loadProfiles}>Refresh Profiles</button>
          </div>
          <div className="controls-line">
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
                setNewProfile((prev) => ({ ...prev, number: e.target.value }))
              }
            />
            <button onClick={addProfile}>Add Profile</button>
          </div>

          <div className="controls-line">
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
            <button onClick={renameProfile}>Rename/Update Profile</button>
          </div>

          <div className="tag-list">
            {profiles.map((profile) => (
              <div key={profile.user_id} className="tag-item">
                <span>
                  #{profile.user_id} {profile.name} ({profile.number ?? 0})
                </span>
                <button onClick={() => deleteProfile(profile.user_id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          <h3>Password Management</h3>
          <div className="controls-line">
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
            <button onClick={changePassword}>Change Password</button>
          </div>
        </section>
      )}

      {isDeveloper && activeTab === "modes" && (
        <section className="card auth-row">
          <h2>Modes</h2>
          <div className="controls-line">
            <button onClick={loadModes}>Refresh Modes</button>
            <button onClick={handleExport}>Download All Data</button>
          </div>

          <div className="tag-list">
            {modeList.map((mode) => {
              const local = modeEdit[mode.mode_id] || {};
              return (
                <div key={mode.mode_id} className="mode-edit-row">
                  <span>#{mode.mode_id}</span>
                  <input
                    value={local.name ?? mode.name}
                    onChange={(e) =>
                      setModeEdit((prev) => ({
                        ...prev,
                        [mode.mode_id]: {
                          ...(prev[mode.mode_id] || {}),
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                  <input
                    type="number"
                    value={local.repetition ?? mode.repetition}
                    onChange={(e) =>
                      setModeEdit((prev) => ({
                        ...prev,
                        [mode.mode_id]: {
                          ...(prev[mode.mode_id] || {}),
                          repetition: Number(e.target.value),
                        },
                      }))
                    }
                  />
                  <button onClick={() => saveMode(mode)}>Save</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {commandInfo && <p className="hint command-info">{commandInfo}</p>}

      {(!isAuthenticated || activeTab === "events") && (
        <section className="events card">
          <h2>Live Telemetry Events</h2>
          <div className="event-list">
            {events.length === 0 && (
              <p className="hint">Waiting for telemetry...</p>
            )}
            {events.map((event, idx) => (
              <div
                className="event-row"
                key={`${event.timestamp_ms || "na"}-${idx}`}
              >
                <div className="event-meta">
                  <span>{event.event}</span>
                  <span>{formatTimestamp(event.timestamp_ms)}</span>
                </div>
                <pre>{JSON.stringify(event.payload || {}, null, 2)}</pre>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
