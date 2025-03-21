#[cfg(target_os = "linux")]
pub mod servo_control {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration};

    #[derive(Debug)]
    pub struct ServoController {
        output_pin: OutputPin,  // Pin for servo pulses
        input_pin: InputPin,    // Limit switch for calibration
        direction_pin: OutputPin, // Pin to control direction
    }

    impl ServoController {
        /// Creates a new ServoController with the given GPIO pins.
        /// `output_pin_pin` is used for servo pulses,
        /// `input_pin_pin` for the limit switch,
        /// and `direction_pin_pin` for setting direction.
        pub fn new(output_pin_pin: u8, input_pin_pin: u8, direction_pin_pin: u8) -> Result<Self, String> {
            println!("Initializing stepper motor on output pin: {}, input pin: {}, direction pin: {}", output_pin_pin, input_pin_pin, direction_pin_pin);
            
            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let output_pin = gpio.get(output_pin_pin).map_err(|e| e.to_string())?.into_output();
            let input_pin = gpio.get(input_pin_pin).map_err(|e| e.to_string())?.into_input();
            let direction_pin = gpio.get(direction_pin_pin).map_err(|e| e.to_string())?.into_output();

            Ok(ServoController { output_pin, input_pin, direction_pin })
        }
    
        /// Sets the servo to the specified angle.
        pub fn set_angle(&mut self, angle: u8) {
            println!("Setting angle: {} degrees", angle);            
    
            // Map the angle (0-180) to pulse width (1ms to 2ms)
            let pulse_width = 1.0 + (angle as f32 / 18000.0) * 1.0; // pulse width in ms
            let duty = pulse_width * 1000.0; // Convert to microseconds
    
            // Activate servo pulse
            self.output_pin.set_high();
            thread::sleep(Duration::from_micros(duty as u64));
    
            // Complete cycle (20ms total)
            self.output_pin.set_low();
            thread::sleep(Duration::from_millis(20) - Duration::from_micros(duty as u64));
        }

        /// Reads the limit switch state.
        pub fn is_limit_switch_pressed(&self) -> bool {
            let pressed = !self.input_pin.is_high(); // Limit switch active when LOW
            println!("Limit switch state: {}", if pressed { "PRESSED" } else { "NOT PRESSED" });
            pressed
        }

        /// Rotates the servo for a given number of cycles.
        pub fn rotate_servo(&mut self, times: u32) {
            println!("Rotating stepper motor for {} times", times);
            for _ in 0..times {
                self.output_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.output_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }
        }

        /// Calibrates the servo by rotating until the limit switch is triggered.
        pub fn calibrate(&mut self) -> Result<String, String> {
            println!("Starting calibration...");

            while self.input_pin.is_low() { // Rotate until the limit switch is triggered
                self.output_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.output_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }

            println!("Calibration complete: Limit switch activated.");
            Ok("Calibration Complete".to_string())
        }

        /// Sets the direction pin to high or low.
        pub fn set_direction(&mut self, high: bool) {
            if high {
                self.direction_pin.set_high();
                println!("Direction pin set to HIGH");
            } else {
                self.direction_pin.set_low();
                println!("Direction pin set to LOW");
            }
        }
    }
    
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        let mut servo = ServoController::new(12, 16, 14)?; // Example: output: GPIO12, input: GPIO16, direction: GPIO14
        servo.set_angle(angle);
        Ok(format!("Servo set to {} degrees", angle))
    }

    #[tauri::command]
    pub fn rotate_servo(times: u32) -> Result<String, String> {
        let mut servo = ServoController::new(12, 16, 14)?;
        servo.rotate_servo(times);
        println!("Rotated servo");
        Ok(format!("Rotated servo {} times", times))
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        let mut servo = ServoController::new(12, 16, 14)?;
        servo.calibrate()
    }

    /// Changes the direction based on the provided state.
    /// Pass `true` for HIGH and `false` for LOW.
    #[tauri::command]
    pub fn change_direction(state: bool) -> Result<String, String> {
        let mut controller = ServoController::new(1, 2, 14)?;
        controller.set_direction(state);
        let status = if state { "HIGH" } else { "LOW" };
        Ok(format!("Direction pin set to {}", status))
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        // Example initialization with specific GPIO pins: output: GPIO6, input: GPIO13, direction: GPIO14
        let mut servo = ServoController::new(6, 13, 14)?;
    
        // Set the output pin HIGH to provide 3.3V
        servo.output_pin.set_high();
        println!("Output pin set to HIGH");
    
        // Allow time for the signal to stabilize
        thread::sleep(Duration::from_millis(100));
    
        // Confirm stable reading from the limit switch
        let mut detected_high = false;
        for _ in 0..5 {
            if servo.input_pin.is_high() {
                detected_high = true;
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
    
        let status = if detected_high {
            "NOT PRESSED (1)"  // Limit switch reads HIGH when not pressed
        } else {
            "PRESSED (0)" // Reads LOW when pressed
        };
    
        println!("Limit switch state: {}", status);
        Ok(format!("Limit switch is {}", status))
    }

}

#[cfg(not(target_os = "linux"))]
pub mod servo_control {

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        Err("Servo control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn rotate_servo(times: u32) -> Result<String, String> {
        println!("Rotating stepper motor for {} times", times);
        Err("Stepper motor control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn blink_led(times: u32) -> Result<String, String> {
        Err("Blinking not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        Err("Calibration not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn change_direction(_state: bool) -> Result<String, String> {
        Err("Direction control not supported on this platform".to_string())
    }
}
