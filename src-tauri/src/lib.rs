// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::io::Read;
use std::path::Path;

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

/// Start OpenCode serve in the background. Requires `opencode` on PATH (install via brew/npm/install script).
/// If `directory` is provided, the process runs with that path as current working directory (like running opencode in that folder).
#[tauri::command]
fn start_opencode_serve(port: Option<u16>, directory: Option<String>) -> Result<(), String> {
    let port = port.unwrap_or(DEFAULT_OPENCODE_PORT);
    let port_str = port.to_string();
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
    ];
    let mut cmd = std::process::Command::new("opencode");
    cmd.args(&args)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    if let Some(ref dir) = directory {
        let path = Path::new(dir);
        if !path.exists() {
            return Err(format!("工作区路径不存在: {}", dir));
        }
        if !path.is_dir() {
            return Err(format!("工作区路径不是目录: {}", dir));
        }
        cmd.current_dir(path);
    }
    match cmd.spawn() {
        Ok(_child) => Ok(()),
        Err(e) => Err(format!(
            "Failed to start opencode serve: {}. Install OpenCode (e.g. brew install opencode) and ensure it is on PATH.",
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
        .invoke_handler(tauri::generate_handler![
            greet,
            get_platform,
            kill_process_on_port,
            start_opencode_serve,
            install_skill_from_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
