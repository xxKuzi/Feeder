<h1 align="center">Feeder</h1>
<p align="center"><strong>A basketball ball passing machine, controlled by a touchscreen app — built for a local basketball club.</strong></p>

<p align="center">
  <img src="./docs/images/app-ui.webp" alt="Feeder touchscreen home screen showing Statistiky, Menu, and Manuální ovládání (manual control) cards" width="70%">
</p>

## What it is

A physical machine that passes/feeds basketballs to a player at a set angle,
distance, and interval, paired with an app that runs on a touchscreen bolted
to the machine. A coach or player picks a drill — two-pointers, three-pointers,
free throws, or a fully manual shot — and the machine repeats it as many
times as configured, logging makes and misses as it goes.

<table>
  <tr>
    <td width="50%"><img src="./docs/images/drills.webp" alt="Menu screen listing drill presets: Two Point, Three Point, Trojecky, Free throws"><p align="center"><sub>Preset drills, each with its own angle/distance/interval</sub></p></td>
    <td width="50%"><img src="./docs/images/manual-control.webp" alt="Manual control screen with sliders for repeat count, shooting interval, angle, and distance"><p align="center"><sub>Manual mode — dial in angle and distance directly</sub></p></td>
  </tr>
</table>

<p align="center">
  <img src="./docs/images/stats.webp" alt="Statistics screen showing shooting accuracy over today, 30 days, and 6 months with a monthly chart" width="70%">
</p>

## Hardware setup

The machine is split across two boards on purpose, each doing one job well:

- **Raspberry Pi 5** runs the actual app — Tauri, Rust backend, React frontend
  — on a touch display bolted to the machine. It owns the UI, workout logic,
  SQLite history, BLE, and driving the stepper motor that rotates the
  launcher to a station.
- An **Arduino** handles the two things that need to happen in real time and
  can't wait on a UI thread: firing two servos and reading three basket
  sensors. Keeping that off the Pi means servo timing doesn't jitter because
  React re-rendered something.

They talk over **USB serial at 115200 baud**, `\n`-terminated lines, default
path `/dev/ttyUSB0` (override with `ARDUINO_PORT`, e.g. `/dev/ttyACM0`). The
Arduino accepts `SERVO1_STOP` / `SERVO1_RELEASE`, `SERVO2_STOP` /
`SERVO2_RELEASE` / `SERVO2_DISPENSE`, `RESET_SCORE`, and `STATE?`; it polls
three analog sensors every 100ms and reports `SCORE:1` once all three read
above the trigger threshold long enough to count as a made basket. A shot
plays out as: `SERVO2_DISPENSE` feeds a ball into the launcher zone, then
`SERVO1_RELEASE`/`SERVO1_STOP` times the pass — and when a ball drops through
clean, the score event flows Arduino → Pi → a `basket-score-updated` event in
the React UI.

The Arduino sketch and full protocol notes live in
[`arduino/feeder_dual_servo_score`](./arduino/feeder_dual_servo_score). For
poking at the hardware without going through Tauri, there's a standalone Rust
CLI in [`arduino-serial-tester`](./arduino-serial-tester) — sends commands
and prints live `SCORE:<n>` events:

```bash
cd arduino-serial-tester
cargo run -- --port /dev/ttyUSB0 --baud 115200
```

## Features

- **Preset and manual drills** — angle, distance, repeat count, and shot interval, all configurable
- **Live shot-by-shot feedback** — motor speed, console angle, and time to next shot while a drill runs
- **Shooting history & stats** — daily/30-day/6-month accuracy, broken down per drill and per player
- **Bluetooth LE** peripheral mode to pair with the companion mobile app (FeederPocket / FeederMini)
- **On-screen keyboard** support, since the only input device is the touchscreen itself

## Tech stack

- **Tauri 2** (Rust backend + React 18 frontend) running on the Pi's touch display
- **SQLite** (via `tauri-plugin-sql`) — profiles and shooting history
- **Raspberry Pi GPIO** (`rppal`) — stepper motor control
- Custom **BLE peripheral** (`ble-peripheral-rust`) for the mobile companion app
- **Recharts** for the stats charts, **Tailwind CSS** for styling
- **Arduino** (C++) for servo + sensor real-time IO, talking over USB serial

## Running it locally

This targets Raspberry Pi hardware (GPIO, serial, BLE), so a full run needs
the actual machine. For UI development without the hardware attached:

```bash
git clone https://github.com/xxKuzi/Feeder.git
cd Feeder
npm install
npm run tauri dev
```

Serial calls to the Arduino will simply fail without a board attached on
`/dev/ttyUSB0` — that's expected when working on the UI alone. To exercise
the Arduino side independently, use the serial tester described above.

## License

No LICENSE file is committed to this repo. Shared for portfolio and viewing
purposes — add one if you want the terms explicit.
