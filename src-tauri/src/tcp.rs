use tauri::Manager; // Import Manager for emitting events
use std::net::{TcpListener, TcpStream};
use std::io::{Read, Write};
use std::thread;

#[tauri::command]
fn handle_client(mut stream: TcpStream, app_handle: tauri::AppHandle, command_history: &mut Vec<String>) {
    let mut buffer = [0; 512];

    loop {
        match stream.read(&mut buffer) {
            Ok(0) => break, // Client closed the connection
            Ok(size) => {
                let received = String::from_utf8_lossy(&buffer[..size]).trim().to_string();
                println!("Received: {}", received);

                if received == "exit" {
                    println!("Client requested to close the connection.");
                    break;
                }

                // Parse the command
                let parts: Vec<&str> = received.split(':').collect();

                match parts.as_slice() {
                    // Handle SET_TRACK_SPEED command
                    ["SET_TRACK_SPEED", value1, value2] => {
                        let speed1: u8 = value1.parse().unwrap_or(0);
                        let speed2: u8 = value2.parse().unwrap_or(0);
                        println!("Setting track speed to {} and {}", speed1, speed2);
                        stream.write_all(format!("Track speed set to {} and {}\n", speed1, speed2).as_bytes()).unwrap();
                    }
                    // Handle SET_COMPRESSOR_ON command
                    ["SET_COMPRESSOR_ON", value] => {
                        let compressor_on: u8 = value.parse().unwrap_or(0);
                        if compressor_on == 1 {
                            println!("Compressor turned ON.");
                            stream.write_all(b"Compressor is ON\n").unwrap();
                        } else {
                            println!("Compressor turned OFF.");
                            stream.write_all(b"Compressor is OFF\n").unwrap();
                        }
                    }
                    // Handle SET_VALVES command
                    ["SET_VALVES", valve1, valve2, valve3] => {
                        let valve1: u8 = valve1.parse().unwrap_or(0);
                        let valve2: u8 = valve2.parse().unwrap_or(0);
                        let valve3: u8 = valve3.parse().unwrap_or(0);
                        println!("Setting valve positions to {}, {}, {}", valve1, valve2, valve3);
                        stream.write_all(format!("Valves set to {}, {}, {}\n", valve1, valve2, valve3).as_bytes()).unwrap();
                    }
                    // Handle pause command
                    ["pause"] => {
                        // Emit the pause event to the frontend
                        app_handle.emit("pause", {}).unwrap();
                        stream.write_all(b"Pause command received\n").unwrap();
                    }
                    // Handle other predefined commands (fixed match for "print_hello")
                    _ if received == "print_hello" => {
                        println!("Hello from the server!");
                        stream.write_all(b"Executed: print_hello\n").unwrap();
                    }
                    // Handle unknown commands
                    _ => {
                        command_history.push(received.clone());
                        stream
                            .write_all(format!("Command '{}' stored for later execution.\n", received).as_bytes())
                            .unwrap();
                    }
                }
            }
            Err(e) => {
                eprintln!("Error reading from stream: {}", e);
                break;
            }
        }
    }
}

pub fn start_tcp_server(app_handle: tauri::AppHandle) -> std::io::Result<()> {
    let listener = TcpListener::bind("0.0.0.0:7878")?;
    println!("Server is listening on 0.0.0.0:7878");

    let command_history = Vec::new();

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                println!("New connection: {}", stream.peer_addr().unwrap());

                let mut local_history = command_history.clone();
                let app_handle_clone = app_handle.clone();
                thread::spawn(move || handle_client(stream, app_handle_clone, &mut local_history));
            }
            Err(e) => eprintln!("Connection failed: {}", e),
        }
    }

    println!("Commands received during the session:");
    for command in command_history {
        println!("{}", command);
    }

    Ok(())
}
