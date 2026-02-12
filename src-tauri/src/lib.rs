// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Returns current OS and arch for OpenCode binary download (e.g. "darwin", "aarch64").
#[tauri::command]
fn get_platform() -> Result<serde_json::Value, String> {
    let os = std::env::consts::OS; // "macos" | "windows" | "linux"
    let arch = std::env::consts::ARCH; // "aarch64" | "x86_64" | "x86" | ...
    #[cfg(target_os = "macos")]
    let os_name = "darwin";
    #[cfg(target_os = "windows")]
    let os_name = "windows";
    #[cfg(target_os = "linux")]
    let os_name = "linux";
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    let os_name = os;
    let value = serde_json::json!({ "os": os_name, "arch": arch });
    Ok(value)
}

const DEFAULT_OPENCODE_PORT: u16 = 4096;

/// Start OpenCode serve in the background. Requires `opencode` on PATH (install via brew/npm/install script).
#[tauri::command]
fn start_opencode_serve(port: Option<u16>) -> Result<(), String> {
    let port = port.unwrap_or(DEFAULT_OPENCODE_PORT);
    let port_str = port.to_string();
    // Allow CORS for Tauri dev (Vite) and webview so frontend can call the API
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("opencode")
        .args([
            "serve",
            "--hostname",
            "127.0.0.1",
            "--port",
            port_str.as_str(),
            "--cors",
            "http://localhost:1420",
            "--cors",
            "tauri://localhost",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    #[cfg(not(target_os = "windows"))]
    let status = std::process::Command::new("opencode")
        .args([
            "serve",
            "--hostname",
            "127.0.0.1",
            "--port",
            port_str.as_str(),
            "--cors",
            "http://localhost:1420",
            "--cors",
            "tauri://localhost",
        ])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn();
    match status {
        Ok(_child) => Ok(()),
        Err(e) => Err(format!("Failed to start opencode serve: {}. Install OpenCode (e.g. brew install opencode) and ensure it is on PATH.", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_platform, start_opencode_serve])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
