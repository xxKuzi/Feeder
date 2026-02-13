use rppal::gpio::{Gpio, InputPin, OutputPin};
use rppal::pwm::{Channel, Polarity, Pwm};
use serialport::SerialPort;
use std::env;
use std::io::{self, Read, Write};
use std::thread;
use std::time::{Duration, Instant};

struct Pins {
    pulse: OutputPin,
    limit_1: InputPin,
    limit_2: InputPin,
    direction: OutputPin,
    enable: OutputPin,
}

impl Pins {
    fn new(pulse: u8, limit_1: u8, limit_2: u8, direction: u8, enable: u8) -> Result<Self, String> {
        let gpio = Gpio::new().map_err(|e| e.to_string())?;
        Ok(Self {
            pulse: gpio.get(pulse).map_err(|e| e.to_string())?.into_output(),
            limit_1: gpio.get(limit_1).map_err(|e| e.to_string())?.into_input_pullup(),
            limit_2: gpio.get(limit_2).map_err(|e| e.to_string())?.into_input_pullup(),
            direction: gpio.get(direction).map_err(|e| e.to_string())?.into_output(),
            enable: gpio.get(enable).map_err(|e| e.to_string())?.into_output(),
        })
    }

    fn log_limit_states(&self) {
        let state1 = if self.limit_1.is_low() { "LOW (PRESSED)" } else { "HIGH (NOT PRESSED)" };
        let state2 = if self.limit_2.is_low() { "LOW (PRESSED)" } else { "HIGH (NOT PRESSED)" };
        println!("Limit switch 1: {} | Limit switch 2: {}", state1, state2);
    }

    fn any_limit_pressed(&self) -> bool {
        self.limit_1.is_low() || self.limit_2.is_low()
    }
}

fn env_u8(name: &str, default: u8) -> u8 {
    env::var(name)
        .ok()
        .and_then(|v| v.parse::<u8>().ok())
        .unwrap_or(default)
}

fn open_serial_port() -> Result<Box<dyn SerialPort>, String> {
    let port_path = env::var("ARDUINO_PORT").unwrap_or_else(|_| "/dev/ttyUSB0".to_string());
    println!("Opening Arduino serial port: {}", port_path);
    let port = serialport::new(&port_path, 9600)
        .timeout(Duration::from_millis(200))
        .open()
        .map_err(|e| format!("Failed to open serial port: {e}"))?;

    println!("Waiting for Arduino boot...");
    thread::sleep(Duration::from_millis(2000));
    Ok(port)
}

fn send_arduino_command(port: &mut Box<dyn SerialPort>, command: &str) -> Result<(), String> {
    println!("Sending Arduino command: '{}'", command);
    let cmd_with_newline = format!("{}\n", command);
    port.write_all(cmd_with_newline.as_bytes())
        .map_err(|e| format!("Write failed: {e}"))?;
    port.flush().map_err(|e| format!("Flush failed: {e}"))?;

    let mut buffer = vec![0u8; 256];
    if let Ok(n) = port.read(&mut buffer) {
        if n > 0 {
            let msg = String::from_utf8_lossy(&buffer[..n]);
            println!("Arduino: {}", msg.trim());
        }
    }
    Ok(())
}

fn rotate_stepper(pins: &mut Pins, steps: i32, safety: bool) -> Result<(), String> {
    println!("Rotate request: steps={} safety={}", steps, safety);
    pins.enable.set_low();

    if safety && pins.any_limit_pressed() {
        pins.log_limit_states();
        return Err("Aborted: limit switch already pressed".to_string());
    }

    if steps >= 0 {
        pins.direction.set_high();
    } else {
        pins.direction.set_low();
    }

    let total_steps = steps.abs() as u32;
    let accel_steps = 200.min(total_steps / 2);
    let max_delay = 1000u64;
    let min_delay = 469u64;
    let start_time = Instant::now();

    println!("Starting rotation: total_steps={}", total_steps);
    for i in 0..total_steps {
        if safety && pins.any_limit_pressed() {
            println!("Limit triggered during rotation at step {}", i);
            pins.log_limit_states();
            return Ok("Stopped early due to limit switch".to_string());
        }

        let delay = if i < accel_steps {
            let ratio = i as f64 / accel_steps.max(1) as f64;
            max_delay as f64 - ratio * (max_delay - min_delay) as f64
        } else if i >= total_steps.saturating_sub(accel_steps) {
            let ratio = (total_steps - i) as f64 / accel_steps.max(1) as f64;
            max_delay as f64 - ratio * (max_delay - min_delay) as f64
        } else {
            min_delay as f64
        } as u64;

        pins.pulse.set_high();
        thread::sleep(Duration::from_micros(delay));
        pins.pulse.set_low();
        thread::sleep(Duration::from_micros(delay));

        if i % 500 == 0 {
            println!("Step {}/{} (delay={}us)", i, total_steps, delay);
        }
    }

    println!("Rotation complete in {:?}", start_time.elapsed());
    Ok("Rotation complete".to_string())
}

fn calibrate(pins: &mut Pins) -> Result<(), String> {
    println!("Calibration start");
    pins.enable.set_low();
    pins.direction.set_low();
    let start = Instant::now();

    let mut steps = 0u32;
    while !pins.any_limit_pressed() {
        pins.pulse.set_high();
        thread::sleep(Duration::from_micros(1000));
        pins.pulse.set_low();
        thread::sleep(Duration::from_micros(1000));
        steps += 1;

        if steps % 1000 == 0 {
            println!("Calibration steps: {}", steps);
            pins.log_limit_states();
        }
    }

    println!("Calibration complete after {} steps in {:?}", steps, start.elapsed());
    pins.log_limit_states();
    Ok("Calibration complete".to_string())
}

fn setup_servo_pwm() -> Result<Pwm, String> {
    let pwm = Pwm::with_frequency(Channel::Pwm1, 50.0, 0.075, Polarity::Normal, true)
        .map_err(|e| e.to_string())?;
    Ok(pwm)
}

fn move_servo_pwm(angle: u8, duration_ms: u64) -> Result<(), String> {
    let pwm = setup_servo_pwm()?;
    let duty = 0.025 + (angle.clamp(0, 180) as f64 / 180.0) * 0.10;
    println!("Servo PWM: angle={} duty={}", angle, duty);
    pwm.set_duty_cycle(duty).map_err(|e| e.to_string())?;
    thread::sleep(Duration::from_millis(duration_ms));
    Ok(())
}

fn print_help() {
    println!("Commands:");
    println!("  help                          Show this help");
    println!("  status                        Read limit switch states");
    println!("  rotate <steps> <safety>       Rotate stepper (safety: true/false)");
    println!("  calibrate                     Run calibration until limit switch");
    println!("  servo-pwm <angle> <ms>        Move Pi PWM servo (angle 0-180)");
    println!("  arduino on|off                 Send Arduino command via USB");
    println!("  quit                          Exit");
}

fn main() {
    let pulse = env_u8("PULSE_PIN", 12);
    let limit_1 = env_u8("LIMIT_PIN_1", 24);
    let limit_2 = env_u8("LIMIT_PIN_2", 1);
    let direction = env_u8("DIR_PIN", 23);
    let enable = env_u8("EN_PIN", 16);

    println!("Motor test starting with pins:");
    println!("  pulse={} limit_1={} limit_2={} dir={} enable={}", pulse, limit_1, limit_2, direction, enable);

    let mut pins = match Pins::new(pulse, limit_1, limit_2, direction, enable) {
        Ok(p) => p,
        Err(e) => {
            println!("Failed to init GPIO: {}", e);
            return;
        }
    };
    pins.log_limit_states();

    let mut arduino_port: Option<Box<dyn SerialPort>> = None;

    print_help();
    let stdin = io::stdin();
    let mut input = String::new();

    loop {
        input.clear();
        print!("> ");
        if io::stdout().flush().is_err() {
            println!("Failed to flush stdout");
        }
        if stdin.read_line(&mut input).unwrap_or(0) == 0 {
            continue;
        }
        let line = input.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        match parts[0] {
            "help" => print_help(),
            "status" => pins.log_limit_states(),
            "rotate" => {
                if parts.len() < 3 {
                    println!("Usage: rotate <steps> <safety>");
                    continue;
                }
                let steps = parts[1].parse::<i32>().unwrap_or(0);
                let safety = parts[2].parse::<bool>().unwrap_or(true);
                match rotate_stepper(&mut pins, steps, safety) {
                    Ok(msg) => println!("{}", msg),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "calibrate" => match calibrate(&mut pins) {
                Ok(msg) => println!("{}", msg),
                Err(e) => println!("Error: {}", e),
            },
            "servo-pwm" => {
                if parts.len() < 3 {
                    println!("Usage: servo-pwm <angle> <ms>");
                    continue;
                }
                let angle = parts[1].parse::<u8>().unwrap_or(0);
                let ms = parts[2].parse::<u64>().unwrap_or(1000);
                match move_servo_pwm(angle, ms) {
                    Ok(()) => println!("Servo PWM move complete"),
                    Err(e) => println!("Error: {}", e),
                }
            }
            "arduino" => {
                if parts.len() < 2 {
                    println!("Usage: arduino on|off");
                    continue;
                }
                if arduino_port.is_none() {
                    match open_serial_port() {
                        Ok(p) => arduino_port = Some(p),
                        Err(e) => {
                            println!("Error: {}", e);
                            continue;
                        }
                    }
                }
                let cmd = parts[1];
                if let Some(port) = arduino_port.as_mut() {
                    if let Err(e) = send_arduino_command(port, cmd) {
                        println!("Error: {}", e);
                    }
                }
            }
            "quit" | "exit" => break,
            _ => println!("Unknown command. Type 'help'."),
        }
    }

    println!("Exiting motor test");
}
