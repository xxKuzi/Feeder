# App for Basketball ball feeder(passer)

- running on Raspberry Pi 5 8GB
- project for local basketball club

## Motor control

- controlling one stepper motor and two rpm motors with GPIO pins

## Data Storage

- using SQLite database for profiles and shooting history

## BLE Communication

- integrated Bluetooth LE Peripheral to communicate with mobile app (FeederMini)

## Hardware Setup (Raspberry Pi + Arduino)

- Raspberry Pi runs the main app: Tauri (Rust backend + React frontend on touch display)
- Arduino handles real-time IO for:
  - `servo1` (main stopper near launcher)
  - `servo2` (feeder stopper from net to launcher)
  - 3 basket sensors (all crossed = scored basket)

### Why this split

- Keep Raspberry Pi focused on UI, workout logic, DB, BLE, and stepper station rotation
- Keep Arduino focused on precise servo timing and sensor reads
- Communication is USB serial between Pi and Arduino

### Arduino folder

- Sketch: [arduino/feeder_dual_servo_score/feeder_dual_servo_score.ino](arduino/feeder_dual_servo_score/feeder_dual_servo_score.ino)
- Protocol notes: [arduino/feeder_dual_servo_score/README.md](arduino/feeder_dual_servo_score/README.md)

### Fast serial test app (without Tauri reload)

- Standalone Rust CLI: [arduino-serial-tester](arduino-serial-tester)
- Run:
  - `cd arduino-serial-tester`
  - `cargo run -- --port /dev/ttyUSB0 --baud 115200`
- The tester can send commands and shows live basket points from `SCORE:<n>` messages.

### USB serial on Raspberry Pi

- Default serial path used by backend: `/dev/ttyUSB0`
- You can override with env variable:
  - `ARDUINO_PORT=/dev/ttyACM0`

### Command flow (current)

- `servo2` dispenses ball to `servo1` zone: `SERVO2_DISPENSE`
- `servo1` releases/stops for pass timing: `SERVO1_RELEASE` / `SERVO1_STOP`
- Arduino emits `SCORE:1` when all three sensors are crossed long enough
- Tauri updates basket points and emits `basket-score-updated` event to React
