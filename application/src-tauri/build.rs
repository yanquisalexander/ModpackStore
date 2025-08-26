use std::process::Command;
use std::str;

fn main() {
    let output = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .output();

    let git_hash = match output {
        Ok(output) => {
            if output.status.success() {
                str::from_utf8(&output.stdout)
                    .unwrap_or("unknown")
                    .trim()
                    .to_string()
            } else {
                "unknown".to_string()
            }
        }
        Err(_) => "unknown".to_string(),
    };

    println!("cargo:rustc-env=GIT_HASH_BUILD_TIME={}", git_hash);

    tauri_build::build()
}
