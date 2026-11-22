// MIT. 湛箴_ymzz desktop shell, Tauri 2.
//
// Responsibilities of this shell, and nothing else:
//   1. read an optional operator config from the app data directory;
//   2. start the bundled DeepSeek Harness web service as a child process
//      (bundled Node runtime, explicit environment, no shell interpolation);
//   3. poll the local service until it answers, then point the main window at
//      it;
//   4. kill the child process when the app exits.
//
// The agent itself is the complete, unmodified DeepSeek Harness. This shell
// adds no model calls, no network endpoints and no storage of its own.

use serde::Deserialize;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Preferred first port; the shell scans upward from here for a free one.
const DEFAULT_PORT: u16 = 43110;
/// How many consecutive ports to try after the preferred one.
const DEFAULT_PORT_SCAN: u32 = 20;
/// Per-probe TCP connect / read budget.
const PROBE_TIMEOUT: Duration = Duration::from_millis(750);
/// Delay between readiness probes.
const POLL_INTERVAL: Duration = Duration::from_millis(250);
/// Environment variable that must point at the bundled Node runtime.
const NODE_RUNTIME_ENV: &str = "DSH_PRIMARY_RUNTIME";
/// Opt the bundled service out of telemetry; the shell never opts back in.
const TELEMETRY_ENV: &str = "DSH_TELEMETRY_DISABLED";

/// Operator config, read from `<app data dir>/desktop/ymzz-desktop.json`.
/// Everything is optional; missing or invalid keys fall back to the defaults
/// below. No secret material belongs in this file and none is read by the shell.
#[derive(Debug, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
struct ShellConfig {
    /// Preferred port; `0` or a missing value picks the default scan range.
    port: u16,
    /// Number of consecutive ports to try after `port`.
    port_scan: u32,
    /// Node executable path relative to the bundled backend directory.
    node_path: String,
    /// Arguments for the bundled service; `{port}` is substituted per launch.
    args: Vec<String>,
    /// Path probed for readiness.
    ready_path: String,
    /// `http` (default) or `tcp`; use `tcp` when the service serves TLS.
    ready_probe: String,
    /// Total readiness budget in milliseconds.
    ready_timeout_ms: u64,
    /// Directory holding the backend, relative to the resource directory.
    backend_dir: String,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            port_scan: DEFAULT_PORT_SCAN,
            node_path: if cfg!(windows) { "node/node.exe".to_string() } else { "node/bin/node".to_string() },
            args: vec![
                "dsh/serve.mjs".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "{port}".to_string(),
            ],
            ready_path: "/".to_string(),
            ready_probe: "http".to_string(),
            ready_timeout_ms: 30_000,
            backend_dir: "backend".to_string(),
        }
    }
}

impl ShellConfig {
    /** Load from the app data directory; any problem silently yields defaults. */
    fn load(app: &tauri::AppHandle) -> Self {
        let data_dir = match app.path().app_data_dir() {
            Ok(dir) => dir,
            Err(_) => return Self::default(),
        };
        let path = data_dir.join("desktop").join("ymzz-desktop.json");
        let text = match std::fs::read_to_string(&path) {
            Ok(text) => text,
            Err(_) => return Self::default(),
        };
        match serde_json::from_str::<ShellConfig>(&text) {
            Ok(config) => config,
            Err(error) => {
                eprintln!("ymzz-desktop: ignoring invalid config {}: {error}", path.display());
                Self::default()
            }
        }
    }
}

/// Handle to the backend child process so the run loop can kill it on exit.
struct BackendChild(Mutex<Option<CommandChild>>);

/// Pick a free localhost port: preferred first, then a bounded upward scan,
/// then an ephemeral port. The listener is released immediately, so another
/// process could still claim the port (bounded, accepted race).
fn find_free_port(preferred: u16, scan: u32) -> std::io::Result<u16> {
    for offset in 0..scan {
        let candidate = u32::from(preferred) + offset;
        if candidate > u32::from(u16::MAX) {
            break;
        }
        let candidate = candidate as u16;
        if TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, candidate))).is_ok() {
            return Ok(candidate);
        }
    }
    let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

/// One plain HTTP/1.1 readiness probe over a raw TCP stream. No TLS stack is
/// bundled in the shell, so TLS services should set `readyProbe: "tcp"`.
fn probe_http(port: u16, path: &str) -> bool {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let mut stream = match TcpStream::connect_timeout(&address, PROBE_TIMEOUT) {
        Ok(stream) => stream,
        Err(_) => return false,
    };
    if stream.set_read_timeout(Some(PROBE_TIMEOUT)).is_err() || stream.set_write_timeout(Some(PROBE_TIMEOUT)).is_err() {
        return false;
    }
    let request = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }
    let mut head = [0u8; 256];
    let read = match stream.read(&mut head) {
        Ok(read) if read > 0 => read,
        _ => return false,
    };
    let head = String::from_utf8_lossy(&head[..read]);
    head.starts_with("HTTP/") && (head.contains(" 200") || head.contains(" 204") || head.contains(" 301") || head.contains(" 302") || head.contains(" 307"))
}

/// TCP-only probe: the port accepting a connection counts as ready.
fn probe_tcp(port: u16) -> bool {
    TcpStream::connect_timeout(&SocketAddr::from((Ipv4Addr::LOCALHOST, port)), PROBE_TIMEOUT).is_ok()
}

/** Locate the bundled backend directory inside the installed resources. */
fn backend_root(app: &tauri::AppHandle, configured: &str) -> Result<PathBuf, String> {
    let resources = app.path().resource_dir().map_err(|error| format!("resource directory unavailable: {error}"))?;
    // Bundler resource paths keep their src-tauri-relative shape, so the same
    // folder may appear under either name depending on the packaging target.
    for candidate in [configured.to_string(), format!("resources/{configured}")] {
        let directory = resources.join(&candidate);
        if directory.is_dir() {
            return Ok(directory);
        }
    }
    Err(format!(
        "bundled backend directory not found under {} (looked for {configured} and resources/{configured}); rebuild with desktop/scripts/assemble-resources.mjs",
        resources.display()
    ))
}

/** Expand the `{port}` placeholder in configured launch arguments. */
fn expand_args(args: &[String], port: u16) -> Vec<String> {
    args.iter().map(|arg| arg.replace("{port}", &port.to_string())).collect()
}

fn report_error(app: &tauri::AppHandle, message: String) {
    eprintln!("ymzz-desktop: {message}");
    let handle = app.clone();
    let text = message;
    // The dialog blocks, so keep it off the run loop thread.
    std::thread::spawn(move || {
        handle
            .dialog()
            .message(format!("{text}\n\n请查看日志后重试；本提示由桌面壳给出，不代表 DeepSeek Harness 本体的验收结论。"))
            .title("湛箴_ymzz 启动失败")
            .kind(MessageDialogKind::Error)
            .blocking_show();
        handle.exit(1);
    });
}

/** Start the bundled service, wait for readiness, then navigate the window. */
fn launch_backend(app: tauri::AppHandle) {
    let config = ShellConfig::load(&app);
    let port = match find_free_port(config.port, config.port_scan) {
        Ok(port) => port,
        Err(error) => {
            report_error(&app, format!("无法找到本机空闲端口（{} 起扫描失败）：{error}", config.port));
            return;
        }
    };
    let backend = match backend_root(&app, &config.backend_dir) {
        Ok(directory) => directory,
        Err(message) => {
            report_error(&app, message);
            return;
        }
    };
    let node = backend.join(&config.node_path);
    if !node.is_file() {
        report_error(&app, format!("打包的 Node 运行时缺失：{}", node.display()));
        return;
    }
    let args = expand_args(&config.args, port);
    let child = {
        let state = app.state::<BackendChild>();
        let mut guard = match state.0.lock() {
            Ok(guard) => guard,
            Err(_) => {
                report_error(&app, "内部状态不可用（BackendChild 锁中毒）".to_string());
                return;
            }
        };
        if guard.is_some() {
            report_error(&app, "后端进程已在运行，拒绝重复启动".to_string());
            return;
        }
        let command = app
            .shell()
            .command(&node)
            .args(args.iter().map(|argument| argument.as_str()))
            .env("PORT", port.to_string())
            .env(NODE_RUNTIME_ENV, &node)
            .env(TELEMETRY_ENV, "1")
            .current_dir(&backend);
        match command.spawn() {
            Ok((receiver, child)) => {
                *guard = Some(child);
                // Drain backend output into the shell's stderr for diagnostics.
                std::thread::spawn(move || {
                    let mut receiver = receiver;
                    while let Some(event) = tauri::async_runtime::block_on(receiver.recv()) {
                        match event {
                            CommandEvent::Stdout(line) => eprintln!("[dsh] {}", String::from_utf8_lossy(&line)),
                            CommandEvent::Stderr(line) => eprintln!("[dsh] {}", String::from_utf8_lossy(&line)),
                            CommandEvent::Error(line) => eprintln!("[dsh:error] {line}"),
                            CommandEvent::Terminated(status) => {
                                eprintln!("[dsh:exit] {status:?}");
                                break;
                            }
                            _ => {}
                        }
                    }
                });
                true
            }
            Err(error) => {
                report_error(&app, format!("启动打包服务失败（{}）：{error}", node.display()));
                false
            }
        }
    };
    if !child {
        return;
    }
    let deadline = Instant::now() + Duration::from_millis(config.ready_timeout_ms);
    loop {
        let ready = match config.ready_probe.as_str() {
            "tcp" => probe_tcp(port),
            _ => probe_http(port, &config.ready_path),
        };
        if ready {
            break;
        }
        if Instant::now() >= deadline {
            report_error(&app, format!("本地服务在 {} 毫秒内未就绪（http://127.0.0.1:{port}{}）。", config.ready_timeout_ms, config.ready_path));
            return;
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    let target = format!("http://127.0.0.1:{port}{}", config.ready_path);
    let Some(window) = app.get_webview_window("main") else {
        report_error(&app, format!("主窗口不可用，无法导航到 {target}"));
        return;
    };
    let script = format!("window.location.replace({});", serde_json::to_string(&target).unwrap_or_else(|_| "\"/\"".to_string()));
    if let Err(error) = window.eval(&script) {
        report_error(&app, format!("导航到 {target} 失败：{error}"));
        return;
    }
    let _ = window.show();
    let _ = window.set_focus();
}

/** Kill the backend child, if any; safe to call more than once. */
fn kill_backend(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<BackendChild>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                if let Err(error) = child.kill() {
                    eprintln!("ymzz-desktop: killing the backend returned {error} (it may have already exited)");
                }
            }
        }
    }
}

pub fn run() -> Result<(), tauri::Error> {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(BackendChild(Mutex::new(None)));
            let handle = app.handle().clone();
            // The launch flow blocks on readiness polling, so keep it off the
            // main thread; window APIs it uses are thread-safe in Tauri 2.
            std::thread::spawn(move || launch_backend(handle));
            Ok(())
        })
        .build(tauri::generate_context!())?
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => kill_backend(app_handle),
            _ => {}
        });
    Ok(())
}
