#[cfg(target_os = "linux")]
pub mod motor_system {
    use crate::tcp;
    use rppal::gpio::{Gpio, OutputPin, InputPin};    
    use std::{thread, time::Duration, sync::{mpsc, Mutex, atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering}}, io::{Write, Read, BufRead, BufReader}};
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
            self.enable_pin.set_low(); // LOW - motor works

            const STEP_DELAY_US: u64 = 1000;
            const MAX_RELEASE_STEPS: u32 = 25_000;
            const MAX_HOME_STEPS: u32 = 60_000;

            // If both switches are pressed, mechanics/wiring is in an invalid state.
            if self.limit_switch_pin.is_low() && self.limit_switch_pin_2.is_low() {
                return Err("Calibration failed: both limit switches are pressed.".to_string());
            }

            let end_place: &str;

            // If one switch is already pressed, first release it and then travel to the opposite end.
            if self.limit_switch_pin.is_low() {
                // Right switch (GPIO 24) is pressed -> move LEFT to release it.
                println!("Right limit switch is pressed. Moving left to release it...");
                self.direction_pin.set_low();
                let mut steps = 0u32;

                while self.limit_switch_pin.is_low() && steps < MAX_RELEASE_STEPS {
                    self.pulse_pin.set_high();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    self.pulse_pin.set_low();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    steps += 1;
                }

                if self.limit_switch_pin.is_low() {
                    return Err("Calibration failed: right limit switch stayed pressed while moving left.".to_string());
                }

                println!("Searching for left limit switch...");
                let mut steps_to_home = 0u32;
                while self.limit_switch_pin_2.is_high() && steps_to_home < MAX_HOME_STEPS {
                    self.pulse_pin.set_high();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    self.pulse_pin.set_low();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    steps_to_home += 1;
                }

                if self.limit_switch_pin_2.is_high() {
                    return Err("Calibration failed: left limit switch not reached within expected travel.".to_string());
                }
                end_place = "left";
            } else if self.limit_switch_pin_2.is_low() {
                // Left switch (GPIO 1) is pressed -> move RIGHT to release it.
                println!("Left limit switch is pressed. Moving right to release it...");
                self.direction_pin.set_high();
                let mut steps = 0u32;

                while self.limit_switch_pin_2.is_low() && steps < MAX_RELEASE_STEPS {
                    self.pulse_pin.set_high();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    self.pulse_pin.set_low();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    steps += 1;
                }

                if self.limit_switch_pin_2.is_low() {
                    return Err("Calibration failed: left limit switch stayed pressed while moving right.".to_string());
                }

                println!("Searching for right limit switch...");
                let mut steps_to_home = 0u32;
                while self.limit_switch_pin.is_high() && steps_to_home < MAX_HOME_STEPS {
                    self.pulse_pin.set_high();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    self.pulse_pin.set_low();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    steps_to_home += 1;
                }

                if self.limit_switch_pin.is_high() {
                    return Err("Calibration failed: right limit switch not reached within expected travel.".to_string());
                }
                end_place = "right";
            } else {
                // Neither switch is pressed - move in default direction until one is hit
                println!("No limit switch pressed. Moving right to find a limit switch...");
                self.direction_pin.set_low();
                let mut steps = 0u32;

                while self.limit_switch_pin.is_high() && self.limit_switch_pin_2.is_high() && steps < MAX_HOME_STEPS {
                    self.pulse_pin.set_high();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    self.pulse_pin.set_low();
                    thread::sleep(Duration::from_micros(STEP_DELAY_US));
                    steps += 1;
                }

                if self.limit_switch_pin.is_high() && self.limit_switch_pin_2.is_high() {
                    return Err("Calibration failed: no limit switch reached within expected travel.".to_string());
                }

                if self.limit_switch_pin_2.is_low() {
                    end_place = "left";
                } else if self.limit_switch_pin.is_low() {
                    end_place = "right";
                } else {
                    return Err("Calibration failed: end place could not be determined.".to_string());
                }
            }

            println!("Calibration complete: end place is {}.", end_place);
            Ok(format!("end_place_{}", end_place))
        }

        
            
    }

    // 🔁 Shared static instance
    static CONTROLLER_INSTANCE: Lazy<Mutex<Option<Controller>>> = Lazy::new(|| Mutex::new(None));
    
    // 📡 Persistent Arduino serial connection
    static ARDUINO_PORT: Lazy<Mutex<Option<Box<dyn serialport::SerialPort>>>> = Lazy::new(|| Mutex::new(None));
    static ARDUINO_LISTENER_RUNNING: AtomicBool = AtomicBool::new(false);
    static BASKET_SCORE: AtomicU32 = AtomicU32::new(0);
    static MOTOR_JOB_SENDER: Lazy<Mutex<Option<mpsc::Sender<MotorJob>>>> = Lazy::new(|| Mutex::new(None));
    static MOTOR_QUEUE_LENGTH: AtomicU32 = AtomicU32::new(0);
    static MOTOR_JOB_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

    #[derive(Clone, Copy)]
    enum MotorJobKind {
        Rotate { times: i32, safety: bool },
        Calibrate,
    }

    impl MotorJobKind {
        fn as_str(self) -> &'static str {
            match self {
                MotorJobKind::Rotate { .. } => "rotate",
                MotorJobKind::Calibrate => "calibrate",
            }
        }
    }

    #[derive(Clone, Copy)]
    struct MotorJob {
        request_id: u64,
        kind: MotorJobKind,
    }

    fn emit_motor_event(app: &AppHandle, event: &str, payload: serde_json::Value) {
        let _ = tcp::send_event(event, payload.clone());
        if let Err(e) = app.emit(event, payload) {
            println!("Failed to emit {event}: {e}");
        }
    }

    fn emit_motor_queue_length(app: &AppHandle) {
        emit_motor_event(
            app,
            "motor_queue_length",
            serde_json::json!({
                "queueLength": MOTOR_QUEUE_LENGTH.load(Ordering::SeqCst)
            }),
        );
    }

    fn run_motor_job(job: MotorJob) -> Result<String, String> {
        with_controller(|instance| {
            instance.enable_pin.set_low();

            match job.kind {
                MotorJobKind::Rotate { times, safety } => {
                    // Allow movement even if a limit switch is already pressed.
                    // The loop check in rotate_stepper_motor will stop if moving toward a pressed switch.
                    // This enables recovery: user can move away from a stuck position.
                    instance.rotate_stepper_motor(times, safety)
                }
                MotorJobKind::Calibrate => instance.calibrate(),
            }
        })
    }

    fn ensure_motor_worker(app: &AppHandle) {
        let mut sender_guard = MOTOR_JOB_SENDER.lock().unwrap();
        if sender_guard.is_some() {
            return;
        }

        let (tx, rx) = mpsc::channel::<MotorJob>();
        let worker_app = app.clone();

        thread::spawn(move || {
            for job in rx {
                emit_motor_event(
                    &worker_app,
                    "motor_move_started",
                    serde_json::json!({
                        "requestId": job.request_id,
                        "jobType": job.kind.as_str()
                    }),
                );

                match run_motor_job(job) {
                    Ok(message) => {
                        emit_motor_event(
                            &worker_app,
                            "motor_move_completed",
                            serde_json::json!({
                                "requestId": job.request_id,
                                "jobType": job.kind.as_str(),
                                "message": message
                            }),
                        );
                    }
                    Err(error) => {
                        emit_motor_event(
                            &worker_app,
                            "motor_move_failed",
                            serde_json::json!({
                                "requestId": job.request_id,
                                "jobType": job.kind.as_str(),
                                "error": error
                            }),
                        );
                    }
                }

                MOTOR_QUEUE_LENGTH.fetch_sub(1, Ordering::SeqCst);
                emit_motor_queue_length(&worker_app);
            }
        });

        *sender_guard = Some(tx);
    }

    fn enqueue_motor_job(app: &AppHandle, kind: MotorJobKind) -> Result<(u64, u32), String> {
        ensure_motor_worker(app);

        let sender = {
            let sender_guard = MOTOR_JOB_SENDER.lock().unwrap();
            sender_guard
                .as_ref()
                .cloned()
                .ok_or_else(|| "Motor worker is unavailable".to_string())?
        };

        let request_id = MOTOR_JOB_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
        let queue_length = MOTOR_QUEUE_LENGTH.fetch_add(1, Ordering::SeqCst) + 1;

        let job = MotorJob { request_id, kind };
        if let Err(e) = sender.send(job) {
            MOTOR_QUEUE_LENGTH.fetch_sub(1, Ordering::SeqCst);
            return Err(format!("Failed to queue motor job: {e}"));
        }

        emit_motor_queue_length(app);
        Ok((request_id, queue_length))
    }

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
    pub fn rotate_stepper_motor(app: AppHandle, times: i32, safety: bool) -> Result<serde_json::Value, String> {
        let (request_id, queue_length) = enqueue_motor_job(&app, MotorJobKind::Rotate { times, safety })?;

        Ok(serde_json::json!({
            "status": "queued",
            "requestId": request_id,
            "queueLength": queue_length,
            "jobType": "rotate"
        }))
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor(app: AppHandle) -> Result<serde_json::Value, String> {
        let (request_id, queue_length) = enqueue_motor_job(&app, MotorJobKind::Calibrate)?;

        Ok(serde_json::json!({
            "status": "queued",
            "requestId": request_id,
            "queueLength": queue_length,
            "jobType": "calibrate"
        }))
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
    pub fn move_servo(angle: bool) -> Result<String, String> {
       println!("move_servo (servo1): {}", angle);
        let command = if angle { "SERVO1_STOP" } else { "SERVO1_RELEASE" };
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
        let command = if stop_ball { "SERVO2_STOP" } else { "SERVO2_RELEASE" }.to_string();
        let command_for_worker = command.clone();
        std::thread::spawn(move || {
            if let Err(e) = send_arduino_command(&command_for_worker) {
                println!("Arduino command error: {}", e);
            }
        });
        Ok(format!("Command '{}' queued (non-blocking)", command))
    }

    #[tauri::command]
    pub fn feed_ball_to_servo1() -> Result<String, String> {
        std::thread::spawn(|| {
            if let Err(e) = send_arduino_command("SERVO2_DISPENSE") {
                println!("Arduino command error: {}", e);
            }
        });
        Ok("Servo2 dispense command queued (non-blocking)".to_string())
    }

    #[tauri::command]
    pub fn run_auto_ball_cycle() -> Result<String, String> {
        println!("Starting auto ball cycle (blocking)...");
        send_arduino_command("SERVO1_RELEASE")?;
        thread::sleep(Duration::from_millis(1500));
        send_arduino_command("SERVO1_STOP")?;
        thread::sleep(Duration::from_millis(120));
        send_arduino_command("SERVO2_DISPENSE")?;
        println!("Finished auto ball cycle");
        Ok("Auto ball cycle completed".to_string())
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

        let _ = tcp::send_event(
            "basket_score_updated",
            serde_json::json!({
                "score": new_score,
                "delta": safe_delta
            }),
        );

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

        let _ = tcp::send_event(
            "basket_score_updated",
            serde_json::json!({
                "score": 0,
                "delta": 0
            }),
        );

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
            let mut last_send = std::time::Instant::now();
            let mut pending_line: Option<String> = None;

            loop {
                line.clear();

                // Flush the pending throttled line if the window has expired
                if pending_line.is_some() && last_send.elapsed() >= Duration::from_millis(150) {
                    if let Some(msg) = pending_line.take() {
                        let _ = tcp::send_event(
                            "arduino_rx",
                            serde_json::json!({
                                "line": msg
                            }),
                        );
                        last_send = std::time::Instant::now();
                    }
                }

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

                        if msg.starts_with("SCORE:") || msg.starts_with("STATE:SCORE=") {
                            // Score messages are critical and bypass throttle
                            let _ = tcp::send_event(
                                "arduino_rx",
                                serde_json::json!({
                                    "line": msg
                                }),
                            );
                            last_send = std::time::Instant::now();
                            pending_line = None;
                        } else {
                            // Standard telemetry/debug lines are throttled
                            if last_send.elapsed() >= Duration::from_millis(150) {
                                let _ = tcp::send_event(
                                    "arduino_rx",
                                    serde_json::json!({
                                        "line": msg
                                    }),
                                );
                                last_send = std::time::Instant::now();
                                pending_line = None;
                            } else {
                                pending_line = Some(msg.to_string());
                            }
                        }

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

                            let _ = tcp::send_event(
                                "basket_score_updated",
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

                                let _ = tcp::send_event(
                                    "basket_score_updated",
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
    use std::sync::atomic::{AtomicI32, AtomicU32, AtomicU64, Ordering};
    use std::sync::{mpsc, Mutex};
    use once_cell::sync::Lazy;
    use tauri::{AppHandle, Emitter};

    // Emulator state tracking
    static EMULATOR_POSITION: AtomicI32 = AtomicI32::new(1000); // Start off-center so calibration runs
    static MOTOR_QUEUE_LENGTH: AtomicU32 = AtomicU32::new(0);
    static MOTOR_JOB_ID_COUNTER: AtomicU64 = AtomicU64::new(1);
    static MOTOR_JOB_SENDER: Lazy<Mutex<Option<mpsc::Sender<MotorJob>>>> = Lazy::new(|| Mutex::new(None));

    #[derive(Clone, Copy)]
    enum MotorJobKind {
        Rotate { times: i32, safety: bool },
        Calibrate,
    }

    impl MotorJobKind {
        fn as_str(self) -> &'static str {
            match self {
                MotorJobKind::Rotate { .. } => "rotate",
                MotorJobKind::Calibrate => "calibrate",
            }
        }
    }

    #[derive(Clone, Copy)]
    struct MotorJob {
        request_id: u64,
        kind: MotorJobKind,
    }

    fn emit_motor_event(app: &AppHandle, event: &str, payload: serde_json::Value) {
        let _ = crate::tcp::send_event(event, payload.clone());
        if let Err(e) = app.emit(event, payload) {
            println!("Failed to emit {event}: {e}");
        }
    }

    fn emit_motor_queue_length(app: &AppHandle) {
        emit_motor_event(
            app,
            "motor_queue_length",
            serde_json::json!({
                "queueLength": MOTOR_QUEUE_LENGTH.load(Ordering::SeqCst)
            }),
        );
    }

    fn run_motor_job(job: MotorJob) -> Result<String, String> {
        match job.kind {
            MotorJobKind::Rotate { times, safety } => {
                println!("Emulator: Rotating stepper motor for {} steps (safety: {})", times, safety);
                let steps = times.abs();
                let step_dir = if times >= 0 { 1 } else { -1 };

                for i in 0..steps {
                    // let pos = EMULATOR_POSITION.load(Ordering::SeqCst);
                    // let pressed_right = pos >= 5000;
                    // let pressed_left = pos <= -5000;

                    //NOT WORKING - DISABLED
                    /*if (pressed_right || pressed_left) && safety {
                        println!("⚠️ Emulator Limit switch triggered – stopping rotation (Pos: {})", pos);
                        return Ok("Stopped early due to limit switch being triggered".to_string());
                    }*/ 

                    EMULATOR_POSITION.fetch_add(step_dir, Ordering::SeqCst);

                    // Sleep occasionally to simulate motor movement time
                    if i % 100 == 0 {
                        std::thread::sleep(std::time::Duration::from_millis(5));
                    }
                }

                Ok(format!("Rotated stepper motor {} steps (safety: {})", times, safety))
            }
            MotorJobKind::Calibrate => {
                println!("Emulator: Starting calibration...");

                let pos = EMULATOR_POSITION.load(Ordering::SeqCst);
                let pressed_right = pos >= 5000;
                let pressed_left = pos <= -5000;

                if pressed_right && pressed_left {
                    return Err("Calibration failed: both limit switches are pressed.".to_string());
                }

                let end_place: &str;

                if pressed_right {
                    println!("Right limit switch is pressed. Moving left to release it...");
                    let mut steps = 0;
                    while EMULATOR_POSITION.load(Ordering::SeqCst) >= 5000 && steps < 25000 {
                        EMULATOR_POSITION.fetch_sub(1, Ordering::SeqCst);
                        steps += 1;
                        if steps % 100 == 0 {
                            std::thread::sleep(std::time::Duration::from_millis(5));
                        }
                    }

                    if EMULATOR_POSITION.load(Ordering::SeqCst) >= 5000 {
                        return Err("Calibration failed: right limit switch stayed pressed while moving left.".to_string());
                    }

                    println!("Searching for left limit switch...");
                    let mut steps_to_home = 0;
                    while EMULATOR_POSITION.load(Ordering::SeqCst) > -5000 && steps_to_home < 60000 {
                        EMULATOR_POSITION.fetch_sub(1, Ordering::SeqCst);
                        steps_to_home += 1;
                        if steps_to_home % 100 == 0 {
                            std::thread::sleep(std::time::Duration::from_millis(5));
                        }
                    }

                    if EMULATOR_POSITION.load(Ordering::SeqCst) > -5000 {
                        return Err("Calibration failed: left limit switch not reached within expected travel.".to_string());
                    }

                    end_place = "left";
                } else if pressed_left {
                    println!("Left limit switch is pressed. Moving right to release it...");
                    let mut steps = 0;
                    while EMULATOR_POSITION.load(Ordering::SeqCst) <= -5000 && steps < 25000 {
                        EMULATOR_POSITION.fetch_add(1, Ordering::SeqCst);
                        steps += 1;
                        if steps % 100 == 0 {
                            std::thread::sleep(std::time::Duration::from_millis(5));
                        }
                    }

                    if EMULATOR_POSITION.load(Ordering::SeqCst) <= -5000 {
                        return Err("Calibration failed: left limit switch stayed pressed while moving right.".to_string());
                    }

                    println!("Searching for right limit switch...");
                    let mut steps_to_home = 0;
                    while EMULATOR_POSITION.load(Ordering::SeqCst) < 5000 && steps_to_home < 60000 {
                        EMULATOR_POSITION.fetch_add(1, Ordering::SeqCst);
                        steps_to_home += 1;
                        if steps_to_home % 100 == 0 {
                            std::thread::sleep(std::time::Duration::from_millis(5));
                        }
                    }

                    if EMULATOR_POSITION.load(Ordering::SeqCst) < 5000 {
                        return Err("Calibration failed: right limit switch not reached within expected travel.".to_string());
                    }

                    end_place = "right";
                } else {
                    println!("No limit switch pressed. Moving left to find a limit switch...");
                    let mut steps = 0;
                    while EMULATOR_POSITION.load(Ordering::SeqCst) > -5000 && EMULATOR_POSITION.load(Ordering::SeqCst) < 5000 && steps < 60000 {
                        EMULATOR_POSITION.fetch_sub(1, Ordering::SeqCst);
                        steps += 1;
                        if steps % 100 == 0 {
                            std::thread::sleep(std::time::Duration::from_millis(5));
                        }
                    }

                    let final_pos = EMULATOR_POSITION.load(Ordering::SeqCst);
                    if final_pos > -5000 && final_pos < 5000 {
                        return Err("Calibration failed: no limit switch reached within expected travel.".to_string());
                    }

                    if final_pos <= -5000 {
                        end_place = "left";
                    } else {
                        end_place = "right";
                    }
                }

                println!("Emulator calibration complete: end place is {}.", end_place);
                Ok(format!("end_place_{}", end_place))
            }
        }
    }

    fn ensure_motor_worker(app: &AppHandle) {
        let mut sender_guard = MOTOR_JOB_SENDER.lock().unwrap();
        if sender_guard.is_some() {
            return;
        }

        let (tx, rx) = std::sync::mpsc::channel::<MotorJob>();
        let worker_app = app.clone();

        std::thread::spawn(move || {
            for job in rx {
                emit_motor_event(
                    &worker_app,
                    "motor_move_started",
                    serde_json::json!({
                        "requestId": job.request_id,
                        "jobType": job.kind.as_str()
                    }),
                );

                match run_motor_job(job) {
                    Ok(message) => {
                        emit_motor_event(
                            &worker_app,
                            "motor_move_completed",
                            serde_json::json!({
                                "requestId": job.request_id,
                                "jobType": job.kind.as_str(),
                                "message": message
                            }),
                        );
                    }
                    Err(error) => {
                        emit_motor_event(
                            &worker_app,
                            "motor_move_failed",
                            serde_json::json!({
                                "requestId": job.request_id,
                                "jobType": job.kind.as_str(),
                                "error": error
                            }),
                        );
                    }
                }

                MOTOR_QUEUE_LENGTH.fetch_sub(1, Ordering::SeqCst);
                emit_motor_queue_length(&worker_app);
            }
        });

        *sender_guard = Some(tx);
    }

    fn enqueue_motor_job(app: &AppHandle, kind: MotorJobKind) -> Result<(u64, u32), String> {
        ensure_motor_worker(app);

        let sender = {
            let sender_guard = MOTOR_JOB_SENDER.lock().unwrap();
            sender_guard
                .as_ref()
                .cloned()
                .ok_or_else(|| "Motor worker is unavailable".to_string())?
        };

        let request_id = MOTOR_JOB_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
        let queue_length = MOTOR_QUEUE_LENGTH.fetch_add(1, Ordering::SeqCst) + 1;

        let job = MotorJob { request_id, kind };
        if let Err(e) = sender.send(job) {
            MOTOR_QUEUE_LENGTH.fetch_sub(1, Ordering::SeqCst);
            return Err(format!("Failed to queue motor job: {e}"));
        }

        emit_motor_queue_length(app);
        Ok((request_id, queue_length))
    }

    #[tauri::command]
    pub fn init_instance() -> Result<String, String> {
        Ok("Emulator auto-initialized or already initialized".to_string())
    }

    #[tauri::command]
    pub fn check_limit_switch() {
        std::thread::spawn(|| {
            for _ in 0..10 {
                let pos = EMULATOR_POSITION.load(Ordering::SeqCst);
                let pressed_right = pos >= 5000;
                let pressed_left = pos <= -5000;
                let status = if pressed_right || pressed_left {
                    format!("PRESSED (Right: {}, Left: {})", pressed_right, pressed_left)
                } else {
                    "NOT PRESSED".to_string()
                };
                println!("Limit switch state (emulator): {}", status);
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        });
    }

    #[tauri::command]
    pub fn rotate_stepper_motor(app: AppHandle, times: i32, safety: bool) -> Result<serde_json::Value, String> {
        let (request_id, queue_length) = enqueue_motor_job(&app, MotorJobKind::Rotate { times, safety })?;

        Ok(serde_json::json!({
            "status": "queued",
            "requestId": request_id,
            "queueLength": queue_length,
            "jobType": "rotate"
        }))
    }

    #[tauri::command]
    pub fn calibrate_stepper_motor(app: AppHandle) -> Result<serde_json::Value, String> {
        let (request_id, queue_length) = enqueue_motor_job(&app, MotorJobKind::Calibrate)?;

        Ok(serde_json::json!({
            "status": "queued",
            "requestId": request_id,
            "queueLength": queue_length,
            "jobType": "calibrate"
        }))
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
    pub fn run_auto_ball_cycle() -> Result<String, String> {
        println!("Mocking auto ball cycle...");
        std::thread::sleep(std::time::Duration::from_millis(1620));
        Ok("mock auto ball cycle completed".to_string())
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