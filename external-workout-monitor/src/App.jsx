import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import UserPage from "./pages/UserPage";
import DevPage from "./pages/DevPage";
import {
  PocketControlTab,
  PocketMenuTab,
  PocketOverviewTab,
  PocketStatsTab,
} from "./pages/pocket/Tabs";
import { MonitorContext } from "./monitor/MonitorContext";
import { useI18n } from "./i18n/I18nProvider";

const BRIDGE_URL =
  import.meta.env.VITE_MONITOR_BRIDGE_URL || "ws://127.0.0.1:8787";
const SNAPSHOT_URL =
  (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
  "/snapshot";
const CACHE_KEY = "feeder-pocket-monitor-cache";

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / privacy mode issues.
  }
}

function getModeId(mode) {
  return Number(mode?.modeId ?? mode?.mode_id ?? 0);
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
  const { t } = useI18n();
  const cached = readCache();

  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState(cached?.snapshot || null);
  const [events, setEvents] = useState(cached?.events || []);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [commandInfo, setCommandInfo] = useState("");
  const [modeList, setModeList] = useState(cached?.modeList || []);
  const [activeModeId, setActiveModeId] = useState(
    Number(cached?.activeModeId || 0),
  );
  const [profiles, setProfiles] = useState(cached?.profiles || []);
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
  const [workoutStateAt, setWorkoutStateAt] = useState(
    Number(cached?.workoutStateAt || cached?.snapshot?.workoutStateAt || 0),
  );

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const response = await fetch(SNAPSHOT_URL);
        const data = await response.json();
        setSnapshot(data);
        setEvents(data.latestEvents || []);
        setActiveModeId(Number(data.activeModeId || 0));
        setWorkoutStateAt(Number(data.workoutStateAt || 0));
      } catch {
        // Cached state stays visible offline.
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
          if (packet.payload.workoutStateAt) {
            setWorkoutStateAt(Number(packet.payload.workoutStateAt));
          }
        }

        if (packet.type === "telemetry") {
          const event = packet.payload;

          setEvents((prev) => [event, ...prev].slice(0, 120));
          setSnapshot((prev) => {
            const next = {
              ...(prev || {}),
              connectedToFeeder: true,
              messagesSeen: (prev?.messagesSeen || 0) + 1,
              latestEvents: [event, ...(prev?.latestEvents || [])].slice(
                0,
                120,
              ),
            };

            if (event.event === "workout_state") {
              next.workoutState = event.payload?.state || next.workoutState;
              next.workoutStateAt = event.timestamp_ms || Date.now();
              setWorkoutStateAt(event.timestamp_ms || Date.now());
            }

            if (event.event === "active_mode_changed") {
              const nextModeId = Number(
                event.payload?.mode_id || event.payload?.modeId || 0,
              );
              next.activeModeId = nextModeId;
              setActiveModeId(nextModeId);
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

  useEffect(() => {
    writeCache({
      snapshot,
      events,
      modeList,
      profiles,
      activeModeId,
      workoutStateAt,
    });
  }, [snapshot, events, modeList, profiles, activeModeId, workoutStateAt]);

  const workoutState = snapshot?.workoutState || "unknown";
  const role = snapshot?.role || "guest";
  const isDeveloper = role === "developer";
  const isAuthenticated = Boolean(snapshot?.authenticated);

  const selectedMode = useMemo(() => {
    return (
      modeList.find((mode) => getModeId(mode) === Number(activeModeId)) || null
    );
  }, [modeList, activeModeId]);

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
    setSnapshot((prev) => ({
      ...(prev || {}),
      activeModeId: Number(result.activeModeId || 0),
    }));
    return result;
  };

  const loadProfiles = async () => {
    const result = await runCommand("list_profiles");
    setProfiles(result.users || []);
    return result;
  };

  useEffect(() => {
    if (!connected || !isAuthenticated) {
      setModeList([]);
      setProfiles([]);
      return;
    }

    loadModes().catch(() => {});
    if (role === "developer") {
      loadProfiles().catch(() => {});
    }
  }, [connected, isAuthenticated, role]);

  const handleAuth = async () => {
    setAuthError("");
    try {
      const response = await postJson(
        (import.meta.env.VITE_MONITOR_HTTP_URL || "http://127.0.0.1:8787") +
          "/auth",
        { password },
      );

      if (!response.ok) {
        setAuthError(response.error || t("invalidPassword"));
        return;
      }

      const snapshotResponse = await fetch(SNAPSHOT_URL);
      const refreshed = await snapshotResponse.json();
      setSnapshot(refreshed);
      setPassword("");

      await loadModes();
      if (response.role === "developer") {
        await loadProfiles();
      } else {
        setProfiles([]);
      }

      setCommandInfo(t("commandLoggedIn", { role: response.role }));
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
      setActiveModeId(0);
      setCommandInfo(t("commandSignedOut"));
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
      anchor.download = `feeder-pocket-export-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setCommandInfo(t("commandAllDataDownloaded"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doPause = async () => {
    try {
      await runCommand("pause_workout");
      setCommandInfo(t("commandWorkoutPaused"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doStart = async (modeId = activeModeId) => {
    try {
      await runCommand("start_workout", { mode_id: Number(modeId) });
      setCommandInfo(t("commandWorkoutStarted", { modeId }));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doExit = async () => {
    try {
      await runCommand("exit_workout");
      setCommandInfo(t("commandWorkoutExited"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const doManualMove = async (steps, safety = false) => {
    try {
      const response = await runCommand("manual_move_position", {
        steps: Number(steps),
        safety: Boolean(safety),
      });
      setCommandInfo(
        t("commandMovedSteps", {
          steps: Number(steps),
          safetySuffix: safety ? t("commandSafetySuffix") : "",
        }),
      );
      return response;
    } catch (error) {
      setCommandInfo(error.message || String(error));
      throw error;
    }
  };

  const doManualTryShot = async () => {
    try {
      await runCommand("manual_try_shot");
      setCommandInfo(t("commandSingleShot"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
      throw error;
    }
  };

  const doManualRunShots = async (shots, intervalMs = 1200) => {
    try {
      await runCommand("manual_run_shots", {
        shots: Number(shots),
        interval_ms: Number(intervalMs),
      });
      setCommandInfo(t("commandManualSequence", { shots: Number(shots) }));
    } catch (error) {
      setCommandInfo(error.message || String(error));
      throw error;
    }
  };

  const saveSelectedMode = async () => {
    try {
      await runCommand("select_mode", { mode_id: Number(activeModeId) });
      setSnapshot((prev) => ({
        ...(prev || {}),
        activeModeId: Number(activeModeId),
      }));
      setCommandInfo(t("commandSelectedMode", { modeId: activeModeId }));
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
      setCommandInfo(t("commandProfileAdded"));
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
      setCommandInfo(t("commandProfileUpdated"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const deleteProfile = async (userId) => {
    try {
      await runCommand("delete_user", { user_id: Number(userId) });
      await loadProfiles();
      setCommandInfo(t("commandProfileDeleted"));
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const saveMode = async (mode) => {
    try {
      const patch = modeEdit[getModeId(mode)] || {};
      const payload = {
        ...mode,
        ...patch,
        mode_id: getModeId(mode),
        category: Number((patch.category ?? mode.category) || 0),
        repetition: Number((patch.repetition ?? mode.repetition) || 1),
        predefined: Boolean(patch.predefined ?? mode.predefined),
      };
      await runCommand("update_mode", payload);
      await loadModes();
      setCommandInfo(t("commandModeUpdated", { modeId: getModeId(mode) }));
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
      setCommandInfo(
        t("commandPasswordUpdated", { role: passwordPayload.role }),
      );
    } catch (error) {
      setCommandInfo(error.message || String(error));
    }
  };

  const roleHome = isDeveloper ? "/dev/home" : "/user/home";
  const startPath = !connected || !isAuthenticated ? "/login" : roleHome;

  const monitorValue = useMemo(
    () => ({
      connected,
      snapshot,
      events,
      password,
      setPassword,
      authError,
      commandInfo,
      modeList,
      activeModeId,
      setActiveModeId,
      profiles,
      newProfile,
      setNewProfile,
      renamePayload,
      setRenamePayload,
      passwordPayload,
      setPasswordPayload,
      modeEdit,
      setModeEdit,
      workoutState,
      workoutStateAt,
      role,
      isDeveloper,
      isAuthenticated,
      selectedMode,
      profile: snapshot?.profile || {
        userId: snapshot?.user_id || 0,
        name: snapshot?.profileName || t("guestProfileName"),
        number: snapshot?.profileNumber || 0,
      },
      handleAuth,
      handleSignOut,
      handleExport,
      doPause,
      doStart,
      doExit,
      doManualMove,
      doManualTryShot,
      doManualRunShots,
      saveSelectedMode,
      addProfile,
      renameProfile,
      deleteProfile,
      saveMode,
      changePassword,
      loadModes,
      loadProfiles,
    }),
    [
      connected,
      snapshot,
      events,
      password,
      authError,
      commandInfo,
      modeList,
      activeModeId,
      profiles,
      newProfile,
      renamePayload,
      passwordPayload,
      modeEdit,
      workoutState,
      workoutStateAt,
      role,
      isDeveloper,
      isAuthenticated,
      selectedMode,
    ],
  );

  const loginElement =
    !connected || !isAuthenticated ? (
      <LoginPage />
    ) : (
      <Navigate to={roleHome} replace />
    );

  return (
    <MonitorContext.Provider value={monitorValue}>
      <Routes>
        <Route path="/" element={<Navigate to={startPath} replace />} />
        <Route path="/login" element={loginElement} />
        <Route path="/user" element={<UserPage />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<PocketOverviewTab />} />
          <Route path="control" element={<PocketControlTab />} />
          <Route path="manual" element={<PocketMenuTab />} />
          <Route path="menu" element={<Navigate to="../manual" replace />} />
          <Route path="stats" element={<PocketStatsTab />} />
        </Route>
        <Route path="/dev" element={<DevPage />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<PocketOverviewTab />} />
          <Route path="control" element={<PocketControlTab />} />
          <Route path="manual" element={<PocketMenuTab />} />
          <Route path="menu" element={<Navigate to="../manual" replace />} />
          <Route path="stats" element={<PocketStatsTab />} />
        </Route>
        <Route path="*" element={<Navigate to={startPath} replace />} />
      </Routes>
    </MonitorContext.Provider>
  );
}
