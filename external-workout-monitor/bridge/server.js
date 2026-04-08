import http from "node:http";
import net from "node:net";
import { WebSocketServer } from "ws";

const TCP_HOST = process.env.FEEDER_TCP_HOST || "127.0.0.1";
const TCP_PORT = Number(process.env.FEEDER_TCP_PORT || "7878");
const BRIDGE_PORT = Number(process.env.MONITOR_BRIDGE_PORT || "8787");
const WORKOUT_STATE_PAUSE = 0;
const WORKOUT_STATE_RUNNING = 1;
const WORKOUT_STATE_BREAK = 2;

function toWorkoutStateCode(state, activeModeId = 0) {
  if (typeof state === "number") {
    if (
      state === WORKOUT_STATE_PAUSE ||
      state === WORKOUT_STATE_RUNNING ||
      state === WORKOUT_STATE_BREAK
    ) {
      return state;
    }
  }

  const normalized = String(state || "").toLowerCase();
  if (normalized === "running") {
    return WORKOUT_STATE_RUNNING;
  }
  if (normalized === "paused") {
    return Number(activeModeId || 0) > 0
      ? WORKOUT_STATE_PAUSE
      : WORKOUT_STATE_BREAK;
  }
  if (
    normalized === "break" ||
    normalized === "idle" ||
    normalized === "stopped" ||
    normalized === "ended" ||
    normalized === "finished"
  ) {
    return WORKOUT_STATE_BREAK;
  }

  return WORKOUT_STATE_BREAK;
}

const state = {
  connectedToFeeder: false,
  connectedAt: null,
  authenticated: false,
  role: null,
  workoutState: WORKOUT_STATE_BREAK,
  workoutStateAt: null,
  activeModeId: 0,
  basketScore: 0,
  lastArduinoLine: "",
  messagesSeen: 0,
  latestEvents: [],
};

const wsClients = new Set();
const pendingRequests = new Map();
let tcpSocket = null;
let nextRequestId = 1;

function jsonResponse(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function consumeBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Body too large"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

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
  if (message.type === "telemetry") {
    state.messagesSeen += 1;
    pushEvent(message);

    if (message.event === "workout_state") {
      const nextState = message.payload?.state;
      if (typeof nextState === "string" || typeof nextState === "number") {
        state.workoutState = toWorkoutStateCode(nextState, state.activeModeId);
        state.workoutStateAt = message.timestamp_ms || Date.now();
      }
    }

    if (message.event === "active_mode_changed") {
      const modeId = message.payload?.mode_id;
      if (typeof modeId === "number") {
        state.activeModeId = modeId;
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
}

function sendTcp(payload) {
  if (!tcpSocket || tcpSocket.destroyed) {
    return Promise.reject(new Error("TCP socket not connected"));
  }

  const requestId = nextRequestId++;
  const packet = { ...payload, request_id: requestId };

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error("Request timeout"));
    }, 8000);

    pendingRequests.set(requestId, { resolve, reject, timeout });

    tcpSocket.write(`${JSON.stringify(packet)}\n`, (err) => {
      if (err) {
        clearTimeout(timeout);
        pendingRequests.delete(requestId);
        reject(err);
      }
    });
  });
}

function connectTcp() {
  const socket = net.createConnection(
    { host: TCP_HOST, port: TCP_PORT },
    () => {
      tcpSocket = socket;
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
    tcpSocket = null;
    state.connectedToFeeder = false;
    state.authenticated = false;
    state.role = null;

    for (const [requestId, pendingReq] of pendingRequests.entries()) {
      clearTimeout(pendingReq.timeout);
      pendingReq.reject(new Error("TCP disconnected"));
      pendingRequests.delete(requestId);
    }

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

          if (message.type === "response" || message.type === "auth_response") {
            const reqId = Number(message.request_id);
            const pendingReq = pendingRequests.get(reqId);

            if (pendingReq) {
              clearTimeout(pendingReq.timeout);
              pendingRequests.delete(reqId);
              pendingReq.resolve(message);
            }
          } else {
            updateFromTelemetry(message);
            broadcast({ type: "telemetry", payload: message });
          }
        } catch (error) {
          console.warn(`[bridge] Ignoring non-JSON line: ${line}`);
        }
      }

      index = pending.indexOf("\n");
    }
  });
}

function logoutSession() {
  state.authenticated = false;
  state.role = null;
  broadcast({ type: "snapshot", payload: state });

  if (tcpSocket && !tcpSocket.destroyed) {
    tcpSocket.destroy();
  }
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  try {
    if (req.method === "GET" && req.url === "/snapshot") {
      jsonResponse(res, 200, state);
      return;
    }

    if (req.method === "POST" && req.url === "/auth") {
      const body = await consumeBody(req);
      const password = String(body.password || "");
      const response = await sendTcp({ type: "auth", password });

      if (response.ok) {
        state.authenticated = true;
        state.role = response.role || null;
      }

      jsonResponse(res, 200, response);
      broadcast({ type: "snapshot", payload: state });
      return;
    }

    if (req.method === "POST" && req.url === "/command") {
      const body = await consumeBody(req);
      const command = String(body.command || "");
      const args = body.args || {};

      if (!command) {
        jsonResponse(res, 400, { ok: false, error: "Missing command" });
        return;
      }

      const response = await sendTcp({ type: "command", command, args });
      jsonResponse(res, 200, response);
      return;
    }

    if (req.method === "POST" && req.url === "/logout") {
      logoutSession();
      jsonResponse(res, 200, { ok: true });
      return;
    }

    jsonResponse(res, 404, { error: "Not found" });
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      error: String(error.message || error),
    });
  }
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
