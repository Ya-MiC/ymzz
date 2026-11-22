// MIT. Thin binary entry point; all behaviour lives in the library target so
// the same code builds identically on Windows, macOS and Linux.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = ymzz_desktop_lib::run() {
        eprintln!("ymzz-desktop: fatal: {error}");
        std::process::exit(1);
    }
}
