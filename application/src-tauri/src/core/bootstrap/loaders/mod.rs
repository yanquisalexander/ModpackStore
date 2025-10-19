// src/core/bootstrap/loaders/mod.rs
// Module for loader-specific installers (Fabric, NeoForge, Quilt)

pub mod fabric;
pub mod neoforge;
pub mod quilt;

pub use fabric::*;
pub use neoforge::*;
pub use quilt::*;
