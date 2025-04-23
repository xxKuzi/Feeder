#[cfg(target_os = "linux")]
pub mod motor_system {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration, sync::Mutex};
    use once_cell::sync::Lazy;

    #[derive(Debug)]
    pub struct Controller {
        pulse_pin: OutputPin,        // Pin for pulses
        limit_switch_pin: InputPin,  // Limit switch for calibration/safety
        limit_switch_pin_2: InputPin, // Second limit switch (
        direction_pin: OutputPin,    // Pin to control direction
        enable_pin: OutputPin,       // Pin to enable/disable the motor
    }

    impl Controller {
        pub fn new(
            pulse_pin_number: u8,
            limit_switch_pin_number: u8,
            limit_switch_pin_2_number: u8,
            direction_pin_number: u8,
            enable_pin_number: u8,
        ) -> Result<Self, String> {
            println!(
                "Initializing stepper motor: pulse={}, limit={}, limit2{}, dir={}, enable={}",
                pulse_pin_number, limit_switch_pin_number, limit_switch_pin_2_number, direction_pin_number, enable_pin_number
            );

            let gpio = Gpio::new().map_err(|e| e.to_string())?;
            let pulse_pin = gpio.get(pulse_pin_number).map_err(|e| e.to_string())?.into_output();
            let limit_switch_pin = gpio.get(limit_switch_pin_number).map_err(|e| e.to_string())?.into_input_pullup();
            let limit_switch_pin_2 = gpio.get(limit_switch_pin_2_number).map_err(|e| e.to_string())?.into_input_pullup();
            let direction_pin = gpio.get(direction_pin_number).map_err(|e| e.to_string())?.into_output();
            let enable_pin = gpio.get(enable_pin_number).map_err(|e| e.to_string())?.into_output();

            let controller = Controller {
                pulse_pin,
                limit_switch_pin,
                limit_switch_pin_2,
                direction_pin,
                enable_pin,
            };
            
            controller.warmup_limit_switch_pins();             
            
            Ok(controller)
        }

        fn warmup_limit_switch_pins(&self) {
            println!("Warming up limit switch pins (priming pull-ups)...");
            for i in 0..3 {
                let state1 = if self.limit_switch_pin.is_low() { "LOW (PRESSED)" } else { "HIGH (NOT PRESSED)" };
                let state2 = if self.limit_switch_pin_2.is_low() { "LOW (PRESSED)" } else { "HIGH (NOT PRESSED)" };
                println!("  Read {}: Limit Switch 1 = {}, Limit Switch 2 = {}", i + 1, state1, state2);
                thread::sleep(Duration::from_millis(100));
            }
        }

        pub fn is_limit_switch_pressed(&self) -> bool {
            let pressed = !self.limit_switch_pin.is_high(); // Active LOW
            println!("Limit switch state: {}", if pressed { "PRESSED" } else { "NOT PRESSED" });
            pressed
        }

        pub fn rotate_stepper_motor(&mut self, times: i32, safety: bool) -> Result<String, String> {
            println!("Rotating stepper motor for {} steps (safety: {})", times, safety);
        
            // Set direction
            if times >= 0 {
                self.direction_pin.set_high(); 
            } else {
                self.direction_pin.set_low(); 
            }
        
            let steps = times.abs();
            let accel_steps = 200.min(steps / 2);
            let max_delay = 1000;
            let min_delay = 469;
        
            for i in 0..steps {
                if (self.limit_switch_pin.is_low() || self.limit_switch_pin_2.is_low()) && safety {
                    let state1 = if self.limit_switch_pin.is_low() { "PRESSED" } else { "NOT PRESSED" };
                    let state2 = if self.limit_switch_pin_2.is_low() { "PRESSED" } else { "NOT PRESSED" };
                    println!("⚠️ Limit switch triggered – stopping rotation\nLimit Switch 1: {}, Limit Switch 2: {}", state1, state2);
                    return Ok("Stopped early due to limit switch being triggered".to_string());
                }
        
                let delay = if i < accel_steps {
                    let ratio = i as f64 / accel_steps as f64;
                    max_delay as f64 - ratio * (max_delay - min_delay) as f64
                } else if i >= steps - accel_steps {
                    let ratio = (steps - i) as f64 / accel_steps as f64;
                    max_delay as f64 - ratio * (max_delay - min_delay) as f64
                } else {
                    min_delay as f64
                } as u64;
        
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(delay));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(delay));
            }
        
            Ok(format!("Rotated stepper motor {} steps (safety: {})", times, safety))
        }
        
        

        pub fn calibrate(&mut self) -> Result<String, String> {
            println!("Starting calibration...");
            self.enable_pin.set_low(); //LOW - motor works
            self.direction_pin.set_low(); //rotate to right

            while self.limit_switch_pin.is_high() && self.limit_switch_pin_2.is_high() {
                self.pulse_pin.set_high();
                thread::sleep(Duration::from_micros(1000));
                self.pulse_pin.set_low();
                thread::sleep(Duration::from_micros(1000));
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
            let instance = Controller::new(12, 24, 1, 23, 16)?; // default GPIOs
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
    pub fn rotate_stepper_motor(times: i32, safety: bool) -> Result<String, String> {
        // Run everything in a separate thread, as before
        let handle = std::thread::spawn(move || {
            with_controller(|instance| {
                println!("Checking safety condition...");
    
                instance.enable_pin.set_low(); // LOW - motor works
    
                if (instance.limit_switch_pin.is_low() || instance.limit_switch_pin_2.is_low()) && safety {
                    let state1 = if instance.limit_switch_pin.is_low() { "PRESSED" } else { "NOT PRESSED" };
                    let state2 = if instance.limit_switch_pin_2.is_low() { "PRESSED" } else { "NOT PRESSED" };
    
                    println!(
                        "⚠️ One of the limit switches is LOW (pressed) – ABORTING for safety\nLimit Switch 1: {}, Limit Switch 2: {}",
                        state1, state2
                    );
    
                    // ✅ Just return a custom OK message here
                    return Ok("Aborted: Limit switch already pressed at start.".to_string());
                }
    
                // Proceed with normal motor rotation
                instance.rotate_stepper_motor(times, safety);
    
                Ok("Stepper rotation started.".to_string())
            })
        });
    
        // Join the thread and return the result
        match handle.join() {
            Ok(Ok(_)) => Ok(format!("Rotated stepper motor {} steps (safety: {})", times, safety)),
            Ok(Err(e)) => Err(format!("Stepper motor error: {}", e)),
            Err(_) => Err("Thread panicked during motor rotation".to_string()),
        }
    }
    
    
    


    

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        let handle = std::thread::spawn(|| {
            with_controller(|instance| instance.calibrate())
        });
    
        match handle.join() {
            Ok(result) => match result {
                Ok(_) => Ok("end_place".to_string()),
                Err(e) => Err(format!("Calibration error: {}", e)),
            },
            Err(_) => Err("Thread panicked during calibration".to_string()),
        }
    }
    
    
    

    #[tauri::command]
    pub fn check_limit_switch() {
        std::thread::spawn(|| {
            if let Err(e) = with_controller(|instance| {
                for _ in 0..10 {
                    let pressed = instance.is_limit_switch_pressed();
                    let status = if pressed { "PRESSED (0)" } else { "NOT PRESSED (1)" };
                    println!("Limit switch state: {}", status);
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
                Ok("Finished debug loop".to_string())
            }) {
                println!("Error: {}", e);
            }
        });
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
        Ok("Rotated stepper motor 4800 steps (safety: false)".to_string())
        // Err("Stepper motor control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        // thread::sleep(Duration::from_millis(2000));
        Ok("end_place".to_string())
        //Err("Calibration not supported on this platform".to_string())
    }
}
