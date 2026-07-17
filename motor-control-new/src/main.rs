use std::env;
use std::thread;
use std::time::{Duration, Instant};

#[cfg(target_os = "linux")]
use rppal::gpio::{Gpio, InputPin, OutputPin};

// --------------------- LINUX PIN IMPLEMENTATION ---------------------
#[cfg(target_os = "linux")]
struct Pins {
    pulse: OutputPin,
    limit_1: InputPin, // GPIO 24 - Right limit switch
    limit_2: InputPin, // GPIO 1 - Left limit switch
    direction: OutputPin,
    enable: OutputPin,
}

#[cfg(target_os = "linux")]
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

    fn print_status(&self) {
        let state1 = if self.limit_1.is_low() { "PRESSED (LOW)" } else { "NOT PRESSED (HIGH)" };
        let state2 = if self.limit_2.is_low() { "PRESSED (LOW)" } else { "NOT PRESSED (HIGH)" };
        println!("Limit Switch 1 (GPIO 24 / Right): {}", state1);
        println!("Limit Switch 2 (GPIO 1 / Left):   {}", state2);
    }

    fn is_limit_1_pressed(&self) -> bool {
        self.limit_1.is_low()
    }

    fn is_limit_2_pressed(&self) -> bool {
        self.limit_2.is_low()
    }

    fn is_any_limit_pressed(&self) -> bool {
        self.limit_1.is_low() || self.limit_2.is_low()
    }

    fn set_enable_low(&mut self) {
        self.enable.set_low();
    }

    fn set_direction_high(&mut self) {
        self.direction.set_high();
    }

    fn set_direction_low(&mut self) {
        self.direction.set_low();
    }

    fn pulse_high(&mut self) {
        self.pulse.set_high();
    }

    fn pulse_low(&mut self) {
        self.pulse.set_low();
    }
}

// --------------------- MOCK IMPLEMENTATION (NON-LINUX) ---------------------
#[cfg(not(target_os = "linux"))]
struct Pins {
    limit_1_pressed: bool,
    limit_2_pressed: bool,
}

#[cfg(not(target_os = "linux"))]
impl Pins {
    fn new(_pulse: u8, _limit_1: u8, _limit_2: u8, _direction: u8, _enable: u8) -> Result<Self, String> {
        println!("[MOCK] Initialized mock Pins (Simulated on macOS/Windows/etc.)");
        Ok(Self {
            limit_1_pressed: false, // Default simulated states
            limit_2_pressed: false,
        })
    }

    fn print_status(&self) {
        let state1 = if self.limit_1_pressed { "PRESSED (LOW)" } else { "NOT PRESSED (HIGH)" };
        let state2 = if self.limit_2_pressed { "PRESSED (LOW)" } else { "NOT PRESSED (HIGH)" };
        println!("[MOCK] Limit Switch 1 (GPIO 24 / Right): {}", state1);
        println!("[MOCK] Limit Switch 2 (GPIO 1 / Left):   {}", state2);
    }

    fn is_limit_1_pressed(&self) -> bool {
        self.limit_1_pressed
    }

    fn is_limit_2_pressed(&self) -> bool {
        self.limit_2_pressed
    }

    fn is_any_limit_pressed(&self) -> bool {
        self.limit_1_pressed || self.limit_2_pressed
    }

    fn set_enable_low(&mut self) {
        println!("[MOCK] Set ENABLE pin LOW (motor powered)");
    }

    fn set_direction_high(&mut self) {
        println!("[MOCK] Set DIRECTION pin HIGH (Clockwise/Right)");
    }

    fn set_direction_low(&mut self) {
        println!("[MOCK] Set DIRECTION pin LOW (Counter-Clockwise/Left)");
    }

    fn pulse_high(&mut self) {}
    fn pulse_low(&mut self) {}
}

// --------------------- GENERAL FUNCTIONS ---------------------

fn print_help() {
    println!("Usage:");
    println!("  motor-control-new rotate <degrees> [--no-safety]   Rotate motor by degrees (e.g. 15 or -15)");
    println!("  motor-control-new calibrate                        Run calibration routine to home the motor");
    println!("  motor-control-new status                           Print limit switch pin states");
}

fn rotate_stepper(pins: &mut Pins, steps: i32, safety: bool) -> Result<(), String> {
    println!("Enabling motor and starting rotation of {} steps (safety: {})...", steps, safety);
    pins.set_enable_low();

    if safety && pins.is_any_limit_pressed() {
        pins.print_status();
        return Err("Aborted: limit switch is already pressed".to_string());
    }

    if steps >= 0 {
        pins.set_direction_high();
    } else {
        pins.set_direction_low();
    }

    let total_steps = steps.abs() as u32;
    let accel_steps = 200.min(total_steps / 2);
    let max_delay = 1000f64;
    let min_delay = 469f64;
    let start_time = Instant::now();

    for i in 0..total_steps {
        if safety && pins.is_any_limit_pressed() {
            println!("\n⚠️ Limit switch triggered at step {}! Stopping rotation.", i);
            pins.print_status();
            return Err("Stopped early due to limit switch".to_string());
        }

        let delay = if i < accel_steps {
            let ratio = i as f64 / accel_steps.max(1) as f64;
            max_delay - ratio * (max_delay - min_delay)
        } else if i >= total_steps.saturating_sub(accel_steps) {
            let ratio = (total_steps - i) as f64 / accel_steps.max(1) as f64;
            max_delay - ratio * (max_delay - min_delay)
        } else {
            min_delay
        } as u64;

        pins.pulse_high();
        thread::sleep(Duration::from_micros(delay));
        pins.pulse_low();
        thread::sleep(Duration::from_micros(delay));

        if i > 0 && i % 500 == 0 {
            print!("\rProgress: {}/{} steps...", i, total_steps);
            let _ = std::io::Write::flush(&mut std::io::stdout());
        }
    }

    println!("\rCompleted {} steps successfully in {:?}", total_steps, start_time.elapsed());
    Ok(())
}

fn calibrate(pins: &mut Pins) -> Result<(), String> {
    println!("Starting calibration...");
    pins.set_enable_low();

    const STEP_DELAY_US: u64 = 1000;
    const MAX_RELEASE_STEPS: u32 = 25_000;
    const MAX_HOME_STEPS: u32 = 60_000;

    if pins.is_limit_1_pressed() && pins.is_limit_2_pressed() {
        return Err("Calibration failed: both limit switches are pressed.".to_string());
    }

    let end_place: &str;

    if pins.is_limit_1_pressed() {
        // Right switch (GPIO 24) is pressed -> move LEFT (LOW) to release it.
        println!("Right limit switch is pressed. Moving left to release it...");
        pins.set_direction_low();
        let mut steps = 0u32;

        while pins.is_limit_1_pressed() && steps < MAX_RELEASE_STEPS {
            pins.pulse_high();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            pins.pulse_low();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            steps += 1;
        }

        if pins.is_limit_1_pressed() {
            return Err("Calibration failed: right limit switch stayed pressed while moving left.".to_string());
        }

        println!("Released right switch after {} steps. Searching for left limit switch...", steps);
        let mut steps_to_home = 0u32;
        pins.set_direction_low();
        while !pins.is_limit_2_pressed() && steps_to_home < MAX_HOME_STEPS {
            pins.pulse_high();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            pins.pulse_low();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            steps_to_home += 1;
        }

        if !pins.is_limit_2_pressed() {
            return Err("Calibration failed: left limit switch not reached within expected travel.".to_string());
        }
        end_place = "left";
        println!("Hit left limit switch after {} steps.", steps_to_home);
    } else if pins.is_limit_2_pressed() {
        // Left switch (GPIO 1) is pressed -> move RIGHT (HIGH) to release it.
        println!("Left limit switch is pressed. Moving right to release it...");
        pins.set_direction_high();
        let mut steps = 0u32;

        while pins.is_limit_2_pressed() && steps < MAX_RELEASE_STEPS {
            pins.pulse_high();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            pins.pulse_low();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            steps += 1;
        }

        if pins.is_limit_2_pressed() {
            return Err("Calibration failed: left limit switch stayed pressed while moving right.".to_string());
        }

        println!("Released left switch after {} steps. Searching for right limit switch...", steps);
        let mut steps_to_home = 0u32;
        pins.set_direction_high();
        while !pins.is_limit_1_pressed() && steps_to_home < MAX_HOME_STEPS {
            pins.pulse_high();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            pins.pulse_low();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            steps_to_home += 1;
        }

        if !pins.is_limit_1_pressed() {
            return Err("Calibration failed: right limit switch not reached within expected travel.".to_string());
        }
        end_place = "right";
        println!("Hit right limit switch after {} steps.", steps_to_home);
    } else {
        // Neither switch is pressed - move left until one is hit.
        println!("No limit switch pressed. Moving left to find a limit switch...");
        pins.set_direction_low();
        let mut steps = 0u32;

        // On mock platforms, simulate hitting limit switch after 1000 steps so the routine completes.
        #[cfg(not(target_os = "linux"))]
        let mock_trigger_steps = 1000;

        while !pins.is_limit_1_pressed() && !pins.is_limit_2_pressed() && steps < MAX_HOME_STEPS {
            #[cfg(not(target_os = "linux"))]
            if steps >= mock_trigger_steps {
                pins.limit_2_pressed = true; // Simulating hitting left switch
            }

            pins.pulse_high();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            pins.pulse_low();
            thread::sleep(Duration::from_micros(STEP_DELAY_US));
            steps += 1;
        }

        if !pins.is_limit_1_pressed() && !pins.is_limit_2_pressed() {
            return Err("Calibration failed: no limit switch reached within expected travel.".to_string());
        }

        if pins.is_limit_2_pressed() {
            end_place = "left";
            println!("Hit left limit switch after {} steps.", steps);
        } else if pins.is_limit_1_pressed() {
            end_place = "right";
            println!("Hit right limit switch after {} steps.", steps);
        } else {
            return Err("Calibration failed: end place could not be determined.".to_string());
        }
    }

    println!("Calibration complete: homed on the {} side.", end_place);
    Ok(())
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_help();
        std::process::exit(1);
    }

    // Default GPIO pins matching Tauri app config
    let pulse = 12;
    let limit_1 = 24;
    let limit_2 = 1;
    let direction = 23;
    let enable = 16;

    let mut pins = match Pins::new(pulse, limit_1, limit_2, direction, enable) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Failed to initialize GPIO pins: {}", e);
            std::process::exit(1);
        }
    };

    match args[1].as_str() {
        "rotate" => {
            if args.len() < 3 {
                eprintln!("Error: Missing degrees argument.");
                print_help();
                std::process::exit(1);
            }
            let degrees = match args[2].parse::<f64>() {
                Ok(d) => d,
                Err(_) => {
                    eprintln!("Error: Invalid degrees value '{}'.", args[2]);
                    std::process::exit(1);
                }
            };
            let mut safety = true;
            if args.len() >= 4 && args[3] == "--no-safety" {
                safety = false;
            }

            // Convert degrees to steps using the Tauri frontend formula:
            // times = Math.round((6400 / 360) * degrees * 3)
            let steps = ((6400.0 / 360.0) * degrees * 3.0).round() as i32;
            println!("Converting {} degrees to {} steps...", degrees, steps);

            if let Err(e) = rotate_stepper(&mut pins, steps, safety) {
                eprintln!("Rotation failed: {}", e);
                std::process::exit(1);
            }
        }
        "calibrate" => {
            if let Err(e) = calibrate(&mut pins) {
                eprintln!("Calibration failed: {}", e);
                std::process::exit(1);
            }
        }
        "status" => {
            pins.print_status();
        }
        _ => {
            eprintln!("Error: Unknown command '{}'.", args[1]);
            print_help();
            std::process::exit(1);
        }
    }
}
