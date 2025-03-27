#[cfg(target_os = "linux")]
pub mod servo_control {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration};

    #[derive(Debug)]
    pub struct ServoController {
        output_pin: OutputPin,  // Pin for servo pulses (mandatory)
        input_pin: Option<InputPin>, // Limit switch for calibration (optional)
        direction_pin: Option<OutputPin>, // Pin to control direction (optional)
    }

    impl ServoController {
        /// Creates a new ServoController with the given GPIO pins.
        /// `output_pin_pin` is used for servo pulses (mandatory),
        /// `input_pin_pin` for the limit switch (optional),
        /// and `direction_pin_pin` for setting direction (optional).
        pub fn new(
            output_pin_pin: Option<u8>, // Output pin is mandatory
            input_pin_pin: Option<u8>,  // Input pin is optional
            direction_pin_pin: Option<u8>, // Direction pin is optional
        ) -> Result<Self, String> {
            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            
            // Configure the mandatory output pin
            let output_pin = match output_pin_pin {
                Some(pin) => gpio.get(pin).map_err(|e| e.to_string())?.into_output(),
                None => return Err("Output pin is required".to_string()),
            };

            // Configure optional input pin
            let input_pin = match input_pin_pin {
                Some(pin) => Some(gpio.get(pin).map_err(|e| e.to_string())?.into_input()),
                None => None,
            };

            // Configure optional direction pin
            let direction_pin = match direction_pin_pin {
                Some(pin) => Some(gpio.get(pin).map_err(|e| e.to_string())?.into_output()),
                None => None,
            };

            Ok(ServoController {
                output_pin,       // Mandatory pin
                input_pin,        // Optional pin
                direction_pin,    // Optional pin
            })
        }
    
        /// Sets the servo to the specified angle.
        pub fn set_angle(&mut self, angle: u8) {
            println!("Setting angle: {} degrees", angle);            
    
            // Map the angle (0-180) to pulse width (1ms to 2ms)
            let pulse_width = 1.0 + (angle as f32 / 18000.0) * 1.0; // Pulse width in ms
            let duty = pulse_width * 1000.0; // Convert to microseconds
    
            // Activate servo pulse
            self.output_pin.set_high();
            thread::sleep(Duration::from_micros(duty as u64));
    
            // Complete cycle (20ms total)
            self.output_pin.set_low();
            thread::sleep(Duration::from_millis(20) - Duration::from_micros(duty as u64));
        }

        /// Reads the limit switch state (if available).
        pub fn is_limit_switch_pressed(&self) -> Option<bool> {
            if let Some(input_pin) = &self.input_pin {
                let pressed = !input_pin.is_high(); // Limit switch active when LOW
                println!("Limit switch state: {}", if pressed { "PRESSED" } else { "NOT PRESSED" });
                Some(pressed)
            } else {
                println!("Limit switch not configured");
                None
            }
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
            if let Some(input_pin) = &self.input_pin {
                while input_pin.is_low() { // Rotate until the limit switch is triggered
                    self.output_pin.set_high();
                    thread::sleep(Duration::from_micros(469));
                    self.output_pin.set_low();
                    thread::sleep(Duration::from_micros(469));
                }

                println!("Calibration complete: Limit switch activated.");
                Ok("Calibration Complete".to_string())
            } else {
                Err("Calibration failed: Limit switch not configured".to_string())
            }
        }

        /// Sets the direction pin to high or low (if available).
        pub fn set_direction(&mut self, high: bool) {
            if let Some(direction_pin) = &self.direction_pin {
                if high {
                    direction_pin.set_high();
                    println!("Direction pin set to HIGH");
                } else {
                    direction_pin.set_low();
                    println!("Direction pin set to LOW");
                }
            } else {
                println!("Direction pin not configured");
            }
        }
    }
    
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        let mut servo = ServoController::new(Some(12), None, None)?; // Mandatory output pin
        servo.set_angle(angle);
        Ok(format!("Servo set to {} degrees", angle))
    }

    #[tauri::command]
    pub fn rotate_servo(times: u32) -> Result<String, String> {
        let mut servo = ServoController::new(Some(12), None, None)?; // Mandatory output pin
        servo.rotate_servo(times);
        println!("Rotated servo");
        Ok(format!("Rotated servo {} times", times))
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        let mut servo = ServoController::new(Some(12), Some(16), None)?; // Mandatory output pin and limit switch
        servo.calibrate()
    }

    #[tauri::command]
    pub fn change_direction(state: bool) -> Result<String, String> {
        let mut controller = ServoController::new(Some(1), None, Some(23))?; // Mandatory output pin and direction pin
        controller.set_direction(state);
        let status = if state { "HIGH" } else { "LOW" };
        println!("state set: {}", status);
        Ok(format!("Direction pin set to {}", status))
    }
    

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        let mut servo = ServoController::new(Some(6), Some(13), None)?; // Mandatory output pin and limit switch
    
        // Set the output pin HIGH to provide 3.3V
        servo.output_pin.set_high();
        println!("Output pin set to HIGH");
    
        // Allow time for the signal to stabilize
        thread::sleep(Duration::from_millis(100));
    
        // Confirm stable reading from the limit switch
        let mut detected_high = false;
        if let Some(input_pin) = &servo.input_pin {
            for _ in 0..5 {
                if input_pin.is_high() {
                    detected_high = true;
                    break;
                }
                thread::sleep(Duration::from_millis(50));
            }
        } else {
            return Err("Limit switch not configured".to_string());
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
