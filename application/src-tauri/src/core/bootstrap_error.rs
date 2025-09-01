use serde::{Deserialize, Serialize};
use std::fmt;

/// Represents different steps in the bootstrap process
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BootstrapStep {
    CreatingDirectories,
    DownloadingManifest,
    DownloadingVersionJson,
    DownloadingClientJar,
    CheckingJavaVersion,
    InstallingJava,
    DownloadingLibraries,
    ValidatingAssets,
    ExtractingNatives,
    DownloadingForgeInstaller,
    RunningForgeInstaller,
    CreatingLauncherProfiles,
}

impl fmt::Display for BootstrapStep {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let step_name = match self {
            BootstrapStep::CreatingDirectories => "Creando directorios",
            BootstrapStep::DownloadingManifest => "Descargando manifiesto de versión",
            BootstrapStep::DownloadingVersionJson => "Descargando configuración de versión",
            BootstrapStep::DownloadingClientJar => "Descargando cliente de Minecraft",
            BootstrapStep::CheckingJavaVersion => "Verificando versión de Java",
            BootstrapStep::InstallingJava => "Instalando Java",
            BootstrapStep::DownloadingLibraries => "Descargando librerías",
            BootstrapStep::ValidatingAssets => "Validando assets",
            BootstrapStep::ExtractingNatives => "Extrayendo librerías nativas",
            BootstrapStep::DownloadingForgeInstaller => "Descargando instalador de Forge",
            BootstrapStep::RunningForgeInstaller => "Ejecutando instalador de Forge",
            BootstrapStep::CreatingLauncherProfiles => "Creando perfiles del launcher",
        };
        write!(f, "{}", step_name)
    }
}

/// Represents different categories of bootstrap errors
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ErrorCategory {
    Network,
    Filesystem,
    Java,
    Forge,
    Configuration,
    Other,
}

/// Enhanced error structure for bootstrap operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapError {
    pub step: BootstrapStep,
    pub category: ErrorCategory,
    pub message: String,
    pub suggestion: Option<String>,
    pub technical_details: Option<String>,
}

impl BootstrapError {
    pub fn new(
        step: BootstrapStep,
        category: ErrorCategory,
        message: impl Into<String>,
    ) -> Self {
        Self {
            step,
            category,
            message: message.into(),
            suggestion: None,
            technical_details: None,
        }
    }

    pub fn with_suggestion(mut self, suggestion: impl Into<String>) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }

    pub fn with_technical_details(mut self, details: impl Into<String>) -> Self {
        self.technical_details = Some(details.into());
        self
    }

    /// Create a Java-related error
    pub fn java_error(step: BootstrapStep, message: impl Into<String>) -> Self {
        Self::new(step, ErrorCategory::Java, message)
            .with_suggestion("Verifica que Java esté instalado correctamente y que la ruta sea válida")
    }

    /// Create a network-related error
    pub fn network_error(step: BootstrapStep, message: impl Into<String>) -> Self {
        Self::new(step, ErrorCategory::Network, message)
            .with_suggestion("Verifica tu conexión a internet y vuelve a intentar")
    }

    /// Create a Forge installation error
    pub fn forge_error(message: impl Into<String>) -> Self {
        Self::new(BootstrapStep::RunningForgeInstaller, ErrorCategory::Forge, message)
            .with_suggestion("Verifica que la versión de Forge sea compatible con la versión de Minecraft")
    }

    /// Create a filesystem error
    pub fn filesystem_error(step: BootstrapStep, message: impl Into<String>) -> Self {
        Self::new(step, ErrorCategory::Filesystem, message)
            .with_suggestion("Verifica los permisos de escritura en el directorio de la instancia")
    }
}

impl fmt::Display for BootstrapError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Error en {}: {}", self.step, self.message)
    }
}

impl From<BootstrapError> for String {
    fn from(error: BootstrapError) -> Self {
        error.to_string()
    }
}