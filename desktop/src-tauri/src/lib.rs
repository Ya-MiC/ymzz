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
/// The ymzz plugin's state route — the only beacon that can detect plugin death.
const PLUGIN_BEACON_PATH: &str = "ymzz/state";

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
            // Plugin contract (packages/ymzz/product/index.mjs:18-24): DSH_PRIMARY_RUNTIME
            // is the runtime ROOT, and the plugin joins `dependencies/node/bin/node(.exe)`
            // itself — so the executable lives under that exact hierarchy.
            node_path: if cfg!(windows) { "dependencies/node/bin/node.exe".to_string() } else { "dependencies/node/bin/node".to_string() },
            // The packaged runtime boots the standard web profile: its bundle stack is
            // `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`
            // (packages/util/official-bundles/src/bundles.ts:14-16), and the web-app layer
            // inserts `@ymzz/dsh-product` (packages/bundle/web-app/cordis.patch.yml:638),
            // resolved from the runtime's own node_modules.
            args: vec![
                "node_modules/@deepseek-ai/dsh/lib/bin.js".to_string(),
                "web".to_string(),
                "--no-open".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "{port}".to_string(),
            ],
            ready_path: "/".to_string(),
            ready_probe: "http".to_string(),
            ready_timeout_ms: 30_000,
            backend_dir: "resources-backend".to_string(),
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

/// Outcome of one `GET /ymzz/state` probe.
enum PluginProbe {
    /// The plugin answered (or the authenticated webserver did): it is mounted.
    Alive,
    /// The server answered but the plugin's route is absent: the plugin is not mounted.
    Missing,
    /// No usable answer yet (server still starting or transient drop).
    Unknown,
}

/// One plain HTTP/1.1 probe returning the response status code (0 = unreachable).
fn http_status(port: u16, path: &str) -> u16 {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let mut stream = match TcpStream::connect_timeout(&address, PROBE_TIMEOUT) {
        Ok(stream) => stream,
        Err(_) => return 0,
    };
    if stream.set_read_timeout(Some(PROBE_TIMEOUT)).is_err() || stream.set_write_timeout(Some(PROBE_TIMEOUT)).is_err() {
        return 0;
    }
    let request = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    if stream.write_all(request.as_bytes()).is_err() {
        return 0;
    }
    let mut head = [0u8; 256];
    let read = match stream.read(&mut head) {
        Ok(read) if read > 0 => read,
        _ => return 0,
    };
    let head = String::from_utf8_lossy(&head[..read]);
    if !head.starts_with("HTTP/") {
        return 0;
    }
    head.split_whitespace().nth(1).and_then(|code| code.parse::<u16>().ok()).unwrap_or(0)
}

/// HTTP readiness probe: any DSH webserver response (2xx/3xx) means the server
/// is up. No TLS stack is bundled in the shell, so TLS services should set
/// `readyProbe: "tcp"`.
fn probe_http(port: u16, path: &str) -> bool {
    matches!(http_status(port, path), 200..=399)
}

/// TCP-only probe: the port accepting a connection counts as ready.
fn probe_tcp(port: u16) -> bool {
    TcpStream::connect_timeout(&SocketAddr::from((Ipv4Addr::LOCALHOST, port)), PROBE_TIMEOUT).is_ok()
}

/**
 * The plugin beacon. `/ymzz/state` exists only when the `@ymzz/dsh-product`
 * plugin is mounted, so after the server itself is up this is the ONLY signal
 * that can detect plugin death — a plain root probe cannot (the server answers
 * 200 even when every plugin route is gone). Authenticated-but-unauthorized
 * answers (401/403) and webserver-level 400s all prove the route exists; a 404
 * proves it does not.
 */
fn probe_plugin(port: u16, path: &str) -> PluginProbe {
    match http_status(port, path) {
        200 | 400 | 401 | 403 => PluginProbe::Alive,
        404 => PluginProbe::Missing,
        _ => PluginProbe::Unknown,
    }
}

/** Locate the bundled backend directory inside the installed resources. */
fn backend_root(app: &tauri::AppHandle, configured: &str) -> Result<PathBuf, String> {
    let resources = app.path().resource_dir().map_err(|error| format!("resource directory unavailable: {error}"))?;
    // Bundler resource paths keep their src-tauri-relative shape. The backend
    // is assembled INTO src-tauri (resources-backend/**) so the glob is fully
    // documented behaviour; the historical names stay accepted as fallbacks.
    for candidate in [
        configured.to_string(),
        "backend".to_string(),
        format!("resources/{configured}"),
    ] {
        let directory = resources.join(&candidate);
        if directory.is_dir() {
            return Ok(directory);
        }
    }
    Err(format!(
        "bundled backend directory not found under {} (looked for resources-backend, backend and resources/resources-backend); rebuild with desktop/scripts/assemble-resources.mjs",
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
            // Plugin contract: DSH_PRIMARY_RUNTIME must be the runtime ROOT containing
            // `dependencies/node/bin/node(.exe)` — see packages/ymzz/product/index.mjs:18-24
            // (resolveTestNode). Passing the executable itself made the plugin build
            // `<node.exe>/dependencies/node/bin/node.exe` and die with ENOENT at apply().
            .env(NODE_RUNTIME_ENV, &backend)
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
    let mut server_up = false;
    let mut plugin_missing_reported = false;
    loop {
        let ready = match config.ready_probe.as_str() {
            "tcp" => probe_tcp(port),
            _ => probe_http(port, &config.ready_path),
        };
        if ready {
            server_up = true;
            // Server up; now verify the plugin beacon before navigating. The
            // webserver answers 200 on `/` even with every plugin route gone,
            // so only `/ymzz/state` can detect a missing plugin.
            match probe_plugin(port, PLUGIN_BEACON_PATH) {
                PluginProbe::Alive => break,
                PluginProbe::Missing => {
                    if !plugin_missing_reported {
                        plugin_missing_reported = true;
                        eprintln!("ymzz-desktop: /{PLUGIN_BEACON_PATH} returned 404 — the ymzz plugin is not mounted in the bundled runtime");
                    }
                }
                PluginProbe::Unknown => {}
            }
        }
        if Instant::now() >= deadline {
            if server_up && plugin_missing_reported {
                report_error(&app, format!(
                    "本地服务已在 http://127.0.0.1:{port} 就绪，但 ymzz 插件路由（/{PLUGIN_BEACON_PATH}）持续 404：打包运行时未装载 @ymzz/dsh-product。请检查 desktop/scripts/prepare-upstream-runtime.mjs 是否执行了 pack-local-packages 并重新组装资源。"
                ));
            } else {
                report_error(&app, format!("本地服务在 {} 毫秒内未就绪（http://127.0.0.1:{port}{}）。", config.ready_timeout_ms, config.ready_path));
            }
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
