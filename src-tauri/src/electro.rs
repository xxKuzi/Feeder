#[cfg(target_os = "linux")]
pub mod motor_system {
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration, sync::{Mutex, atomic::{AtomicBool, AtomicU32, Ordering}}, io::{Write, Read, BufRead, BufReader}};
    use once_cell::sync::Lazy;
    use rppal::pwm::{Pwm, Channel, Polarity};
    use tauri::{AppHandle, Emitter};
    

pub struct Controller {
    pulse_pin: OutputPin,
    limit_switch_pin: InputPin,
    limit_switch_pin_2: InputPin,
    direction_pin: OutputPin,
    enable_pin: OutputPin,
    // Store the hardware PWM directly:
    servo_pin: Pwm,
}

impl Controller {
    pub fn new(
        pulse_pin_number: u8,
        limit_switch_pin_number: u8,
        limit_switch_pin_2_number: u8,
        direction_pin_number: u8,
        enable_pin_number: u8,
        //servo pwm is hardcoded        
    ) -> Result<Self, String> {
        let gpio = Gpio::new().map_err(|e| e.to_string())?;
        let pulse_pin = gpio.get(pulse_pin_number).map_err(|e| e.to_string())?.into_output();
        let limit_switch_pin = gpio.get(limit_switch_pin_number).map_err(|e| e.to_string())?.into_input_pullup();
        let limit_switch_pin_2 = gpio.get(limit_switch_pin_2_number).map_err(|e| e.to_string())?.into_input_pullup();
        let direction_pin = gpio.get(direction_pin_number).map_err(|e| e.to_string())?.into_output();
        let enable_pin = gpio.get(enable_pin_number).map_err(|e| e.to_string())?.into_output();
        // Directly create the PWM for the servo:
        let servo_pin = Pwm::with_frequency(Channel::Pwm1, 50.0, 0.075, Polarity::Normal, true)
            .map_err(|e| e.to_string())?;
        Ok(Controller {
            pulse_pin,
            limit_switch_pin,
            limit_switch_pin_2,
            direction_pin,
            enable_pin,
            servo_pin,
        })
    }
    
        pub fn move_servo_to_angle(&mut self, angle: u8, duration_ms: u64) -> Result<(), String> {
            // Calculate and set the duty cycle for the desired angle
            println!("angle rust: {}", angle);
            let duty = 0.025 + (angle.clamp(0, 180) as f64 / 180.0) * 0.10;
            println!("moving  + {}",duty);
            self.servo_pin.set_duty_cycle(duty).map_err(|e| e.to_string())?;

            thread::sleep(Duration::from_millis(duration_ms));
            Ok(())
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
            println!("Rotated stepper motor for {} steps (safety: {})", times, safety);
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
    
    // 📡 Persistent Arduino serial connection
    static ARDUINO_PORT: Lazy<Mutex<Option<Box<dyn serialport::SerialPort>>>> = Lazy::new(|| Mutex::new(None));
    static ARDUINO_LISTENER_RUNNING: AtomicBool = AtomicBool::new(false);
    static BASKET_SCORE: AtomicU32 = AtomicU32::new(0);

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
    
                    return Ok("Aborted: Limit switch already pressed at start.".to_string());
                }
    
                instance.rotate_stepper_motor(times, safety);
    
                Ok("Stepper rotation started.".to_string())
            })
        });
    
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



    
    #[tauri::command]
    pub fn move_servo(angle: u8) -> Result<String, String> {
       println!("move_servo (servo1) called with angle: {}", angle);
        let command = if angle >= 90 { "SERVO1_STOP" } else { "SERVO1_RELEASE" };
        println!("Sending command '{}' to Arduino", command);
        
        // Non-blocking: spawn thread without joining
        std::thread::spawn(move || {
            if let Err(e) = send_arduino_command(command) {
                println!("Arduino command error: {}", e);
            }
        });
        
        Ok(format!("Command '{}' queued (non-blocking)", command))
    }

    #[tauri::command]
    pub fn move_feeder_servo(stop_ball: bool) -> Result<String, String> {
        let command = if stop_ball { "SERVO2_STOP" } else { "SERVO2_RELEASE" };
        send_arduino_command(command)?;
        Ok(format!("Command '{}' sent", command))
    }

    #[tauri::command]
    pub fn feed_ball_to_servo1() -> Result<String, String> {
        send_arduino_command("SERVO2_DISPENSE")?;
        Ok("Servo2 dispense command sent".to_string())
    }

    #[tauri::command]
    pub fn get_basket_score() -> Result<u32, String> {
        Ok(BASKET_SCORE.load(Ordering::Relaxed))
    }

    #[tauri::command]
    pub fn add_basket_points(delta: u32, app: AppHandle) -> Result<u32, String> {
        let safe_delta = delta.max(1);
        let new_score = BASKET_SCORE.fetch_add(safe_delta, Ordering::Relaxed) + safe_delta;

        app.emit(
            "basket-score-updated",
            serde_json::json!({
                "score": new_score,
                "delta": safe_delta
            }),
        )
        .map_err(|e| e.to_string())?;

        Ok(new_score)
    }

    #[tauri::command]
    pub fn reset_basket_score(app: AppHandle) -> Result<String, String> {
        send_arduino_command("RESET_SCORE")?;
        BASKET_SCORE.store(0, Ordering::Relaxed);

        app.emit(
            "basket-score-updated",
            serde_json::json!({
                "score": 0,
                "delta": 0
            }),
        )
        .map_err(|e| e.to_string())?;

        Ok("Basket score reset".to_string())
    }

    #[tauri::command]
    pub fn send_arduino_raw_command(command: String) -> Result<String, String> {
        let trimmed = command.trim();
        if trimmed.is_empty() {
            return Err("Command is empty".to_string());
        }

        send_arduino_command(trimmed)?;
        Ok(format!("Raw command sent: {}", trimmed))
    }

    #[tauri::command]
    pub fn start_arduino_bridge(app: AppHandle, port: Option<String>) -> Result<String, String> {
        ensure_arduino_connection(port)?;
        ensure_arduino_listener(app)?;
        Ok("Arduino bridge ready".to_string())
    }

    fn ensure_arduino_connection(port_override: Option<String>) -> Result<(), String> {
        let mut port_guard = ARDUINO_PORT.lock().unwrap();

        if port_guard.is_none() {
            let port_path = port_override
                .or_else(|| std::env::var("ARDUINO_PORT").ok())
                .unwrap_or_else(|| "/dev/ttyUSB0".to_string());

            println!("Opening serial port: {}", port_path);
            let port = serialport::new(&port_path, 115200)
                .timeout(Duration::from_millis(100))
                .open()
                .map_err(|e| format!("Failed to open serial port: {e}"))?;

            println!("Waiting for Arduino to boot...");
            thread::sleep(Duration::from_millis(2000));
            *port_guard = Some(port);
            println!("Arduino connection established");
        }

        Ok(())
    }

    fn ensure_arduino_listener(app: AppHandle) -> Result<(), String> {
        if ARDUINO_LISTENER_RUNNING
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Ok(());
        }

        let reader_port = {
            let mut port_guard = ARDUINO_PORT.lock().unwrap();
            match port_guard.as_mut() {
                Some(port) => port.try_clone().map_err(|e| format!("Failed to clone serial port: {e}"))?,
                None => {
                    ARDUINO_LISTENER_RUNNING.store(false, Ordering::SeqCst);
                    return Err("Arduino port is not initialized".to_string());
                }
            }
        };

        thread::spawn(move || {
            let mut reader = BufReader::new(reader_port);
            let mut line = String::new();

            loop {
                line.clear();
                match reader.read_line(&mut line) {
                    Ok(0) => {
                        thread::sleep(Duration::from_millis(10));
                    }
                    Ok(_) => {
                        let msg = line.trim();
                        if msg.is_empty() {
                            continue;
                        }

                        println!("Arduino RX: {}", msg);

                        if let Some(delta_str) = msg.strip_prefix("SCORE:") {
                            let delta = delta_str.parse::<u32>().unwrap_or(1);
                            let new_score = BASKET_SCORE.fetch_add(delta, Ordering::Relaxed) + delta;

                            let _ = app.emit(
                                "basket-score-updated",
                                serde_json::json!({
                                    "score": new_score,
                                    "delta": delta
                                }),
                            );
                        } else if let Some(abs_str) = msg.strip_prefix("STATE:SCORE=") {
                            if let Ok(abs_score) = abs_str.parse::<u32>() {
                                BASKET_SCORE.store(abs_score, Ordering::Relaxed);

                                let _ = app.emit(
                                    "basket-score-updated",
                                    serde_json::json!({
                                        "score": abs_score,
                                        "delta": 0
                                    }),
                                );
                            }
                        }
                    }
                    Err(e) => {
                        if e.kind() != std::io::ErrorKind::TimedOut {
                            println!("Arduino listener error: {}", e);
                            thread::sleep(Duration::from_millis(50));
                        }
                    }
                }
            }
        });

        Ok(())
    }

    fn send_arduino_command(command: &str) -> Result<(), String> {
        ensure_arduino_connection(None)?;

        let mut port_guard = ARDUINO_PORT.lock().unwrap();
        
        if let Some(port) = port_guard.as_mut() {
            // Clear any buffered data
            let mut discard = vec![0u8; 256];
            let _ = port.read(&mut discard);
            
            println!("Sending command: '{}'", command);
            let cmd_with_newline = format!("{}\n", command);
            port.write_all(cmd_with_newline.as_bytes())
                .map_err(|e| format!("Failed to write: {e}"))?;
            port.flush()
                .map_err(|e| format!("Failed to flush: {e}"))?;
            
            // Quick response read (non-blocking timeout)
            thread::sleep(Duration::from_millis(50));
            let mut response = vec![0u8; 128];
            if let Ok(n) = port.read(&mut response) {
                let msg = String::from_utf8_lossy(&response[..n]);
                println!("Arduino: {}", msg.trim());
            }
            
            println!("Command sent successfully");
            Ok(())
        } else {
            Err("Failed to access serial port".to_string())
        }
    }
        

}


#[cfg(not(target_os = "linux"))]
pub mod motor_system {
    use tauri::AppHandle;
    #[tauri::command]
    pub fn init_instance() -> Result<String, String> {
        Err("You can not init instance supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn check_limit_switch() -> Result<String, String> {
        Err("Checking limit switch state is not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn rotate_stepper_motor(_times: i32, _safety: bool) -> Result<String, String> {
        Ok("Rotated stepper motor 4800 steps (safety: false)".to_string())
        // Err("Stepper motor control not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor() -> Result<String, String> {
        // thread::sleep(Duration::from_millis(2000));
        Ok("end_place".to_string())
        //Err("Calibration not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn move_servo(_angle: u8) -> Result<String, String> {
        Ok("end_place".to_string())
    }

    #[tauri::command]
    pub fn move_feeder_servo(_stop_ball: bool) -> Result<String, String> {
        Ok("not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn feed_ball_to_servo1() -> Result<String, String> {
        Ok("not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn get_basket_score() -> Result<u32, String> {
        Ok(0)
    }

    #[tauri::command]
    pub fn add_basket_points(_delta: u32, _app: AppHandle) -> Result<u32, String> {
        Ok(0)
    }

    #[tauri::command]
    pub fn reset_basket_score(_app: AppHandle) -> Result<String, String> {
        Ok("Basket score reset".to_string())
    }

    #[tauri::command]
    pub fn send_arduino_raw_command(_command: String) -> Result<String, String> {
        Ok("Arduino bridge not supported on this platform".to_string())
    }

    #[tauri::command]
    pub fn start_arduino_bridge(_app: AppHandle, _port: Option<String>) -> Result<String, String> {
        Ok("Arduino bridge not supported on this platform".to_string())
    }
}