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

export default function App() {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);

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
  const workoutStateClass = useMemo(() => {
    if (workoutState === "running") return "pill running";
    if (workoutState === "paused") return "pill paused";
    return "pill";
  }, [workoutState]);

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
    </div>
  );
}
