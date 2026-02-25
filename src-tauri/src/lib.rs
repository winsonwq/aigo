// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

const ATTACHMENT_MAX_READ_BYTES: usize = 300 * 1024;
const ATTACHMENT_EXCERPT_CHARS: usize = 8000;

fn is_likely_text_path(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    [
        "md", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "xml", "yaml", "yml",
        "py", "java", "go", "rs", "sh", "sql",
    ]
    .contains(&ext.as_str())
}

/// Read a file from the given path for use as an attachment. Returns name, size, and optional
/// text excerpt so the frontend never sends raw paths to OpenCode (which may not resolve Tauri paths).
#[tauri::command]
fn read_attachment_file(path: String) -> Result<serde_json::Value, String> {
    let path_buf = PathBuf::from(path.trim());
    if !path_buf.is_file() {
        return Err("不是文件或不存在".to_string());
    }
    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file")
        .to_string();
    let meta = fs::metadata(&path_buf).map_err(|e| format!("无法读取文件信息: {}", e))?;
    let size = meta.len();

    let (excerpt, truncated): (Option<String>, bool) = if is_likely_text_path(&path_buf) && size <= ATTACHMENT_MAX_READ_BYTES as u64 {
        let f = fs::File::open(&path_buf).map_err(|e| format!("无法打开文件: {}", e))?;
        let mut raw = Vec::with_capacity(ATTACHMENT_MAX_READ_BYTES.min(size as usize));
        let n = f
            .take(ATTACHMENT_MAX_READ_BYTES as u64)
            .read_to_end(&mut raw)
            .map_err(|e| format!("读取失败: {}", e))?;
        let byte_truncated = n >= ATTACHMENT_MAX_READ_BYTES || (size as usize) > ATTACHMENT_MAX_READ_BYTES;
        match String::from_utf8(raw) {
            Ok(s) => {
                let excerpt_str: String = s.chars().take(ATTACHMENT_EXCERPT_CHARS).collect();
                let excerpt_truncated = byte_truncated || s.chars().count() > ATTACHMENT_EXCERPT_CHARS;
                (Some(excerpt_str), excerpt_truncated)
            }
            Err(_) => (None, false),
        }
    } else {
        (None, false)
    };
    Ok(serde_json::json!({
        "name": name,
        "size": size,
        "excerpt": excerpt,
        "truncated": truncated,
    }))
}
use tauri::menu::{Menu, SubmenuBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Returns current OS and arch for OpenCode binary download (e.g. "darwin", "aarch64").
#[tauri::command]
fn get_platform() -> Result<serde_json::Value, String> {
    let _os = std::env::consts::OS; // "macos" | "windows" | "linux"
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

/// Returns the user's home directory path (e.g. for default workspace). Used when no workspace is set.
#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    #[cfg(unix)]
    {
        std::env::var("HOME").map_err(|_| "HOME not set".to_string())
    }
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE").map_err(|_| "USERPROFILE not set".to_string())
    }
}

const WORKSPACE_PATH_FILENAME: &str = "workspace_path.txt";

fn workspace_path_file() -> Result<PathBuf, String> {
    let dir = dirs::config_dir().ok_or("无法获取配置目录")?;
    Ok(dir.join("aigo").join(WORKSPACE_PATH_FILENAME))
}

/// 将工作区路径持久化到本地文件（不依赖 WebView localStorage，避免被覆盖）。
fn write_workspace_path(path: Option<&str>) -> Result<(), String> {
    let file_path = workspace_path_file()?;
    if let Some(p) = path {
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&file_path, p).map_err(|e| e.to_string())?;
    } else if file_path.exists() {
        let _ = fs::remove_file(&file_path);
    }
    Ok(())
}

/// 从本地文件读取工作区路径（应用启动时由前端调用，作为唯一持久化来源）。
#[tauri::command]
fn read_workspace_path() -> Result<Option<String>, String> {
    let file_path = workspace_path_file()?;
    if !file_path.is_file() {
        return Ok(None);
    }
    let s = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let trimmed = s.trim();
    Ok(if trimmed.is_empty() { None } else { Some(trimmed.to_string()) })
}

/// 保存工作区路径到本地文件（供前端显式设置时调用）。
#[tauri::command]
fn save_workspace_path(path: Option<String>) -> Result<(), String> {
    write_workspace_path(path.as_deref())
}

/// Opens native folder picker. Optional default_path: open dialog in this directory so "打开的位置" matches displayed path.
/// Persists to local file; on write error we still return the path so frontend can update.
#[tauri::command]
async fn pick_workspace_folder(
    app: tauri::AppHandle,
    default_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut builder = app.dialog().file().set_title("选择工作区文件夹");
    if let Some(ref p) = default_path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            builder = builder.set_directory(trimmed);
        }
    }
    let path = builder.blocking_pick_folder();
    let Some(fp) = path else {
        return Ok(None);
    };
    let path_buf = fp.into_path().map_err(|e| e.to_string())?;
    let canonical = path_buf.canonicalize().map_err(|e| e.to_string())?;
    let path_str = canonical.to_string_lossy().into_owned();
    if let Err(e) = write_workspace_path(Some(&path_str)) {
        eprintln!("[pick_workspace_folder] write_workspace_path failed: {}", e);
    }
    Ok(Some(path_str))
}

/// Resolve directory to an absolute path; if None or empty or "~", use home dir.
fn resolve_workspace_dir(directory: Option<String>) -> Result<Option<std::path::PathBuf>, String> {
    let dir = match directory {
        None => return Ok(Some(std::path::PathBuf::from(get_home_dir()?))),
        Some(s) if s.trim().is_empty() || s.trim() == "~" => {
            std::path::PathBuf::from(get_home_dir()?)
        }
        Some(s) => return Ok(Some(std::path::PathBuf::from(s))),
    };
    Ok(Some(dir))
}

/// Kill any process listening on the given port. Used before restarting OpenCode with a new workspace directory.
#[tauri::command]
fn kill_process_on_port(port: u16) -> Result<(), String> {
    #[cfg(unix)]
    {
        let status = std::process::Command::new("sh")
            .args([
                "-c",
                &format!("lsof -ti :{port} 2>/dev/null | xargs kill -9 2>/dev/null; true"),
            ])
            .status()
            .map_err(|e| format!("执行结束进程失败: {}", e))?;
        if !status.success() {
            // 可能没有进程在监听，不算错误
        }
        Ok(())
    }
    #[cfg(windows)]
    {
        // Windows: 根据端口找 PID 再 taskkill（可选，暂不实现则返回 Ok）
        let _ = port;
        Ok(())
    }
}

/// Run shell with login profile to get user's PATH, then `which <name>` and return first line of stdout if success.
#[cfg(unix)]
fn which_via_login_shell(name: &str) -> Option<PathBuf> {
    let shell = std::env::var("SHELL").ok().filter(|s| !s.is_empty());
    let shell = shell.as_deref().unwrap_or("/bin/zsh");
    let output = std::process::Command::new(shell)
        .args(["-lc", &format!("which {name} 2>/dev/null")])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let line = std::str::from_utf8(&output.stdout).ok()?.lines().next()?.trim();
    if line.is_empty() {
        return None;
    }
    let path = PathBuf::from(line);
    if path.is_file() {
        Some(path)
    } else {
        None
    }
}

#[cfg(windows)]
fn which_via_login_shell(_name: &str) -> Option<PathBuf> {
    None
}

/// Search for opencode binary in PATH and common install locations.
/// Packaged apps (e.g. macOS .app) often have minimal PATH and miss /opt/homebrew/bin, /usr/local/bin.
fn find_opencode_binary() -> PathBuf {
    let name = if cfg!(windows) { "opencode.exe" } else { "opencode" };

    // 1. Try env PATH (may be limited when launched from .app)
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    // 2. Common install paths (no PATH needed when launched from .app / packaged)
    #[cfg(target_os = "macos")]
    let extra_dirs: &[&str] = &["/opt/homebrew/bin", "/usr/local/bin"];
    #[cfg(target_os = "linux")]
    let extra_dirs: &[&str] = &["/usr/local/bin", "/usr/bin"];
    #[cfg(windows)]
    let extra_dirs: &[&str] = &[];

    #[cfg(unix)]
    for dir in extra_dirs {
        let candidate = PathBuf::from(dir).join(name);
        if candidate.is_file() {
            return candidate;
        }
    }

    #[cfg(target_os = "linux")]
    if let Ok(home) = std::env::var("HOME") {
        let candidate = PathBuf::from(&home).join(".local/bin").join(name);
        if candidate.is_file() {
            return candidate;
        }
    }

    // 3. Use login shell's PATH (e.g. from ~/.zprofile) so we find opencode when launched from .app
    if let Some(path) = which_via_login_shell(name) {
        return path;
    }

    // Fallback: use name only (fails in .app when PATH is empty)
    PathBuf::from(name)
}

/// Start OpenCode serve in the background. Prefers bundled sidecar (binaries/opencode); falls back to PATH or common install paths.
/// Returns "sidecar" if the bundled binary was used, "path" if the system opencode was used.
#[tauri::command]
fn start_opencode_serve(
    app: tauri::AppHandle,
    port: Option<u16>,
    directory: Option<String>,
) -> Result<String, String> {
    let port = port.unwrap_or(DEFAULT_OPENCODE_PORT);
    let port_str = port.to_string();
    let resolved = resolve_workspace_dir(directory)?;
    if let Some(ref path_buf) = resolved {
        let path = path_buf.as_path();
        if !path.exists() {
            return Err(format!("工作区路径不存在: {}", path.display()));
        }
        if !path.is_dir() {
            return Err(format!("工作区路径不是目录: {}", path.display()));
        }
    }

    // CORS: dev uses localhost:1420; production webview may use tauri://localhost or https://asset.localhost
    let args = [
        "serve",
        "--hostname",
        "127.0.0.1",
        "--port",
        port_str.as_str(),
        "--cors",
        "http://localhost:1420",
        "--cors",
        "tauri://localhost",
        "--cors",
        "https://asset.localhost",
    ];

    // 1. Prefer bundled sidecar (user downloads app = app includes opencode)
    if let Ok(sidecar) = app.shell().sidecar("opencode") {
        let mut sidecar_cmd = sidecar.args(&args);
        if let Some(ref path_buf) = resolved {
            sidecar_cmd = sidecar_cmd.current_dir(path_buf.as_path());
        }
        match sidecar_cmd.spawn() {
            Ok((_rx, child)) => {
                std::mem::forget(child);
                return Ok("sidecar".to_string());
            }
            Err(e) => {
                return Err(format!(
                    "Failed to start bundled OpenCode: {}. Restart the app or reinstall.",
                    e
                ));
            }
        }
    }

    // 2. Fallback: opencode on PATH or in common install paths (dev / no sidecar)
    let opencode_bin = find_opencode_binary();
    let mut cmd = std::process::Command::new(&opencode_bin);
    cmd.args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    if let Some(ref path_buf) = resolved {
        cmd.current_dir(path_buf.as_path());
    }
    match cmd.spawn() {
        Ok(_child) => Ok("path".to_string()),
        Err(e) => Err(format!(
            "Failed to start opencode serve: {}. Install OpenCode (e.g. brew install opencode) or use a build that includes it.",
            e
        )),
    }
}

/// Parse YAML frontmatter (between --- ... ---) for name and description. Returns (name, description) or None if invalid.
fn parse_skill_frontmatter(content: &str) -> Option<(String, String)> {
    let rest = content.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    let block = &rest[..end];
    let mut name = None;
    let mut description = None;
    for line in block.lines() {
        let line = line.trim();
        if let Some(v) = line.strip_prefix("name:") {
            name = Some(v.trim().trim_matches('"').trim_matches('\'').to_string());
        } else if let Some(v) = line.strip_prefix("description:") {
            description = Some(v.trim().trim_matches('"').trim_matches('\'').to_string());
        }
    }
    let name = name.filter(|s| !s.is_empty())?;
    let description = description.filter(|s| !s.is_empty())?;
    Some((name, description))
}

/// Install a skill from a zip file. Target: "global" (~/.config/opencode/skills/<name>) or "project" (project_path/.opencode/skills/<name>).
/// Zip must contain SKILL.md with YAML frontmatter name + description. On failure, cleans up partial dir.
#[tauri::command]
fn install_skill_from_zip(
    zip_path: String,
    target: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let zip_path = Path::new(&zip_path);
    if !zip_path.is_file() {
        return Err("所选文件不存在或不是文件".to_string());
    }
    let file = fs::File::open(zip_path).map_err(|e| format!("无法打开 zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("无效的 zip 文件: {}", e))?;

    // Find SKILL.md: root or inside single top-level dir
    let mut skill_md_entry: Option<(usize, String)> = None;
    let mut top_level_dirs: std::collections::HashSet<String> = std::collections::HashSet::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| format!("zip 条目无效: {}", e))?;
        let name = entry.name().to_string();
        if name.ends_with('/') {
            if let Some(first) = name.split('/').next() {
                if !first.is_empty() {
                    top_level_dirs.insert(first.to_string());
                }
            }
            continue;
        }
        let normalized = name.replace('\\', "/");
        if normalized == "SKILL.md" {
            skill_md_entry = Some((i, "SKILL.md".to_string()));
            break;
        }
        if let Some(prefix) = normalized.split('/').next() {
            if !prefix.is_empty() && normalized.ends_with("SKILL.md") {
                top_level_dirs.insert(prefix.to_string());
                skill_md_entry = Some((i, normalized));
            }
        }
    }
    let (skill_md_index, skill_md_path) = match skill_md_entry {
        Some(x) => x,
        None => return Err("zip 中未找到 SKILL.md".to_string()),
    };

    // Read SKILL.md and parse frontmatter (in block so ZipFile borrow is dropped before we use archive again)
    let (skill_name, _description) = {
        let mut entry = archive.by_index(skill_md_index).map_err(|e| format!("zip 条目无效: {}", e))?;
        let mut content = String::new();
        entry.read_to_string(&mut content).map_err(|e| format!("无法读取 SKILL.md: {}", e))?;
        parse_skill_frontmatter(&content)
            .ok_or("SKILL.md 缺少有效的 YAML frontmatter（需包含 name 与 description）")?
    };

    // Sanitize dir name
    let dir_name = skill_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    if dir_name.is_empty() {
        return Err("skill name 无效".to_string());
    }

    let base = match target.as_str() {
        "project" => {
            let project = project_path.ok_or("选择「当前项目」时需提供项目路径")?;
            Path::new(&project).join(".opencode").join("skills")
        }
        _ => {
            dirs::config_dir().ok_or("无法获取配置目录")?.join("opencode").join("skills")
        }
    };
    let dest_dir = base.join(&dir_name);

    if dest_dir.exists() {
        return Err(format!("已存在同名 skill：{}", dir_name));
    }
    fs::create_dir_all(&dest_dir).map_err(|e| format!("无法创建目录: {}", e))?;

    let strip_prefix: String = if skill_md_path.contains('/') {
        skill_md_path.split('/').next().unwrap_or("").to_string() + "/"
    } else {
        String::new()
    };

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("zip 条目无效: {}", e))?;
        let name = entry.name().to_string().replace('\\', "/");
        if name.ends_with('/') {
            continue;
        }
        let rel: String = if strip_prefix.is_empty() {
            name.clone()
        } else if let Some(rest) = name.strip_prefix(&strip_prefix) {
            rest.to_string()
        } else {
            continue;
        };
        if rel.is_empty() || rel.contains("..") {
            continue;
        }
        let out_path = dest_dir.join(&rel);
        if let Some(p) = out_path.parent() {
            fs::create_dir_all(p).map_err(|e| format!("无法创建子目录: {}", e))?;
        }
        let mut out_file = fs::File::create(&out_path).map_err(|e| format!("无法创建文件 {}: {}", rel, e))?;
        std::io::copy(&mut entry, &mut out_file).map_err(|e| format!("写入失败 {}: {}", rel, e))?;
    }

    // Validate: dest must have SKILL.md with valid frontmatter
    let skill_md_dest = dest_dir.join("SKILL.md");
    if !skill_md_dest.is_file() {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err("解压后未找到 SKILL.md".to_string());
    }
    let content = fs::read_to_string(&skill_md_dest).map_err(|e| format!("无法读取 SKILL.md: {}", e))?;
    if parse_skill_frontmatter(&content).is_none() {
        let _ = fs::remove_dir_all(&dest_dir);
        return Err("SKILL.md 缺少有效的 YAML frontmatter（name 与 description）".to_string());
    }

    Ok(skill_name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Only auto-open inspector in dev; built app uses menu "View -> Toggle Developer Tools".
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
            }
            // Menu: on macOS the first submenu is shown under the app name (e.g. "AIGO");
            // subsequent submenus appear as separate menus (Edit, View). We add an app
            // submenu first so Edit and View show in the menu bar. Edit is required for
            // Cmd+C/V/X/A to work in the webview.
            let handle = app.handle().clone();
            let app_submenu = SubmenuBuilder::new(&handle, "AIGO")
                .about(None)
                .separator()
                .quit()
                .build()?;
            let edit_submenu = SubmenuBuilder::new(&handle, "Edit")
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;
            let view_submenu = SubmenuBuilder::new(&handle, "View")
                .text("open_devtools", "Toggle Developer Tools")
                .build()?;
            let menu = Menu::with_items(&handle, &[&app_submenu, &edit_submenu, &view_submenu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "open_devtools" {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_platform,
            get_home_dir,
            read_workspace_path,
            save_workspace_path,
            pick_workspace_folder,
            kill_process_on_port,
            start_opencode_serve,
            install_skill_from_zip,
            read_attachment_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
