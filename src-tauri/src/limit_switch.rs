// --------- Platform-specific modules ---------
#[cfg(target_os = "linux")]
mod platform {
    use rppal::gpio::Gpio;
    use std::thread;
    use std::time::Duration;

    const LIMIT_SWITCH_PIN: u8 = 24;

    pub fn watch_limit_switch() {
        thread::spawn(|| {
            let gpio = Gpio::new().expect("Failed to init GPIO");
            let pin = gpio.get(LIMIT_SWITCH_PIN).expect("Failed to get pin").into_input_pulldown();

            for _ in 0..5 {
                if pin.is_low() {
                    println!("CHECKING Limit switch is PRESSED");
                } else {
                    println!("CHECKING Limit switch is NOT pressed");
                }

                thread::sleep(Duration::from_millis(500));
            }

            println!("✅ Finished checking limit switch 5 times.");
        });
    }
}

#[cfg(not(target_os = "linux"))]
mod platform {
    pub fn watch_limit_switch() {
        println!("🟡 Limit switch monitoring is disabled on non-Linux platforms.");
    }
}

// --------- Public interface ---------
pub use platform::watch_limit_switch;
