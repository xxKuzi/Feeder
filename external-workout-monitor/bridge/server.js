import http from "node:http";
import net from "node:net";
import { WebSocketServer } from "ws";

const TCP_HOST = process.env.FEEDER_TCP_HOST || "127.0.0.1";
const TCP_PORT = Number(process.env.FEEDER_TCP_PORT || "7878");
const BRIDGE_PORT = Number(process.env.MONITOR_BRIDGE_PORT || "8787");

const state = {
  connectedToFeeder: false,
  connectedAt: null,
  workoutState: "unknown",
  basketScore: 0,
  lastArduinoLine: "",
  messagesSeen: 0,
  latestEvents: [],
};

const wsClients = new Set();

function pushEvent(event) {
  state.latestEvents.unshift(event);
  state.latestEvents = state.latestEvents.slice(0, 200);
}

function broadcast(payload) {
  const serialized = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.readyState === 1) {
      client.send(serialized);
    }
  }
}

function updateFromTelemetry(message) {
  state.messagesSeen += 1;
  pushEvent(message);

  if (message.event === "workout_state") {
    const nextState = message.payload?.state;
    if (typeof nextState === "string") {
      state.workoutState = nextState;
    }
  }

  if (message.event === "basket_score_updated") {
    const score = message.payload?.score;
    if (typeof score === "number") {
      state.basketScore = score;
    }
  }

  if (message.event === "arduino_rx") {
    const line = message.payload?.line;
    if (typeof line === "string") {
      state.lastArduinoLine = line;
    }
  }
}

function connectTcp() {
  const socket = net.createConnection(
    { host: TCP_HOST, port: TCP_PORT },
    () => {
      state.connectedToFeeder = true;
      state.connectedAt = new Date().toISOString();
      console.log(
        `[bridge] Connected to feeder telemetry ${TCP_HOST}:${TCP_PORT}`,
      );
      broadcast({ type: "snapshot", payload: state });
    },
  );

  socket.on("error", (error) => {
    state.connectedToFeeder = false;
    console.error(`[bridge] TCP error: ${error.message}`);
  });

  socket.on("close", () => {
    state.connectedToFeeder = false;
    console.warn("[bridge] TCP disconnected, retrying in 1s...");
    setTimeout(connectTcp, 1000);
  });

  let pending = "";

  socket.on("data", (chunk) => {
    pending += chunk.toString("utf8");

    let index = pending.indexOf("\n");
    while (index >= 0) {
      const line = pending.slice(0, index).trim();
      pending = pending.slice(index + 1);

      if (line.length > 0) {
        try {
          const message = JSON.parse(line);
          updateFromTelemetry(message);
          broadcast({ type: "telemetry", payload: message });
        } catch (error) {
          console.warn(`[bridge] Ignoring non-JSON line: ${line}`);
        }
      }

      index = pending.indexOf("\n");
    }
  });
}

const httpServer = http.createServer((req, res) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.url === "/snapshot") {
    res.writeHead(200, { ...headers, "Content-Type": "application/json" });
    res.end(JSON.stringify(state));
    return;
  }

  res.writeHead(404, { ...headers, "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

const wsServer = new WebSocketServer({ server: httpServer });
wsServer.on("connection", (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", payload: state }));

  ws.on("close", () => {
    wsClients.delete(ws);
  });
});

httpServer.listen(BRIDGE_PORT, () => {
  console.log(
    `[bridge] WS/HTTP bridge listening on http://127.0.0.1:${BRIDGE_PORT}`,
  );
});

connectTcp();
