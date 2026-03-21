use std::env;
use std::io::{self, BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::thread;
use std::time::Duration;

fn print_help() {
    println!("\n=== Arduino Serial Tester ===");
    println!("Type Arduino commands and press Enter:");
    println!("  SERVO1_STOP");
    println!("  SERVO1_RELEASE");
    println!("  SERVO2_STOP");
    println!("  SERVO2_RELEASE");
    println!("  SERVO2_DISPENSE");
    println!("  RESET_SCORE");
    println!("  STATE?");
    println!("  PING");
    println!("\nLocal commands:");
    println!("  points       -> print current basket points");
    println!("  reset_local  -> reset local points counter only");
    println!("  help         -> print this help");
    println!("  quit         -> exit\n");
}

fn parse_args() -> (String, u32) {
    let mut port = env::var("ARDUINO_PORT").unwrap_or_else(|_| "/dev/ttyUSB0".to_string());
    let mut baud: u32 = env::var("ARDUINO_BAUD")
        .ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(115200);

    let args: Vec<String> = env::args().collect();
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" if i + 1 < args.len() => {
                port = args[i + 1].clone();
                i += 2;
            }
            "--baud" if i + 1 < args.len() => {
                if let Ok(v) = args[i + 1].parse::<u32>() {
                    baud = v;
                }
                i += 2;
            }
            _ => {
                i += 1;
            }
        }
    }

    (port, baud)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let (port_path, baud) = parse_args();

    println!("Opening serial port {} @ {}...", port_path, baud);
    let port = serialport::new(&port_path, baud)
        .timeout(Duration::from_millis(100))
        .open()?;

    // Give Arduino time to reboot after serial open.
    thread::sleep(Duration::from_millis(2000));

    let points = Arc::new(AtomicU32::new(0));
    let running = Arc::new(AtomicBool::new(true));

    let writer = Arc::new(Mutex::new(port));

    let reader_port = {
        let guard = writer.lock().expect("Failed to lock serial writer");
        guard.try_clone()?
    };

    let points_reader = Arc::clone(&points);
    let running_reader = Arc::clone(&running);

    let reader_handle = thread::spawn(move || {
        let mut reader = BufReader::new(reader_port);
        let mut line = String::new();

        while running_reader.load(Ordering::Relaxed) {
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

                    if let Some(delta_raw) = msg.strip_prefix("SCORE:") {
                        let delta = delta_raw.parse::<u32>().unwrap_or(1);
                        let total = points_reader.fetch_add(delta, Ordering::Relaxed) + delta;
                        println!("[RX] {} | total points={}", msg, total);
                    } else {
                        println!("[RX] {}", msg);
                    }
                }
                Err(e) => {
                    if e.kind() != io::ErrorKind::TimedOut {
                        eprintln!("[RX-ERR] {}", e);
                        thread::sleep(Duration::from_millis(30));
                    }
                }
            }
        }
    });

    print_help();

    let stdin = io::stdin();
    let mut input = String::new();

    while running.load(Ordering::Relaxed) {
        print!("> ");
        io::stdout().flush()?;

        input.clear();
        if stdin.read_line(&mut input)? == 0 {
            break;
        }

        let cmd = input.trim();
        if cmd.is_empty() {
            continue;
        }

        match cmd {
            "quit" | "exit" => {
                running.store(false, Ordering::Relaxed);
                break;
            }
            "help" => {
                print_help();
            }
            "points" => {
                let total = points.load(Ordering::Relaxed);
                println!("[LOCAL] points={}", total);
            }
            "reset_local" => {
                points.store(0, Ordering::Relaxed);
                println!("[LOCAL] points reset to 0");
            }
            _ => {
                let mut guard = writer.lock().expect("Failed to lock serial writer");
                let payload = format!("{}\n", cmd);
                guard.write_all(payload.as_bytes())?;
                guard.flush()?;
                println!("[TX] {}", cmd);

                if cmd == "RESET_SCORE" {
                    points.store(0, Ordering::Relaxed);
                    println!("[LOCAL] points reset to 0 (after RESET_SCORE)");
                }
            }
        }
    }

    running.store(false, Ordering::Relaxed);
    let _ = reader_handle.join();

    println!("Tester closed.");
    Ok(())
}
