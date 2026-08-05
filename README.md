<h1 align="center">Feeder</h1>
<p align="center"><strong>A React + Tauri touchscreen controller for a custom basketball feeding machine, built for a local basketball club.</strong></p>

---

## What it is

**Feeder** is the touchscreen application that powers a custom-built, automated basketball passing machine. Running on a Raspberry Pi 5 bolted directly to the machine's chassis, the app serves as the system's control center: it coordinates stepper motors to adjust launching angles, triggers physical servos to dispense and pass basketballs, reads laser sensors to log shots, and tracks player performance metrics.

Rather than treating the touchscreen as a simple visual display, the app runs a full React + Tauri environment that makes the machine interactive. Players and coaches can select preset drills (two-pointers, three-pointers, free throws) or customize manual routines. The software logs makes and misses in real time, storing workout sessions in a local SQLite database for historical analytics.

## Screenshots

<table align="center">
  <tr>
    <td width="50%">
      <img src="./docs/images/app-ui.webp" alt="Home Dashboard">
      <p align="center"><sub>Home Dashboard & Navigation</sub></p>
    </td>
    <td width="50%">
      <img src="./docs/images/drills.webp" alt="Drills Selection">
      <p align="center"><sub>Drill Presets (Two-point, Three-point, Free throws)</sub></p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./docs/images/manual-control.webp" alt="Manual Control">
      <p align="center"><sub>Manual Mode (Angle, Distance & Interval Sliders)</sub></p>
    </td>
    <td width="50%">
      <img src="./docs/images/stats.webp" alt="Shooting Statistics">
      <p align="center"><sub>Session Stats & Historical Accuracy Charts</sub></p>
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
- **Live Performance Feedback**: Displays motor status, current launcher angle, and a countdown timer for the next pass during active workouts.
- **Detailed History & Analytics**: Tracks historical makes, misses, and accuracy charts (today, 30 days, 6 months) for individual player profiles.
- **Bluetooth LE Sync**: Acts as a BLE peripheral to sync workouts and profiles with companion mobile apps (FeederPocket / FeederMini).
- **Embedded Touch Keyboard**: Integrated on-screen keyboard support designed for headless touchscreens without physical peripherals.

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Recharts (data visualization)
- **Desktop/Embedded Wrapper**: Tauri 2 (Rust backend)
- **Local Storage**: SQLite (via `tauri-plugin-sql`)
- **Hardware Integration**: Raspberry Pi GPIO control via `rppal`, USB Serial communication
- **Connectivity**: Bluetooth LE peripheral (`ble-peripheral-rust`) for mobile integration
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
3. Run the Tauri development server:
   ```bash
   npm run tauri dev
   ```

*Note: Serial communication calls to `/dev/ttyUSB0` will fail gracefully if no Arduino is connected, allowing you to develop and test UI features independently.*

## License

This repository is shared for portfolio and review purposes. No formal license is included; please contact the author if you wish to reuse or modify the source code.
