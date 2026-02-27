// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::Duration;
use tauri::{Emitter, Manager};

static INSTALL_RUN_ID: AtomicU64 = AtomicU64::new(0);

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

/// Resolve npx binary path (for npx skills add on Windows). On Unix we run npx via login shell instead.
#[cfg(windows)]
fn find_npx_binary() -> PathBuf {
    let name = if cfg!(windows) { "npx.cmd" } else { "npx" };

    // 1. Try env PATH
    if let Ok(path_var) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path_var) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    // 2. Common install paths (Homebrew / system)
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

    // 3. Login shell PATH (nvm/fnm from .zprofile etc.)
    #[cfg(unix)]
    if let Some(path) = which_via_login_shell("npx") {
        return path;
    }

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

/// Result returned by install_skill_from_zip (name + description from SKILL.md frontmatter).
#[derive(serde::Serialize)]
struct InstallSkillFromZipResult {
    name: String,
    description: String,
}

/// Sync implementation of zip install (run in spawn_blocking so UI stays responsive).
fn install_skill_from_zip_sync(
    zip_path: String,
    target: String,
    project_path: Option<String>,
) -> Result<InstallSkillFromZipResult, String> {
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
        _ => canonical_global_skill_root().ok_or("无法获取配置目录")?,
    };
    let dest_dir = base.join(&dir_name);

    if dest_dir.exists() {
        fs::remove_dir_all(&dest_dir).map_err(|e| format!("无法移除已存在的目录 {}: {}", dir_name, e))?;
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
    let (_, description) = parse_skill_frontmatter(&content)
        .ok_or_else(|| {
            let _ = fs::remove_dir_all(&dest_dir);
            "SKILL.md 缺少有效的 YAML frontmatter（name 与 description）".to_string()
        })?;

    Ok(InstallSkillFromZipResult {
        name: skill_name,
        description,
    })
}

/// Install a skill from a zip file. Target: "global" or "project". Runs in a blocking task so the UI stays responsive.
#[tauri::command]
async fn install_skill_from_zip(
    zip_path: String,
    target: String,
    project_path: Option<String>,
) -> Result<InstallSkillFromZipResult, String> {
    tokio::task::spawn_blocking(move || install_skill_from_zip_sync(zip_path, target, project_path))
        .await
        .map_err(|e| format!("安装任务失败: {}", e))?
}

/// Strip ANSI escape sequences (e.g. `\x1b[38;5;145m`, `\x1b[0m`) from a string.
fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut bytes = s.bytes().peekable();
    while let Some(b) = bytes.next() {
        if b != 0x1b {
            out.push(char::from(b));
            continue;
        }
        if bytes.peek() != Some(&b'[') {
            out.push('\x1b');
            continue;
        }
        let _ = bytes.next(); // consume '['
        while let Some(&b) = bytes.peek() {
            if b == b'm' || (b'A'..=b'Z').contains(&b) || (b'a'..=b'z').contains(&b) {
                let _ = bytes.next();
                break;
            }
            let _ = bytes.next();
        }
    }
    out
}

/// Search skills via `npx skills find <query>`. Parses stdout for owner/repo@skill or owner/repo lines.
#[tauri::command]
fn search_skills_via_cli(query: String) -> Result<serde_json::Value, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(serde_json::json!({ "items": [], "raw": "" }));
    }
    #[cfg(windows)]
    let output = {
        let full_cmd = format!("npx skills find \"{}\"", query.replace('"', "\\\""));
        Command::new("cmd")
            .args(["/C", &full_cmd])
            .output()
            .map_err(|e| format!("执行 npx 失败: {}", e))?
    };
    #[cfg(not(windows))]
    let output = Command::new("npx")
        .args(["skills", "find", query])
        .output()
        .map_err(|e| format!("执行 npx 失败: {}", e))?;

    let raw_stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let raw_stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let mut items: Vec<serde_json::Value> = Vec::new();
    for line in raw_stdout.lines() {
        let line = strip_ansi(line).trim().to_string();
        if line.is_empty() || line.starts_with("Install with") || line.starts_with('└') {
            continue;
        }
        if line.contains('@') {
            if let Some((source, skill_name)) = line.split_once('@') {
                let source = source.trim().to_string();
                let skill_name = skill_name.trim();
                let skill_name = if let Some(rest) = skill_name.strip_suffix("installs") {
                    let rest = rest.trim();
                    let end = rest
                        .char_indices()
                        .rev()
                        .take_while(|(_, c)| c.is_ascii_digit() || c.is_whitespace())
                        .last()
                        .map(|(i, _)| i)
                        .unwrap_or(rest.len());
                    rest[..end].trim()
                } else {
                    skill_name
                };
                let skill_name = skill_name.to_string();
                if source.contains('/') && !source.starts_with("http") {
                    items.push(serde_json::json!({
                        "source": source,
                        "skillName": if skill_name.is_empty() { serde_json::Value::Null } else { serde_json::json!(skill_name) }
                    }));
                }
            }
        } else if line.contains('/') && !line.starts_with("http") && !line.contains(' ') {
            let source = line.to_string();
            items.push(serde_json::json!({ "source": source }));
        }
    }
    if !output.status.success() && items.is_empty() {
        let err_msg = raw_stderr.trim().to_string();
        return Err(if err_msg.is_empty() {
            "npx skills find 执行失败（请确认已安装 Node.js 与 npx）".to_string()
        } else {
            format!("npx skills find 执行失败: {}", err_msg)
        });
    }
    Ok(serde_json::json!({
        "items": items,
        "raw": raw_stdout
    }))
}

const SKILLS_SH_SEARCH_URL: &str = "https://skills.sh/api/search";
const DEFAULT_SEARCH_QUERY: &str = "skill";
const SKILLS_SH_PAGE_SIZE: u32 = 50;

#[derive(serde::Deserialize)]
struct SkillsShHit {
    source: String,
    #[serde(alias = "skillId")]
    skill_id: Option<String>,
    name: Option<String>,
    installs: Option<u64>,
}

#[derive(serde::Deserialize)]
struct SkillsShSearchResponse {
    skills: Option<Vec<SkillsShHit>>,
    count: Option<u32>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchResultItem {
    source: String,
    skill_name: Option<String>,
    installs: Option<u64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchSkillsShResult {
    items: Vec<SearchResultItem>,
    count: u32,
    has_more: bool,
}

/// Search skills via skills.sh public API (no CORS; works in dev and packaged app).
/// Uses async HTTP so the Rust runtime is not blocked and the frontend stays responsive.
#[tauri::command]
async fn search_skills_via_api(
    q: String,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<SearchSkillsShResult, String> {
    let q = q.trim();
    let q = if q.is_empty() {
        DEFAULT_SEARCH_QUERY.to_string()
    } else {
        q.to_string()
    };
    let limit = limit.unwrap_or(SKILLS_SH_PAGE_SIZE);
    let offset = offset.unwrap_or(0);

    let url = format!(
        "{}?q={}&limit={}&offset={}",
        SKILLS_SH_SEARCH_URL,
        urlencoding::encode(&q),
        limit,
        offset
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP 客户端创建失败: {}", e))?;
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("请求 skills.sh 失败: {}", e))?;
    let status = res.status();
    let body = res.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    if !status.is_success() {
        return Err(format!("skills.sh 返回错误: {} {}", status, body));
    }
    let data: SkillsShSearchResponse =
        serde_json::from_str(&body).map_err(|e| format!("解析 skills.sh 响应失败: {}", e))?;
    let skills = data.skills.unwrap_or_default();
    let count = data.count.unwrap_or(skills.len() as u32);
    let items: Vec<SearchResultItem> = skills
        .into_iter()
        .map(|h| SearchResultItem {
            source: h.source,
            skill_name: h.skill_id.or(h.name),
            installs: h.installs,
        })
        .collect();
    let has_more = count >= limit;
    Ok(SearchSkillsShResult {
        count,
        has_more,
        items,
    })
}

/// Get PATH from login shell with a short timeout. If shell hangs (e.g. in GUI without TTY), we fall back to current env PATH.
#[cfg(unix)]
fn get_path_via_shell_with_timeout(secs: u64) -> String {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let shell = std::env::var("SHELL").ok().filter(|s| !s.is_empty());
        let shell = shell.as_deref().unwrap_or("/bin/zsh");
        let out = Command::new(shell)
            .args(["-lc", "printf '%s' \"$PATH\""])
            .stdin(Stdio::null())
            .output();
        if let Ok(o) = out {
            if o.status.success() {
                let _ = tx.send(String::from_utf8_lossy(&o.stdout).trim().to_string());
            }
        }
    });
    rx.recv_timeout(Duration::from_secs(secs))
        .unwrap_or_else(|_| std::env::var("PATH").unwrap_or_default())
}

/// Find npx binary in a PATH string (colon-separated on Unix). Also checks common install dirs.
#[cfg(unix)]
fn find_npx_in_path(path_str: &str) -> PathBuf {
    let name = "npx";
    for dir in std::env::split_paths(path_str) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return candidate;
        }
    }
    for dir in &["/opt/homebrew/bin", "/usr/local/bin"] {
        let candidate = PathBuf::from(dir).join(name);
        if candidate.is_file() {
            return candidate;
        }
    }
    PathBuf::from(name)
}

/// Run npx on Unix: get PATH from shell (with timeout to avoid hang in GUI), then run npx directly with that PATH so we never run npx inside a shell.
#[cfg(unix)]
fn run_npx_unix(args: &[&str], project_path: Option<&str>) -> Result<std::process::Output, String> {
    let path_env = get_path_via_shell_with_timeout(5);
    let npx_bin = find_npx_in_path(&path_env);
    let mut cmd = Command::new(&npx_bin);
    cmd.args(args)
        .stdin(Stdio::null())
        .env("PATH", &path_env)
        .env("CI", "true")
        .env("npm_config_yes", "true")
        .env("NPX_YES", "true");
    if let Some(p) = project_path.filter(|s| !s.is_empty()) {
        cmd.current_dir(p);
    }
    cmd.output().map_err(|e| format!("执行 npx 失败: {}", e))
}

/// Spawn npx on Unix with piped stdout/stderr for streaming output.
#[cfg(unix)]
fn run_npx_unix_spawn(args: &[&str], project_path: Option<&str>) -> Result<std::process::Child, String> {
    let path_env = get_path_via_shell_with_timeout(5);
    let npx_bin = find_npx_in_path(&path_env);
    let mut cmd = Command::new(&npx_bin);
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("PATH", &path_env)
        .env("CI", "true")
        .env("npm_config_yes", "true")
        .env("NPX_YES", "true");
    if let Some(p) = project_path.filter(|s| !s.is_empty()) {
        cmd.current_dir(p);
    }
    cmd.spawn().map_err(|e| format!("执行 npx 失败: {}", e))
}

/// Sync implementation of npx skills add (run in spawn_blocking so UI stays responsive).
/// On Unix runs npx via login shell so PATH/env match terminal and npx doesn't hang in GUI.
fn install_skill_from_source_sync(
    app: tauri::AppHandle,
    source: String,
    skill_name: Option<String>,
    target: String,
    project_path: Option<String>,
) -> Result<(), String> {
    let source = source.trim();
    if source.is_empty() {
        return Err("source 不能为空".to_string());
    }

    let mut args: Vec<&str> = vec!["skills", "add", source];
    if target == "global" {
        args.push("-g");
    }
    args.extend(["-a", "opencode", "-y"]);
    if let Some(ref name) = skill_name {
        if !name.is_empty() {
            args.push("--skill");
            args.push(name.as_str());
        }
    }

    #[cfg(windows)]
    let output = {
        let npx_bin = find_npx_binary();
        let npx_args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
        let cmd_str = std::iter::once(npx_bin.to_string_lossy().to_string())
            .chain(npx_args)
            .collect::<Vec<_>>()
            .join(" ");
        Command::new("cmd")
            .args(["/C", &cmd_str])
            .current_dir(project_path.as_deref().unwrap_or("."))
            .stdin(Stdio::null())
            .output()
            .map_err(|e| format!("执行 npx 失败: {}", e))?
    };
    #[cfg(unix)]
    let output = run_npx_unix(&args, project_path.as_deref())?;

    let _ = app.emit("install_skill_progress", serde_json::json!({ "stage": "done" }));

    if output.status.success() {
        Ok(())
    } else {
        let stderr_raw = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout_raw = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = strip_ansi(&stderr_raw).trim().to_string();
        let stdout = strip_ansi(&stdout_raw);
        let code = output.status.code().unwrap_or(-1);
        let err_msg = if !stderr.is_empty() {
            stderr
        } else {
            // npx skills often prints errors to stdout (below the logo); take last meaningful line or line containing error keywords
            let lines: Vec<&str> = stdout.lines().map(str::trim).filter(|s| !s.is_empty()).collect();
            let error_line = lines
                .iter()
                .rev()
                .find(|s| {
                    let lower = s.to_lowercase();
                    lower.contains("failed")
                        || lower.contains("error")
                        || lower.contains("not found")
                        || lower.contains("permitted")
                        || s.contains('■')
                        || lower.contains("canceled")
                })
                .or_else(|| lines.last())
                .map(|s| (*s).to_string())
                .unwrap_or_else(|| {
                    if stdout.trim().is_empty() {
                        "请确认已安装 Node.js 与 npx，并检查网络后重试。".to_string()
                    } else {
                        lines.last().map(|s| (*s).to_string()).unwrap_or_default()
                    }
                });
            if error_line.is_empty() {
                "请确认已安装 Node.js 与 npx，并检查网络后重试。".to_string()
            } else {
                error_line
            }
        };
        Err(format!("安装失败（exit code: {}）。{}", code, err_msg))
    }
}

/// Event payload for streaming command output (stdout/stderr).
#[derive(Clone, serde::Serialize)]
struct CmdOutputPayload {
    run_id: String,
    stream: String,
    data: String,
}

/// Event payload when command exits.
#[derive(Clone, serde::Serialize)]
struct CmdExitPayload {
    run_id: String,
    exit_code: i32,
}

/// Runs npx skills add with piped stdout/stderr, reads streams in threads and emits cmd_output / cmd_exit.
fn install_skill_from_source_stream_sync(
    app: tauri::AppHandle,
    run_id: String,
    source: String,
    skill_name: Option<String>,
    target: String,
    project_path: Option<String>,
) {
    let source = source.trim();
    if source.is_empty() {
        let _ = app.emit("cmd_output", CmdOutputPayload { run_id: run_id.clone(), stream: "stderr".into(), data: "source 不能为空".to_string() });
        let _ = app.emit("cmd_exit", CmdExitPayload { run_id, exit_code: -1 });
        return;
    }

    let mut args: Vec<&str> = vec!["skills", "add", source];
    if target == "global" {
        args.push("-g");
    }
    args.extend(["-a", "opencode", "-y"]);
    if let Some(ref name) = skill_name {
        if !name.is_empty() {
            args.push("--skill");
            args.push(name.as_str());
        }
    }

    #[cfg(windows)]
    let child_result = {
        let npx_bin = find_npx_binary();
        let npx_args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
        let cmd_str = std::iter::once(npx_bin.to_string_lossy().to_string())
            .chain(npx_args)
            .collect::<Vec<_>>()
            .join(" ");
        Command::new("cmd")
            .args(["/C", &cmd_str])
            .current_dir(project_path.as_deref().unwrap_or("."))
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("执行 npx 失败: {}", e))
    };

    #[cfg(unix)]
    let child_result = run_npx_unix_spawn(&args, project_path.as_deref());

    let mut child = match child_result {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("cmd_output", CmdOutputPayload { run_id: run_id.clone(), stream: "stderr".into(), data: e.clone() });
            let _ = app.emit("cmd_exit", CmdExitPayload { run_id, exit_code: -1 });
            return;
        }
    };

    let mut stdout = match child.stdout.take() {
        Some(s) => s,
        None => {
            let _ = app.emit("cmd_exit", CmdExitPayload { run_id, exit_code: -1 });
            return;
        }
    };
    let mut stderr = match child.stderr.take() {
        Some(s) => s,
        None => {
            let _ = app.emit("cmd_exit", CmdExitPayload { run_id, exit_code: -1 });
            return;
        }
    };

    /// Emit complete UTF-8 from buffer; return trailing incomplete bytes to prepend to next read.
    fn emit_utf8_complete(
        buf: &[u8],
        n: usize,
        pending: &mut Vec<u8>,
        strip_and_emit: impl FnOnce(String),
    ) {
        if n == 0 {
            return;
        }
        let mut tail_continuation = 0usize;
        for i in (0..n).rev() {
            if (0x80..=0xBF).contains(&buf[i]) {
                tail_continuation += 1;
            } else {
                break;
            }
        }
        let split = n.saturating_sub(tail_continuation + 1);
        if split > 0 {
            let s = strip_ansi(&String::from_utf8_lossy(&buf[..split]).to_string());
            if !s.is_empty() {
                strip_and_emit(s);
            }
        }
        pending.clear();
        pending.extend_from_slice(&buf[split..n]);
    }

    let app_out = app.clone();
    let app_exit = app.clone();
    let run_id_out = run_id.clone();
    let run_id_exit = run_id.clone();
    let th_out = std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending: Vec<u8> = Vec::with_capacity(4);
        loop {
            let read_range = if pending.is_empty() {
                0..buf.len()
            } else {
                let plen = pending.len();
                buf[..plen].copy_from_slice(&pending);
                pending.clear();
                plen..buf.len()
            };
            let read_start = read_range.start;
            match std::io::Read::read(&mut stdout, &mut buf[read_range]) {
                Ok(0) => {
                    if read_start > 0 {
                        let s = strip_ansi(&String::from_utf8_lossy(&buf[..read_start]).to_string());
                        if !s.is_empty() {
                            let _ = app_out.emit("cmd_output", CmdOutputPayload { run_id: run_id_out.clone(), stream: "stdout".into(), data: s });
                        }
                    }
                    break;
                }
                Ok(n_read) => {
                    let n = read_start + n_read;
                    emit_utf8_complete(&buf, n, &mut pending, |s| {
                        let _ = app_out.emit("cmd_output", CmdOutputPayload { run_id: run_id_out.clone(), stream: "stdout".into(), data: s });
                    });
                }
                Err(_) => break,
            }
        }
    });
    let th_err = std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        let mut pending: Vec<u8> = Vec::with_capacity(4);
        loop {
            let read_range = if pending.is_empty() {
                0..buf.len()
            } else {
                let plen = pending.len();
                buf[..plen].copy_from_slice(&pending);
                pending.clear();
                plen..buf.len()
            };
            let read_start = read_range.start;
            match std::io::Read::read(&mut stderr, &mut buf[read_range]) {
                Ok(0) => {
                    if read_start > 0 {
                        let s = strip_ansi(&String::from_utf8_lossy(&buf[..read_start]).to_string());
                        if !s.is_empty() {
                            let _ = app.emit("cmd_output", CmdOutputPayload { run_id: run_id.clone(), stream: "stderr".into(), data: s });
                        }
                    }
                    break;
                }
                Ok(n_read) => {
                    let n = read_start + n_read;
                    emit_utf8_complete(&buf, n, &mut pending, |s| {
                        let _ = app.emit("cmd_output", CmdOutputPayload { run_id: run_id.clone(), stream: "stderr".into(), data: s });
                    });
                }
                Err(_) => break,
            }
        }
    });

    th_out.join().ok();
    th_err.join().ok();

    let code = child.wait().ok().and_then(|s| s.code()).unwrap_or(-1);
    let _ = app_exit.emit("cmd_exit", CmdExitPayload { run_id: run_id_exit, exit_code: code });
}

/// Install a skill via `npx skills add <source> -g -a opencode -y`. Returns run_id immediately; streams stdout/stderr via cmd_output events and final exit via cmd_exit.
#[tauri::command]
async fn install_skill_from_source(
    app: tauri::AppHandle,
    source: String,
    skill_name: Option<String>,
    target: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let source_trimmed = source.trim();
    if source_trimmed.is_empty() {
        return Err("source 不能为空".to_string());
    }

    let run_id = INSTALL_RUN_ID.fetch_add(1, Ordering::Relaxed).to_string();
    let app_clone = app.clone();
    let run_id_clone = run_id.clone();
    tokio::task::spawn(async move {
        tokio::task::spawn_blocking(move || {
            install_skill_from_source_stream_sync(app_clone, run_id_clone, source, skill_name, target, project_path);
        })
        .await
        .ok();
    });
    Ok(run_id)
}

/// Sanitize skill name to directory name (alphanumeric, '-', '_' only), same as install_skill_from_zip.
fn skill_name_to_dir_name(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Single canonical root for global skill install (zip and "exists" check). Keeps one source of truth.
fn canonical_global_skill_root() -> Option<PathBuf> {
    dirs::config_dir().map(|c| c.join("opencode").join("skills"))
}

/// All allowed global skill roots (OpenCode / npx skills may use any of these). Uninstall removes from all.
fn global_skill_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".config").join("opencode").join("skills"));
        roots.push(home.join(".agents").join("skills"));
    }
    if let Some(canonical) = canonical_global_skill_root() {
        if !roots.contains(&canonical) {
            roots.push(canonical);
        }
    }
    roots
}

/// One installed skill item (name, description, path on disk). Single source of truth: read from filesystem.
#[derive(serde::Serialize)]
struct InstalledSkillItem {
    name: String,
    description: String,
    location: String,
}

/// List installed skills by reading skill roots on disk (canonical + known roots). Each subdir with valid SKILL.md frontmatter is one skill. Deduped by name.
#[tauri::command]
fn list_installed_skills(project_path: Option<String>) -> Result<Vec<InstalledSkillItem>, String> {
    let mut seen_names = std::collections::HashSet::<String>::new();
    let mut out = Vec::new();

    for root in global_skill_roots() {
        if !root.exists() {
            continue;
        }
        let entries = match fs::read_dir(&root) {
            Ok(e) => e,
            Err(_e) => {
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let skill_md = path.join("SKILL.md");
            if !skill_md.is_file() {
                continue;
            }
            let content = match fs::read_to_string(&skill_md) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let (name, description) = match parse_skill_frontmatter(&content) {
                Some(p) => p,
                None => continue,
            };
            let name_lower = name.to_lowercase();
            if seen_names.contains(&name_lower) {
                continue;
            }
            seen_names.insert(name_lower);
            let location = path.to_string_lossy().to_string();
            out.push(InstalledSkillItem {
                name,
                description,
                location,
            });
        }
    }

    if let Some(proj) = project_path.filter(|s| !s.is_empty()) {
        let proj_path = Path::new(&proj);
        for sub in [".opencode/skills", ".agents/skills"] {
            let root = proj_path.join(sub);
            if !root.exists() {
                continue;
            }
            let entries = match fs::read_dir(&root) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let skill_md = path.join("SKILL.md");
                if !skill_md.is_file() {
                    continue;
                }
                let content = match fs::read_to_string(&skill_md) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                let (name, description) = match parse_skill_frontmatter(&content) {
                    Some(p) => p,
                    None => continue,
                };
                let name_lower = name.to_lowercase();
                if seen_names.contains(&name_lower) {
                    continue;
                }
                seen_names.insert(name_lower);
                let location = path.to_string_lossy().to_string();
                out.push(InstalledSkillItem {
                    name,
                    description,
                    location,
                });
            }
        }
    }

    Ok(out)
}

/// Resolve the filesystem path of a globally installed skill by name. Returns the first existing directory under known global roots.
#[tauri::command]
fn resolve_global_skill_path(skill_name: String) -> Option<String> {
    let name = skill_name.trim();
    if name.is_empty() {
        return None;
    }
    let dir_name = skill_name_to_dir_name(name);
    if dir_name.is_empty() {
        return None;
    }
    for root in global_skill_roots() {
        if root.exists() {
            let skill_dir = root.join(&dir_name);
            if skill_dir.is_dir() {
                return skill_dir.to_string_lossy().into_owned().into();
            }
        }
    }
    None
}

/// Returns true if `path` is under one of the allowed skill roots (global config or project .opencode/.agents/skills).
fn is_allowed_skill_path(path: &Path, project_path: Option<&str>) -> bool {
    let canonical = match path.canonicalize() {
        Ok(p) => p,
        Err(_) => return false,
    };
    for root in global_skill_roots() {
        if root.exists() {
            if let Ok(prefix) = root.canonicalize() {
                if canonical.starts_with(&prefix) {
                    return true;
                }
            }
        }
    }
    if let Some(proj) = project_path.filter(|s| !s.is_empty()) {
        let proj_path = Path::new(proj);
        for sub in [".opencode/skills", ".agents/skills"] {
            let root = proj_path.join(sub);
            if root.exists() {
                if let Ok(prefix) = root.canonicalize() {
                    if canonical.starts_with(&prefix) {
                        return true;
                    }
                }
            }
        }
    }
    false
}

/// Uninstall a skill: run `npx skills remove` for project and global scope, then remove skill directory by path if given.
/// Uses async process so the UI stays responsive.
#[tauri::command]
async fn uninstall_skill(
    skill_name: String,
    project_path: Option<String>,
    skill_location: Option<String>,
) -> Result<(), String> {
    let name = skill_name.trim();
    if name.is_empty() {
        return Err("skill 名称不能为空".to_string());
    }

    // 1) Remove from project scope (so project-level install is actually removed)
    if let Some(ref proj) = project_path {
        if !proj.is_empty() {
            let args = ["skills", "remove", name, "-a", "opencode", "-y"];
            #[cfg(windows)]
            let output = {
                let npx_args: Vec<String> = args.iter().map(|s| (*s).to_string()).collect();
                let cmd_str = std::iter::once("npx".to_string())
                    .chain(npx_args)
                    .collect::<Vec<_>>()
                    .join(" ");
                tokio::process::Command::new("cmd")
                    .args(["/C", &cmd_str])
                    .current_dir(proj)
                    .output()
                    .await
                    .map_err(|e| format!("执行 npx 失败: {}", e))?
            };
            #[cfg(not(windows))]
            let output = {
                let mut cmd = tokio::process::Command::new("npx");
                cmd.args(&args).current_dir(proj);
                cmd.output().await.map_err(|e| format!("执行 npx 失败: {}", e))?
            };
            // Ignore project remove failure (skill might be global-only)
            let _ = output;
        }
    }

    // 2) Remove from global scope
    let args_global = ["skills", "remove", name, "-g", "-a", "opencode", "-y"];
    #[cfg(windows)]
    let _output_global = {
        let npx_args: Vec<String> = args_global.iter().map(|s| (*s).to_string()).collect();
        let cmd_str = std::iter::once("npx".to_string())
            .chain(npx_args)
            .collect::<Vec<_>>()
            .join(" ");
        tokio::process::Command::new("cmd")
            .args(["/C", &cmd_str])
            .output()
            .await
            .map_err(|e| format!("执行 npx 失败: {}", e))?
    };
    #[cfg(not(windows))]
    let _output_global = {
        let mut cmd = tokio::process::Command::new("npx");
        cmd.args(&args_global);
        cmd.output().await.map_err(|e| format!("执行 npx 失败: {}", e))?
    };

    // 3) Directly remove skill directory: first by path if provided, then by name in all known roots
    let dir_name = skill_name_to_dir_name(name);
    let mut dir_names = vec![];
    if !dir_name.is_empty() {
        dir_names.push(dir_name.clone());
        let lower = dir_name.to_lowercase();
        if lower != dir_name {
            dir_names.push(lower);
        }
    }
    if let Some(ref loc) = skill_location {
        let loc = loc.trim();
        if !loc.is_empty() {
            let path = Path::new(loc);
            if path.is_dir()
                && is_allowed_skill_path(path, project_path.as_deref())
            {
                let _ = fs::remove_dir_all(path);
            }
            // Use last path component as dir name (actual folder name on disk)
            if let Some(actual_name) = path.file_name() {
                if let Some(s) = actual_name.to_str() {
                    dir_names.push(s.to_string());
                }
            }
        }
    }
    // 4) Delete by name in every known root (OpenCode uses ~/.config/opencode/skills; zip uses config_dir)
    for candidate in dir_names.iter().filter(|s| !s.is_empty()) {
        for root in global_skill_roots() {
            if root.exists() {
                let skill_dir = root.join(candidate);
                if skill_dir.is_dir() {
                    let _ = fs::remove_dir_all(&skill_dir);
                }
            }
        }
        if let Some(proj) = project_path.as_deref().filter(|s| !s.is_empty()) {
            let proj_path = Path::new(proj);
            for sub in [".opencode/skills", ".agents/skills"] {
                let skill_dir = proj_path.join(sub).join(candidate);
                if skill_dir.is_dir() {
                    let _ = fs::remove_dir_all(&skill_dir);
                }
            }
        }
    }

    // We have already tried physical delete (by path and by name in known roots); treat as success so UI stays in sync.
    Ok(())
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
            search_skills_via_cli,
            search_skills_via_api,
            install_skill_from_source,
            uninstall_skill,
            list_installed_skills,
            resolve_global_skill_path,
            read_attachment_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
