use chrono;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackManifest {
    pub id: String,
    pub version: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    #[serde(rename = "forgeVersion")]
    pub forge_version: Option<String>,
    #[serde(rename = "loaderType", default)]
    pub loader_type: Option<String>,
    #[serde(rename = "loaderVersion", default)]
    pub loader_version: Option<String>,
    pub files: Vec<ModpackFileEntry>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackInfo {
    pub id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFileEntry {
    pub fileHash: String,
    pub path: String,
    pub file: ModpackFileType,
    pub downloadUrl: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModpackFileType {
    pub size: u64,
    pub r#type: String,
}

/// Audit report for user data protection validation
#[derive(Debug, Clone)]
pub struct UserDataAuditReport {
    pub operation_type: String,
    pub protected_files: Vec<(String, String)>,
    pub protected_directories: Vec<(String, String)>,
    pub warnings: Vec<String>,
    pub info_messages: Vec<String>,
    pub timestamp: String,
}

impl UserDataAuditReport {
    pub(crate) fn new(operation_type: &str) -> Self {
        Self {
            operation_type: operation_type.to_string(),
            protected_files: Vec::new(),
            protected_directories: Vec::new(),
            warnings: Vec::new(),
            info_messages: Vec::new(),
            timestamp: chrono::Utc::now()
                .format("%Y-%m-%d %H:%M:%S UTC")
                .to_string(),
        }
    }

    pub(crate) fn add_protected_file(&mut self, filename: &str, description: &str) {
        self.protected_files
            .push((filename.to_string(), description.to_string()));
    }

    pub(crate) fn add_protected_directory(&mut self, dirname: &str, description: &str) {
        self.protected_directories
            .push((dirname.to_string(), description.to_string()));
    }

    pub(crate) fn add_warning(&mut self, warning: &str) {
        self.warnings.push(warning.to_string());
    }

    pub(crate) fn add_info(&mut self, info: &str) {
        self.info_messages.push(info.to_string());
    }

    /// Generate a human-readable summary of the audit
    pub fn generate_summary(&self) -> String {
        let mut summary = format!(
            "User Data Protection Audit for {} Operation\n",
            self.operation_type
        );
        summary.push_str(&format!("Timestamp: {}\n\n", self.timestamp));

        summary.push_str("PROTECTED FILES:\n");
        for (file, desc) in &self.protected_files {
            summary.push_str(&format!("  \u{2713} {}: {}\n", file, desc));
        }

        if !self.protected_directories.is_empty() {
            summary.push_str("\nPROTECTED DIRECTORIES:\n");
            for (dir, desc) in &self.protected_directories {
                summary.push_str(&format!("  \u{2713} {}: {}\n", dir, desc));
            }
        }

        if !self.warnings.is_empty() {
            summary.push_str("\nWARNINGS:\n");
            for warning in &self.warnings {
                summary.push_str(&format!("  \u{26A0} {}\n", warning));
            }
        }

        if !self.info_messages.is_empty() {
            summary.push_str("\nINFORMATION:\n");
            for info in &self.info_messages {
                summary.push_str(&format!("  \u{2139} {}\n", info));
            }
        }

        summary.push_str("\n\u{2713} User data protection audit completed successfully\n");
        summary
    }
}
