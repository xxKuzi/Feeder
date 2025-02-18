#[cfg(target_os = "linux")]
pub mod servo_control {
    use rppal::gpio::{Gpio, OutputPin};
    use tauri::{command, Manager};
    use std::{thread, time::Duration};

    #[derive(Debug)]
    pub struct ServoController {
        pin: OutputPin,
    }

    impl ServoController {
        pub fn new(pin_number: u8) -> Result<Self, String> {
            println!("output pin: {} ", pin_number);
            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let pin = gpio
                .get(pin_number)
                .map_err(|e| e.to_string())?
                .into_output();
            Ok(ServoController { pin })
        }
    
        pub fn set_angle(&mut self, angle: u8) {
            println!("Setting angle: {} degrees", angle);            
    
            // Map the angle (0-180) to pulse width (1ms to 2ms)
            let pulse_width = 1.0 + (angle as f32 / 18000.0) * 1.0; // 1ms to 2ms range
            let duty = pulse_width * 1000.0; // Convert to microseconds (ms to µs)
    
            // Set the pin high for the calculated pulse duration
            self.pin.set_high();
            thread::sleep(Duration::from_micros(duty as u64));
    
            // Set the pin low for the remaining duration (20ms total cycle)
            self.pin.set_low();
            thread::sleep(Duration::from_millis(20) - Duration::from_micros(duty as u64));
        }

        pub fn blink(&mut self, times: u32) {
            println!("Blinking LED for {} times", times);
            for _ in 0..times {
                self.pin.set_high();
                thread::sleep(Duration::from_micros(200));
                self.pin.set_low();
                thread::sleep(Duration::from_micros(200));
            }
        }
    }
    
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        let mut servo = ServoController::new(12)?;
        servo.set_angle(angle);
        Ok(format!("Servo set to {} degrees", angle))
    }

    #[tauri::command]
    pub fn blink_led(times: u32) -> Result<String, String> {
        let mut servo = ServoController::new(12)?;
        servo.blink(times);
        Ok(format!("Blinked {} times", times))
    }
}

#[cfg(not(target_os = "linux"))]
pub mod servo_control {
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        Err("Servo control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn blink_led(times: u32) -> Result<String, String> {
        Err("Blinking not supported on this platform".to_string())
    }
}