<h1 align="center">Feeder</h1>
<p align="center"><strong>A Tauri (React + Rust) touchscreen controller for a custom basketball feeding machine, built for a local basketball club.</strong></p>

<p align="center">
  <a href="#screenshots">Screenshots</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#system-architecture">System Architecture</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#key-features">Key Features</a> &nbsp;&nbsp;·&nbsp;&nbsp; 
  <a href="#tech-stack">Tech Stack</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#environment">Environment</a> &nbsp;&nbsp;·&nbsp;&nbsp;
  <a href="#license">License</a>
</p>

<img src="./docs/images/app-ui.webp" alt="App interface">

---

## What it is

### App

**Feeder** is a React and Rust application that serves as the interactive control interface for an automated basketball passing machine. Built to make workouts more engaging and data-driven, the app lets players and coaches choose from pre-made or custom drills. It tracks shot performance in real time, logging makes and misses to a local SQLite database for easy data analysis.

---

### Hardware

The software runs on a Raspberry Pi 5 built directly into the machine's chassis. From the touchscreen, it controls hardware components to physical execution: driving stepper motors to adjust launching angles, triggering servos to handle ball dispensing, and reading laser sensors to detect incoming shots automatically.

<br>

## Screenshots

<table align="center">
  <tr>
    <td width="50%" align="center">
      <img src="./docs/images/workout.webp" alt="Workout screen">
    </td>
    <td width="50%" align="center">
      <img src="./docs/images/stats_cut.png" alt="Shooting statistics">
    </td>
    
  </tr>
</table>

## System Architecture

To ensure reliable, low-latency physical operation, the system is split across two controller boards:

- **Raspberry Pi 5 (The Brain)**: Runs the React/Tauri app on a touch display bolted to the machine. It manages the user interface, workout orchestration, SQLite historical logs, Bluetooth LE connectivity, and drives the stepper motor that rotates the launcher.
- **Arduino (The Real-Time Controller)**: Handles time-critical physical operations. It triggers the dual servos for dispensing and passing, and monitors three basket sensors. Offloading this from the Pi ensures that servo and sensor timings remain precise and unaffected by UI rendering or background database writes.

### Communication Protocol

The Pi and Arduino communicate over USB Serial (`115200` baud) using a lightweight command protocol:

- **Pi to Arduino**: Sends control instructions such as `SERVO1_STOP`/`SERVO1_RELEASE` (pass timing), `SERVO2_DISPENSE` (ball feed), and `RESET_SCORE`.
- **Arduino to Pi**: Broadcasts real-time events. The Arduino polls its analog sensors every 100ms and reports `SCORE:1` once a ball triggers the threshold, which the Pi's Tauri backend propagates to the React frontend as a `basket-score-updated` event.

The Arduino sketch and protocol documentation can be found in [`arduino/feeder_dual_servo_score`](./arduino/feeder_dual_servo_score).

For debugging serial communication without running the full Tauri application, a standalone Rust command-line tool is available in [`arduino-serial-tester`](./arduino-serial-tester):

```bash
cd arduino-serial-tester
cargo run -- --port /dev/ttyUSB0 --baud 115200
```

## Key Features

- **Drill Presets & Custom Routines**: Configure angle, distance, shot count, and passing interval dynamically.
- **Live Performance Feedback**: Displays real-time motor status, launcher angle, and a countdown timer for the next pass during active workouts.
- **Detailed History & Analytics**: Tracks historical makes, misses, and accuracy charts (today, 30 days, 6 months) for individual player profiles.
- **Wifi Sync**: Acts as a Wifi hotspot for remote workout control and workout data sync with FeederPocket mobile app.
- **Embedded Touch Keyboard**: Integrated React on-screen keyboard support designed for headless touchscreens without physical peripherals.

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Recharts (data visualization)
- **Desktop/Embedded Wrapper**: Tauri 2 (Rust backend)
- **Local Storage**: SQLite (via `tauri-plugin-sql`)
- **Hardware Integration**: Raspberry Pi GPIO control via `rppal`, USB Serial communication
- **Connectivity**: WiFi TCP Server + Bluetooth LE peripheral (`ble-peripheral-rust`) for mobile integration
- **Real-Time Controller**: Arduino (C++ / Arduino IDE)

## Running Locally

Because the project relies on specific Raspberry Pi GPIO, serial ports, and BLE hardware, running the full stack requires the physical machine. However, the user interface can be run in mock mode for UI development:

1. Clone the repository:
   ```bash
   git clone https://github.com/xxKuzi/Feeder.git
   cd Feeder
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the two environment files — see [Environment](#environment) below. The
   app refuses to start until both exist and the placeholder passwords are
   replaced.

There are two ways to run from here.

**Development:**

```bash
npm run tauri dev
```

Vite serves the frontend with hot reload. In this mode the app does _not_ start
the FeederPocket bridge — run that yourself from the FeederPocket repo if you
want the phone app.

**Production:**

```bash
npm run tauri build
./src-tauri/target/release/feeder
```

The release binary serves the built frontend and starts the FeederPocket bridge
as a child process, so the phone app comes up on its own.

_Note: Serial communication calls to `/dev/ttyUSB0` will fail gracefully if no Arduino is connected, allowing you to develop and test UI features independently._

## Environment

Two files, both required, both gitignored. Create them from the `.example`
versions that ship with the repo:

```bash
cp .env.example .env
cp src-tauri/.remote-control.env.example src-tauri/.remote-control.env
```

Then open both and replace every `xxx` — the app errors out on startup if a
password is still the placeholder.

**`.env`** (repo root) — read at runtime by the Rust backend and handed to the
frontend through the `get_feeder_env` command. Despite the `VITE_` prefixes
these are not build-time Vite variables, so a change takes effect on restart
without a rebuild.

| Variable                  | Required | Default | What it does                                                             |
| ------------------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `DEVELOPER_MODE_PASSWORD` | yes      | —       | Unlocks developer mode on the touchscreen. Cannot be `xxx`.              |
| `VITE_APP_LOCKED`         | no       | `false` | Locks the machine. Written back to this file by the remote lock command. |
| `VITE_ALWAYS_CALIBRATE`   | no       | `false` | Force calibration on every start.                                        |
| `VITE_LOW_SPEC`           | no       | `true`  | Lighter UI for weaker hardware. Set `false` on high-end devices.         |

**`src-tauri/.remote-control.env`** — the credentials [FeederPocket](../FeederPocket)
checks when a phone logs in over TCP.

| Variable               | Required | Default | What it does                                                       |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------ |
| `REMOTE_USER_PASSWORD` | yes      | —       | Phone login, view plus limited control. Cannot be `xxx`.           |
| `REMOTE_DEV_PASSWORD`  | yes      | —       | Phone login, full developer access. Cannot be `xxx`.               |
| `START_POCKET_BRIDGE`  | no       | on      | Set `0` or `false` to stop the release build launching the bridge. |

`ARDUINO_PORT` is read from the process environment only, not from either file.
It overrides the serial port, which defaults to `/dev/ttyUSB0`.

### Where to put the files

Leave them where the `cp` commands above put them:

```
Feeder/
├── .env
└── src-tauri/
    └── .remote-control.env
```

That works for `tauri dev`, and for the release binary.

Also you can run it from the repo root (`./src-tauri/target/release/feeder`).

You only need to move them when the binary runs on its own, away from the repo
— a bundled `.app`, or the executable copied onto the Pi. Then put both next to
the executable, since that is the first place the app looks:

```bash
cp .env src-tauri/.remote-control.env <folder containing the executable>/
```

The build never copies them for you, so a fresh `target/` will not have them.

The full search order, first hit wins:

- `.env` — the executable's folder, then the working directory, then its parent.
- `.remote-control.env` — the executable's folder, then the working directory,
  then `<working directory>/src-tauri/`, then the parent.

## License

This repository is shared for portfolio and educational viewing purposes only. You are welcome to clone and execute the project locally to evaluate how it works. However, no permission is granted to modify, redistribute, or incorporate this code into other repositories or software. See [LICENSE](./LICENSE).
