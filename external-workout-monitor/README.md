# External Workout Monitor

This is a separate React app that shows live feeder telemetry and workout stats.

## What it shows

- Workout state (`running` / `paused`)
- Basket score updates
- Raw Arduino lines
- Live stream of all incoming telemetry events

## Remote control roles

- `user` role:
  - stop current workout
  - pick workout mode (`select_mode`)
  - view live telemetry
- `developer` role:
  - everything in `user`
  - start workout
  - edit profiles and modes
  - download full data export (profiles, records/history, modes, current state, accuracy summary)
  - change user/developer passwords

## Passwords and local secrets

Backend credentials are stored in `src-tauri/.remote-control.env` and ignored by git.

Example file:

```bash
cp src-tauri/.remote-control.env.example src-tauri/.remote-control.env
```

Then set strong values for:

- `REMOTE_USER_PASSWORD`
- `REMOTE_DEV_PASSWORD`

## How it works

1. The Tauri backend publishes newline-delimited JSON over local TCP (`127.0.0.1:7878`).
2. `bridge/server.js` connects to that TCP stream and opens:
   - WebSocket + HTTP bridge on `127.0.0.1:8787`
3. The React app (Vite) connects to the bridge and renders live data.

## Run

```bash
cd external-workout-monitor
npm install
npm run dev
```

## Environment variables (optional)

- `FEEDER_TCP_HOST` (default `127.0.0.1`)
- `FEEDER_TCP_PORT` (default `7878`)
- `MONITOR_BRIDGE_PORT` (default `8787`)
- `VITE_MONITOR_BRIDGE_URL` (default `ws://127.0.0.1:8787`)
- `VITE_MONITOR_HTTP_URL` (default `http://127.0.0.1:8787`)
