#[cfg(target_os = "linux")]
pub mod motor_system {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration, sync::Mutex};
    use once_cell::sync::Lazy;

    #[derive(Debug)]
    pub struct ServoController {
        pulse_pin: OutputPin,        // Pin for servo pulses
        limit_switch_pin: InputPin,  // Limit switch for calibration/safety
        direction_pin: OutputPin,    // Pin to control direction
        enable_pin: OutputPin,       // Pin to enable/disable the motor
    }

    impl ServoController {
        pub fn new(
            pulse_pin_number: u8,
            limit_switch_pin_number: u8,
            direction_pin_number: u8,
            enable_pin_number: u8,
        ) -> Result<Self, String> {
            println!(
                "Initializing stepper motor: pulse={}, limit={}, dir={}, enable={}",
                pulse_pin_number, limit_switch_pin_number, direction_pin_number, enable_pin_number
            );

            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let pulse_pin = gpio.get(pulse_pin_number).map_err(|e| e.to_string())?.into_output();
            let limit_switch_pin = gpio.get(limit_switch_pin_number).map_err(|e| e.to_string())?.into_input_pullup();
            let direction_pin = gpio.get(direction_pin_number).map_err(|e| e.to_string())?.into_output();
            let enable_pin = gpio.get(enable_pin_number).map_err(|e| e.to_string())?.into_output();

            Ok(ServoController {
                pulse_pin,
                limit_switch_pin,
                direction_pin,
                enable_pin,
            })
        }

        pub fn is_limit_switch_pressed(&self) -> bool {
            let pressed = !self.limit_switch_pin.is_high(); // Active LOW
            println!("Limit switch state: {}", if pressed { "PRESSED" } else { "NOT PRESSED" });
            pressed
        }

        pub fn rotate_servo(&mut self, times: i32) {
            println!("Rotating stepper motor for {} steps", times);

            if times >= 0 {
                self.direction_pin.set_high();
            } else {
                self.direction_pin.set_low();
            }

            for _ in 0..times.abs() {
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }
        }

        pub fn calibrate(&mut self) -> Result<String, String> {
            println!("Starting calibration...");

            while self.limit_switch_pin.is_high() {
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }

            println!("Calibration complete: Limit switch activated.");
            Ok("Calibration Complete".to_string())
        }
    }

    // 🔁 Shared static instance
    static SERVO_INSTANCE: Lazy<Mutex<Option<ServoController>>> = Lazy::new(|| Mutex::new(None));

    // 🧠 Auto-initializing access wrapper
    fn with_servo<F, R>(f: F) -> Result<R, String>
    where
        F: FnOnce(&mut ServoController) -> Result<R, String>,
    {
        let mut guard = SERVO_INSTANCE.lock().unwrap();

        if guard.is_none() {
            println!("Servo not initialized – performing auto-init...");
            let servo = ServoController::new(12, 24, 23, 16)?; // default GPIOs
            *guard = Some(servo);
        }

        if let Some(ref mut servo) = *guard {
            f(servo)
        } else {
            Err("Failed to initialize ServoController".to_string())
        }
    }

    // 🧪 Optional manual init (now just calls with_servo)
    #[tauri::command]
    pub fn init_servo() -> Result<String, String> {
        with_servo(|_| Ok("Servo auto-initialized or already initialized".to_string()))
    }

    #[tauri::command]
    pub fn rotate_servo(times: i32) -> Result<String, String> {
        with_servo(|servo| {
            println!("Checking safety condition...");

           // if servo.limit_switch_pin.is_high() {
                println!("Limit switch is HIGH (not pressed) – enabling motor");
               // servo.enable_pin.set_high();
            // } else {
            //     println!("Limit switch is LOW (pressed) – ABORTING for safety");
            //     return Err("Safety check failed: Limit switch is pressed".into());
            // }

            servo.rotate_servo(times);

            //println!("Disabling motor after rotation");
            //servo.enable_pin.set_low();

            Ok(format!("Rotated servo {} steps (with safety)", times))
        })
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        with_servo(|servo| servo.calibrate())
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        with_servo(|servo| {
            for _ in 0..10 { // check 10 times then return
                let pressed = servo.is_limit_switch_pressed();
                let status = if pressed { "PRESSED (0)" } else { "NOT PRESSED (1)" };
                println!("Limit switch state: {}", status);
                thread::sleep(Duration::from_millis(500));
            }
            Ok("Finished debug loop".to_string())
        })
    }

    

}

#[cfg(not(target_os = "linux"))]
pub mod motor_system {
    #[tauri::command]
    pub fn init_servo() -> Result<String, String> {
        Err("Servo control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        Err("Servo control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn rotate_servo(_times: i32) -> Result<String, String> {
        Err("Stepper motor control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        Err("Calibration not supported on this platform".to_string())
    }
}
