// ---------- Linux version ----------
#[cfg(target_os = "linux")]
use rppal::gpio::Gpio;
#[cfg(target_os = "linux")]
use std::thread;
#[cfg(target_os = "linux")]
use std::time::Duration;

#[cfg(target_os = "linux")]
const LIMIT_SWITCH_PIN: u8 = 24;

#[cfg(target_os = "linux")]
pub fn watch_limit_switch() {
    thread::spawn(|| {
        let gpio = Gpio::new().expect("Failed to init GPIO");
        let pin = gpio.get(LIMIT_SWITCH_PIN).expect("Failed to get pin").into_input_pulldown();

        for _ in 0..5 {
            if pin.is_low() {
                println!("Limit switch is PRESSED");
            } else {
                println!("Limit switch is NOT pressed");
            }

            thread::sleep(Duration::from_millis(500));
        }

        println!("✅ Finished checking limit switch 5 times.");
    });
}

// ---------- Non-Linux version ----------
#[cfg(not(target_os = "linux"))]
pub fn watch_limit_switch() {
    println!("🟡 Limit switch monitoring is disabled on non-Linux platforms.");
}
