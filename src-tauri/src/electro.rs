#[cfg(target_os = "linux")]
pub mod servo_control {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration};

    #[derive(Debug)]
    pub struct ServoController {
        output_pin: OutputPin,  // Renamed from "pin" to "output_pin"
        input_pin: InputPin,    // Added limit switch for calibration
    }

    impl ServoController {
        pub fn new(output_pin_pin: u8, input_pin_pin: u8) -> Result<Self, String> {
            println!("Initializing stepper motor on pin: {} with limit switch on pin: {}", output_pin_pin, input_pin_pin);
            
            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let output_pin = gpio.get(output_pin_pin).map_err(|e| e.to_string())?.into_output();
            let input_pin = gpio.get(input_pin_pin).map_err(|e| e.to_string())?.into_input();

            Ok(ServoController { output_pin, input_pin })
        }
    
        pub fn set_angle(&mut self, angle: u8) {
            println!("Setting angle: {} degrees", angle);            
    
            // Map the angle (0-180) to pulse width (1ms to 2ms)
            let pulse_width = 1.0 + (angle as f32 / 18000.0) * 1.0; // 1ms to 2ms range
            let duty = pulse_width * 1000.0; // Convert to microseconds (ms to µs)
    
            // Set the stepper motor high for the calculated pulse duration
            self.output_pin.set_high();
            thread::sleep(Duration::from_micros(duty as u64));
    
            // Set the stepper motor low for the remaining duration (20ms total cycle)
            self.output_pin.set_low();
            thread::sleep(Duration::from_millis(20) - Duration::from_micros(duty as u64));
        }

        pub fn is_limit_switch_pressed(&self) -> bool {
            let pressed = !self.input_pin.is_high(); // Limit switch is active when HIGH
            println!("Limit switch state: {}", if pressed { "PRESSED" } else { "NOT PRESSED" });
            pressed
        }

        pub fn rotate_servo(&mut self, times: u32) {
            println!("Rotating stepper motor for {} times", times);
            for _ in 0..times {
                self.output_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.output_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }
        }

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
    }
    
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        let mut servo = ServoController::new(12, 16)?; // Example GPIO pins
        servo.set_angle(angle);
        Ok(format!("Servo set to {} degrees", angle))
    }

    #[tauri::command]
    pub fn blink_led(times: u32) -> Result<String, String> {
        let mut servo = ServoController::new(12, 16)?;
        servo.rotate_servo(times);
        println!("Blinked");
        Ok(format!("Blinked {} times", times))
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        let mut servo = ServoController::new(12, 16)?;
        servo.calibrate()
    }

    pub fn check_limit_switch() -> Result<String, String> {
        // Initialize the ServoController with GPIO pins (example: 6 for output, 13 for input)
        let mut limit_switch = ServoController::new(6, 13)?;
    
        // Set the output pin HIGH before checking the input pin
        limit_switch.output_pin.set_high();
        println!("Output pin set to HIGH");
    
        // Wait for input and check its state
        let status = if limit_switch.input_pin.is_high() {
            "NOT PRESSED (1)"  // When connected, it should read HIGH
        } else {
            "PRESSED (0)" // If something pulls it LOW, it means pressed
        };
    
        println!("Limit switch state: {}", status);
        Ok(format!("Limit switch is {}", status))
    }

}

#[cfg(not(target_os = "linux"))]
pub mod servo_control {

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        Err("Blinking not supported on this platform".to_string())
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
}
