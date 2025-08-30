// src/core/bootstrap/mod.rs
// Main entry point for the bootstrap module - refactored from instance_bootstrap.rs

pub mod download;
pub mod filesystem;
pub mod manifest;
pub mod tasks;
pub mod validate;

// Re-export commonly used functions to maintain backward compatibility
pub use download::*;
pub use filesystem::*;
pub use manifest::*;
pub use tasks::*;
pub use validate::*;