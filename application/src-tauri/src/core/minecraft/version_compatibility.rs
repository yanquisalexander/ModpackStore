use serde_json::Value;
use std::cmp::Ordering;

/// Represents different Minecraft version generations with their unique characteristics
#[derive(Debug, Clone, PartialEq)]
pub enum VersionGeneration {
    /// Very old versions (< 1.6) - basic launcher support
    PreClassic,
    /// 1.6 - 1.12: uses minecraftArguments string format
    Legacy,
    /// 1.13+: uses arguments object with game/jvm arrays
    Modern,
    /// Future versions - extensible for new formats
    Future,
}

/// Compatibility layer for handling different Minecraft version formats
pub struct VersionCompatibility;

impl VersionCompatibility {
    /// Detect the version generation based on version string and manifest structure
    pub fn detect_generation(version: &str, manifest: Option<&Value>) -> VersionGeneration {
        // First try to detect from manifest structure if available
        if let Some(manifest) = manifest {
            if manifest.get("arguments").is_some() {
                return VersionGeneration::Modern;
            }
            if manifest.get("minecraftArguments").is_some() {
                return VersionGeneration::Legacy;
            }
        }

        // Fallback to version string parsing
        Self::detect_from_version_string(version)
    }

    /// Detect version generation from version string alone
    pub fn detect_from_version_string(version: &str) -> VersionGeneration {
        // Handle snapshot versions (e.g., "1.13-pre1", "18w50a")
        let clean_version = if version.contains('-') {
            // Extract base version from snapshots like "1.13-pre1"
            if let Some(base) = version.split('-').next() {
                base
            } else {
                version
            }
        } else if version.len() >= 5 && version.chars().nth(2) == Some('w') {
            // Snapshot format like "18w50a" - extract year and convert to version
            let year_str: String = version.chars().take(2).collect();
            if let Ok(year) = year_str.parse::<u32>() {
                // Map year to approximate Minecraft version
                match year {
                    13..=16 => "1.12", // 2013-2016: mostly 1.8-1.12 era
                    17 => "1.13",      // 2017: 1.13 development
                    18 => "1.14",      // 2018: 1.14 development
                    19 => "1.15",      // 2019: 1.15 development
                    20 => "1.16",      // 2020: 1.16 development
                    21 => "1.17",      // 2021: 1.17 development
                    22 => "1.19",      // 2022: 1.19 development
                    23 => "1.20",      // 2023: 1.20 development
                    24.. => "1.21",    // 2024+: future versions
                    _ => "1.12",       // Default for very old or unrecognized
                }
            } else {
                version
            }
        } else {
            version
        };

        match Self::parse_version_number(clean_version) {
            Some((major, minor, _)) => {
                match (major, minor) {
                    (1, 0..=5) => VersionGeneration::PreClassic,
                    (1, 6..=12) => VersionGeneration::Legacy,
                    (1, 13..=99) => VersionGeneration::Modern,
                    (2..=99, _) => VersionGeneration::Future,
                    _ => VersionGeneration::Legacy, // Default fallback
                }
            }
            None => {
                // Handle special version formats
                if clean_version.starts_with("b") || clean_version.starts_with("a") {
                    VersionGeneration::PreClassic
                } else {
                    VersionGeneration::Legacy
                }
            }
        }
    }

    /// Parse version string into major.minor.patch components
    fn parse_version_number(version: &str) -> Option<(u32, u32, u32)> {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() >= 2 {
            let major = parts[0].parse().ok()?;
            let minor = parts[1].parse().ok()?;
            let patch = parts.get(2).and_then(|p| p.parse().ok()).unwrap_or(0);
            Some((major, minor, patch))
        } else {
            None
        }
    }

    /// Check if this version supports a specific feature
    pub fn supports_feature(version: &str, feature: VersionFeature) -> bool {
        let generation = Self::detect_from_version_string(version);
        match feature {
            VersionFeature::ModernArguments => matches!(generation, VersionGeneration::Modern | VersionGeneration::Future),
            VersionFeature::LegacyArguments => matches!(generation, VersionGeneration::Legacy | VersionGeneration::PreClassic),
            VersionFeature::AssetIndex => !matches!(generation, VersionGeneration::PreClassic),
            VersionFeature::JavaAgentSupport => matches!(generation, VersionGeneration::Modern | VersionGeneration::Future),
            VersionFeature::RuleBasedArguments => matches!(generation, VersionGeneration::Modern | VersionGeneration::Future),
            VersionFeature::CustomResolution => !matches!(generation, VersionGeneration::PreClassic),
        }
    }

    /// Get the appropriate asset index name for a version
    pub fn get_asset_index_name(version: &str, manifest: Option<&Value>) -> String {
        // Try to get from manifest first
        if let Some(manifest) = manifest {
            if let Some(assets) = manifest.get("assets").and_then(|v| v.as_str()) {
                return assets.to_string();
            }
            if let Some(asset_index) = manifest.get("assetIndex").and_then(|idx| idx.get("id")).and_then(|id| id.as_str()) {
                return asset_index.to_string();
            }
        }

        // Fallback to version-based detection
        let generation = Self::detect_from_version_string(version);
        match generation {
            VersionGeneration::PreClassic => "pre-1.6".to_string(),
            VersionGeneration::Legacy => {
                if let Some((_, minor, _)) = Self::parse_version_number(version) {
                    match minor {
                        6 => "1.6".to_string(),
                        7..=8 => "1.7.10".to_string(),
                        9..=10 => "1.9".to_string(),
                        11..=12 => "1.11".to_string(),
                        _ => "legacy".to_string(),
                    }
                } else {
                    "legacy".to_string()
                }
            }
            VersionGeneration::Modern | VersionGeneration::Future => version.to_string(),
        }
    }

    /// Compare two versions and return their relative order
    pub fn compare_versions(version1: &str, version2: &str) -> Ordering {
        let v1 = Self::parse_version_number(version1);
        let v2 = Self::parse_version_number(version2);

        match (v1, v2) {
            (Some((maj1, min1, pat1)), Some((maj2, min2, pat2))) => {
                match maj1.cmp(&maj2) {
                    Ordering::Equal => match min1.cmp(&min2) {
                        Ordering::Equal => pat1.cmp(&pat2),
                        other => other,
                    },
                    other => other,
                }
            }
            (Some(_), None) => Ordering::Greater,
            (None, Some(_)) => Ordering::Less,
            (None, None) => version1.cmp(version2),
        }
    }

    /// Get the appropriate main class for a version/generation
    pub fn get_default_main_class(generation: &VersionGeneration) -> &'static str {
        match generation {
            VersionGeneration::PreClassic => "net.minecraft.client.Minecraft",
            VersionGeneration::Legacy => "net.minecraft.client.main.Main",
            VersionGeneration::Modern | VersionGeneration::Future => "net.minecraft.client.main.Main",
        }
    }

    /// Check if a version requires specific JVM arguments
    pub fn get_version_specific_jvm_args(version: &str) -> Vec<String> {
        let generation = Self::detect_from_version_string(version);
        let mut args = Vec::new();

        match generation {
            VersionGeneration::PreClassic => {
                // Very old versions might need specific args
                args.push("-Djava.util.Arrays.useLegacyMergeSort=true".to_string());
            }
            VersionGeneration::Legacy => {
                // 1.6-1.12 specific optimizations
                if Self::supports_log4j_fix(version) {
                    args.push("-Dlog4j2.formatMsgNoLookups=true".to_string());
                }
            }
            VersionGeneration::Modern | VersionGeneration::Future => {
                // Modern versions
                args.push("-Dlog4j2.formatMsgNoLookups=true".to_string());
            }
        }

        args
    }

    /// Check if version needs log4j vulnerability fix
    fn supports_log4j_fix(version: &str) -> bool {
        // Log4j fix is needed for versions that use log4j 2.x
        let generation = Self::detect_from_version_string(version);
        !matches!(generation, VersionGeneration::PreClassic)
    }
}

/// Features that different Minecraft versions support
#[derive(Debug, Clone, PartialEq)]
pub enum VersionFeature {
    /// Modern arguments format (1.13+)
    ModernArguments,
    /// Legacy minecraftArguments string format (1.6-1.12)
    LegacyArguments,
    /// Asset index support
    AssetIndex,
    /// Java agent support
    JavaAgentSupport,
    /// Rule-based argument conditions
    RuleBasedArguments,
    /// Custom resolution support
    CustomResolution,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_generation_detection() {
        assert_eq!(VersionCompatibility::detect_from_version_string("1.6.4"), VersionGeneration::Legacy);
        assert_eq!(VersionCompatibility::detect_from_version_string("1.12.2"), VersionGeneration::Legacy);
        assert_eq!(VersionCompatibility::detect_from_version_string("1.13"), VersionGeneration::Modern);
        assert_eq!(VersionCompatibility::detect_from_version_string("1.20.1"), VersionGeneration::Modern);
        assert_eq!(VersionCompatibility::detect_from_version_string("b1.7.3"), VersionGeneration::PreClassic);
    }

    #[test]
    fn test_snapshot_version_detection() {
        assert_eq!(VersionCompatibility::detect_from_version_string("18w50a"), VersionGeneration::Modern);
        assert_eq!(VersionCompatibility::detect_from_version_string("17w43a"), VersionGeneration::Modern);
        assert_eq!(VersionCompatibility::detect_from_version_string("1.13-pre1"), VersionGeneration::Modern);
        assert_eq!(VersionCompatibility::detect_from_version_string("1.12-pre1"), VersionGeneration::Legacy);
    }

    #[test]
    fn test_version_comparison() {
        assert_eq!(VersionCompatibility::compare_versions("1.12.2", "1.13"), Ordering::Less);
        assert_eq!(VersionCompatibility::compare_versions("1.20.1", "1.19.4"), Ordering::Greater);
        assert_eq!(VersionCompatibility::compare_versions("1.16.5", "1.16.5"), Ordering::Equal);
    }

    #[test]
    fn test_feature_support() {
        assert!(VersionCompatibility::supports_feature("1.13", VersionFeature::ModernArguments));
        assert!(!VersionCompatibility::supports_feature("1.12.2", VersionFeature::ModernArguments));
        assert!(VersionCompatibility::supports_feature("1.12.2", VersionFeature::LegacyArguments));
        assert!(!VersionCompatibility::supports_feature("1.13", VersionFeature::LegacyArguments));
    }

    #[test]
    fn test_asset_index_names() {
        assert_eq!(VersionCompatibility::get_asset_index_name("1.6.4", None), "1.6");
        assert_eq!(VersionCompatibility::get_asset_index_name("1.8.9", None), "1.7.10");
        assert_eq!(VersionCompatibility::get_asset_index_name("1.16.5", None), "1.16.5");
    }
}