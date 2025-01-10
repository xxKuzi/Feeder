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
            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let pin = gpio
                .get(pin_number)
                .map_err(|e| e.to_string())?
                .into_output();
            Ok(ServoController { pin })
        }

        pub fn set_angle(&mut self, angle: u8) {
            let duty = angle as f32 / 18.0 + 2.0;
            // Set high for pulse
            self.pin.set_high();
            thread::sleep(Duration::from_millis((duty * 10.0) as u64));  // Duty cycle duration
            self.pin.set_low();
            thread::sleep(Duration::from_millis(20 - (duty * 10.0) as u64)); // Wait for next pulse
        }
    }

    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        let mut servo = ServoController::new(17)?;
        servo.set_angle(angle);
        Ok(format!("Servo set to {} degrees", angle))
    }
}

#[cfg(not(target_os = "linux"))]
pub mod servo_control {
    #[tauri::command]
    pub fn set_servo_angle(angle: u8) -> Result<String, String> {
        Err("Servo control not supported on this platform".to_string())
    }
}
