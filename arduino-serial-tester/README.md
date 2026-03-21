# Arduino Serial Tester (Standalone Rust)

Small CLI tool for fast Arduino testing without reloading Tauri.

## Features

- Sends commands to Arduino over USB serial
- Receives and prints all incoming messages
- Tracks basket points from incoming `SCORE:<n>` messages
- Works with your existing Arduino protocol

## Run

```bash
cd arduino-serial-tester
cargo run -- --port /dev/ttyUSB0 --baud 115200
```

You can also set env vars:

```bash
export ARDUINO_PORT=/dev/ttyUSB0
export ARDUINO_BAUD=115200
cargo run
```

## Arduino commands you can type

- `SERVO1_STOP`
- `SERVO1_RELEASE`
- `SERVO2_STOP`
- `SERVO2_RELEASE`
- `SERVO2_DISPENSE`
- `RESET_SCORE`
- `STATE?`
- `PING`

## Local tester commands

- `points` -> print current local basket points
- `reset_local` -> reset local points counter only
- `help` -> print command help
- `quit` -> exit tool
