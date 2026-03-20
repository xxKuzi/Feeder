# Arduino: dual servo + 3 sensors

## What this sketch does

- Controls `servo1` (main stopper near launcher)
- Controls `servo2` (feeder stopper in net/funnel)
- Watches 3 analog sensors (`A3`, `A4`, `A5`) and sends `SCORE:1` over USB serial when **all 3 values are > 300**
- Samples sensors every `100 ms` (10x per second)

## USB serial protocol (from Raspberry Pi)

- `SERVO1_STOP`
- `SERVO1_RELEASE`
- `SERVO2_STOP`
- `SERVO2_RELEASE`
- `SERVO2_DISPENSE`
- `RESET_SCORE`
- `STATE?`
- Backward compatibility: `on` => `SERVO1_STOP`, `off` => `SERVO1_RELEASE`

## Serial settings

- Baud rate: `115200`
- Line endings: `\n`

## Notes

- Sensors are configured as analog `INPUT`.
- Trigger threshold is `300` (`ANALOG_TRIGGER_THRESHOLD` in sketch).
- Tune servo angles and dispense time in `feeder_dual_servo_score.ino` for your mechanics.
