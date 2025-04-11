#[cfg(target_os = "linux")]
pub mod motor_system {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration, sync::Mutex};
    use once_cell::sync::Lazy;

    #[derive(Debug)]
    pub struct Controller {
        pulse_pin: OutputPin,        // Pin for pulses
        limit_switch_pin: InputPin,  // Limit switch for calibration/safety
        direction_pin: OutputPin,    // Pin to control direction
        enable_pin: OutputPin,       // Pin to enable/disable the motor
    }

    impl Controller {
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

            Ok(Controller {
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

        pub fn rotate_stepper_motor(&mut self, times: i32) {
            println!("Rotating stepper motor for {} steps", times);

            if times >= 0 {
                self.direction_pin.set_high();
            } else {
                self.direction_pin.set_low();
            }

            for _ in 0..times.abs() {
                if self.limit_switch_pin.is_low() {
                    self.enable_pin.set_high();
                    console.log("Limit switch is LOW (pressed) INSIDE");
                }                
                else{     
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(469));
                }
            }
        }

        pub fn calibrate(&mut self) -> Result<String, String> {
            println!("Starting calibration...");
            self.direction_pin.set_low(); //rotate to right

            while self.limit_switch_pin.is_high() {
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(469));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(469));
            }

            println!("Calibration complete: Limit switch activated.");
            Ok("end_place".to_string())
        }
    }

    // 🔁 Shared static instance
    static CONTROLLER_INSTANCE: Lazy<Mutex<Option<Controller>>> = Lazy::new(|| Mutex::new(None));

    // 🧠 Auto-initializing access wrapper
    fn with_controller<F, R>(f: F) -> Result<R, String>
    where
        F: FnOnce(&mut Controller) -> Result<R, String>,
    {
        let mut guard = CONTROLLER_INSTANCE.lock().unwrap();

        if guard.is_none() {
            println!("Servo not initialized – performing auto-init...");
            let instance = Controller::new(12, 24, 23, 16)?; // default GPIOs
            *guard = Some(instance);
        }

        if let Some(ref mut instance) = *guard {
            f(instance)
        } else {
            Err("Failed to initialize Controller".to_string())
        }
    }

    // 🧪 Optional manual init (now just calls with_controller)
    #[tauri::command]
    pub fn init_instance() -> Result<String, String> {
        with_controller(|_| Ok("Servo auto-initialized or already initialized".to_string()))
    }

    #[tauri::command]
    pub fn rotate_stepper_motor(times: i32) -> Result<String, String> {
        with_controller(|instance| {
            println!("Checking safety condition...");


            //First check
           if instance.limit_switch_pin.is_high() {                
               instance.enable_pin.set_low();
            } else {
                println!("Limit switch is LOW (pressed) – ABORTING for safety");
                instance.enable_pin.set_high();                            
            }

            instance.rotate_stepper_motor(times);

            

            Ok(format!("Rotated stepper motor {} steps (with safety)", times))
        })
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        with_controller(|instance| instance.calibrate())
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        with_controller(|instance| {
            for _ in 0..10 { // check 10 times then return
                let pressed = instance.is_limit_switch_pressed();
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
    use std::{thread, time::Duration, sync::Mutex};
    #[tauri::command]
    pub fn init_instance() -> Result<String, String> {
        Err("You can not init instance supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        Err("Checking limit switch state is not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn rotate_stepper_motor(_times: i32) -> Result<String, String> {
        Ok("Rotated stepper motor 4800 steps (with safety)".to_string())
        // Err("Stepper motor control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        // thread::sleep(Duration::from_millis(2000));
        Ok("end_place".to_string())
        //Err("Calibration not supported on this platform".to_string())
    }
}
