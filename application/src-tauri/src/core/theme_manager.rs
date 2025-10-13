use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;

/// Represents a theme definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    pub is_premium: bool,
    pub is_external: bool,
    pub variables: HashMap<String, String>,
}

/// Theme manager for handling theme loading and switching
#[derive(Debug)]
pub struct ThemeManager {
    themes: HashMap<String, Theme>,
    current_theme: String,
}

impl ThemeManager {
    /// Creates a new theme manager instance
    fn new() -> Self {
        let mut manager = Self {
            themes: HashMap::new(),
            current_theme: "dark".to_string(),
        };

        // Load built-in themes
        manager.load_builtin_themes();

        manager
    }

    /// Loads built-in themes from embedded resources
    fn load_builtin_themes(&mut self) {
        // Dark theme (default)
        let dark_theme = Theme {
            id: "dark".to_string(),
            name: "Dark".to_string(),
            description: Some("Default dark theme".to_string()),
            author: Some("ModpackStore".to_string()),
            version: Some("1.0.0".to_string()),
            is_premium: false,
            is_external: false,
            variables: self.get_dark_theme_variables(),
        };

        // Ice theme
        let ice_theme = Theme {
            id: "ice".to_string(),
            name: "Ice".to_string(),
            description: Some("Cool ice theme".to_string()),
            author: Some("ModpackStore".to_string()),
            version: Some("1.0.0".to_string()),
            is_premium: false,
            is_external: false,
            variables: self.get_ice_theme_variables(),
        };

        // Dark Knight (AMOLED) theme
        let dark_knight_theme = Theme {
            id: "dark-knight".to_string(),
            name: "Dark Knight".to_string(),
            description: Some("Pure AMOLED black theme".to_string()),
            author: Some("ModpackStore".to_string()),
            version: Some("1.0.0".to_string()),
            is_premium: false,
            is_external: false,
            variables: self.get_dark_knight_theme_variables(),
        };

        self.themes.insert("dark".to_string(), dark_theme);
        self.themes.insert("ice".to_string(), ice_theme);
        self.themes.insert("dark-knight".to_string(), dark_knight_theme);
    }

    /// Gets the default dark theme variables
    fn get_dark_theme_variables(&self) -> HashMap<String, String> {
        let mut vars = HashMap::new();
        
        // Base colors
        vars.insert("--background".to_string(), "oklch(0.145 0 0)".to_string());
        vars.insert("--foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--card".to_string(), "oklch(0.205 0 0)".to_string());
        vars.insert("--card-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--popover".to_string(), "oklch(0.205 0 0)".to_string());
        vars.insert("--popover-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--primary".to_string(), "oklch(0.922 0 0)".to_string());
        vars.insert("--primary-foreground".to_string(), "oklch(0.205 0 0)".to_string());
        vars.insert("--secondary".to_string(), "oklch(0.269 0 0)".to_string());
        vars.insert("--secondary-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--muted".to_string(), "oklch(0.269 0 0)".to_string());
        vars.insert("--muted-foreground".to_string(), "oklch(0.708 0 0)".to_string());
        vars.insert("--accent".to_string(), "oklch(0.269 0 0)".to_string());
        vars.insert("--accent-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--destructive".to_string(), "oklch(0.704 0.191 22.216)".to_string());
        vars.insert("--border".to_string(), "oklch(1 0 0 / 10%)".to_string());
        vars.insert("--input".to_string(), "oklch(1 0 0 / 15%)".to_string());
        vars.insert("--ring".to_string(), "oklch(0.556 0 0)".to_string());
        
        // Chart colors
        vars.insert("--chart-1".to_string(), "oklch(0.488 0.243 264.376)".to_string());
        vars.insert("--chart-2".to_string(), "oklch(0.696 0.17 162.48)".to_string());
        vars.insert("--chart-3".to_string(), "oklch(0.769 0.188 70.08)".to_string());
        vars.insert("--chart-4".to_string(), "oklch(0.627 0.265 303.9)".to_string());
        vars.insert("--chart-5".to_string(), "oklch(0.645 0.246 16.439)".to_string());
        
        // Sidebar colors
        vars.insert("--sidebar".to_string(), "oklch(0.205 0 0)".to_string());
        vars.insert("--sidebar-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-primary".to_string(), "oklch(0.488 0.243 264.376)".to_string());
        vars.insert("--sidebar-primary-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-accent".to_string(), "oklch(0.269 0 0)".to_string());
        vars.insert("--sidebar-accent-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-border".to_string(), "oklch(1 0 0 / 10%)".to_string());
        vars.insert("--sidebar-ring".to_string(), "oklch(0.556 0 0)".to_string());

        // Custom colors
        vars.insert("--color-ms-primary".to_string(), "#181818FF".to_string());

        vars
    }

    /// Gets the ice theme variables
    fn get_ice_theme_variables(&self) -> HashMap<String, String> {
        let mut vars = HashMap::new();
        
        // Base colors - Ice theme with cool blue tones
        vars.insert("--background".to_string(), "oklch(0.92 0.02 240)".to_string());
        vars.insert("--foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--card".to_string(), "oklch(0.98 0.01 240)".to_string());
        vars.insert("--card-foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--popover".to_string(), "oklch(0.98 0.01 240)".to_string());
        vars.insert("--popover-foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--primary".to_string(), "oklch(0.55 0.15 240)".to_string());
        vars.insert("--primary-foreground".to_string(), "oklch(0.99 0 0)".to_string());
        vars.insert("--secondary".to_string(), "oklch(0.85 0.03 240)".to_string());
        vars.insert("--secondary-foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--muted".to_string(), "oklch(0.85 0.03 240)".to_string());
        vars.insert("--muted-foreground".to_string(), "oklch(0.45 0.05 240)".to_string());
        vars.insert("--accent".to_string(), "oklch(0.70 0.12 220)".to_string());
        vars.insert("--accent-foreground".to_string(), "oklch(0.99 0 0)".to_string());
        vars.insert("--destructive".to_string(), "oklch(0.60 0.20 20)".to_string());
        vars.insert("--border".to_string(), "oklch(0.80 0.03 240)".to_string());
        vars.insert("--input".to_string(), "oklch(0.85 0.03 240)".to_string());
        vars.insert("--ring".to_string(), "oklch(0.55 0.15 240)".to_string());
        
        // Chart colors
        vars.insert("--chart-1".to_string(), "oklch(0.60 0.15 240)".to_string());
        vars.insert("--chart-2".to_string(), "oklch(0.65 0.12 200)".to_string());
        vars.insert("--chart-3".to_string(), "oklch(0.70 0.10 180)".to_string());
        vars.insert("--chart-4".to_string(), "oklch(0.55 0.18 260)".to_string());
        vars.insert("--chart-5".to_string(), "oklch(0.75 0.08 220)".to_string());
        
        // Sidebar colors
        vars.insert("--sidebar".to_string(), "oklch(0.95 0.02 240)".to_string());
        vars.insert("--sidebar-foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--sidebar-primary".to_string(), "oklch(0.55 0.15 240)".to_string());
        vars.insert("--sidebar-primary-foreground".to_string(), "oklch(0.99 0 0)".to_string());
        vars.insert("--sidebar-accent".to_string(), "oklch(0.85 0.03 240)".to_string());
        vars.insert("--sidebar-accent-foreground".to_string(), "oklch(0.15 0.05 250)".to_string());
        vars.insert("--sidebar-border".to_string(), "oklch(0.80 0.03 240)".to_string());
        vars.insert("--sidebar-ring".to_string(), "oklch(0.55 0.15 240)".to_string());

        // Custom colors
        vars.insert("--color-ms-primary".to_string(), "#d4e4f7".to_string());

        vars
    }

    /// Gets the dark knight (AMOLED) theme variables
    fn get_dark_knight_theme_variables(&self) -> HashMap<String, String> {
        let mut vars = HashMap::new();
        
        // Base colors - Pure black AMOLED theme
        vars.insert("--background".to_string(), "oklch(0 0 0)".to_string());
        vars.insert("--foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--card".to_string(), "oklch(0.08 0 0)".to_string());
        vars.insert("--card-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--popover".to_string(), "oklch(0.08 0 0)".to_string());
        vars.insert("--popover-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--primary".to_string(), "oklch(0.922 0 0)".to_string());
        vars.insert("--primary-foreground".to_string(), "oklch(0.08 0 0)".to_string());
        vars.insert("--secondary".to_string(), "oklch(0.15 0 0)".to_string());
        vars.insert("--secondary-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--muted".to_string(), "oklch(0.15 0 0)".to_string());
        vars.insert("--muted-foreground".to_string(), "oklch(0.708 0 0)".to_string());
        vars.insert("--accent".to_string(), "oklch(0.15 0 0)".to_string());
        vars.insert("--accent-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--destructive".to_string(), "oklch(0.704 0.191 22.216)".to_string());
        vars.insert("--border".to_string(), "oklch(1 0 0 / 8%)".to_string());
        vars.insert("--input".to_string(), "oklch(1 0 0 / 12%)".to_string());
        vars.insert("--ring".to_string(), "oklch(0.556 0 0)".to_string());
        
        // Chart colors
        vars.insert("--chart-1".to_string(), "oklch(0.488 0.243 264.376)".to_string());
        vars.insert("--chart-2".to_string(), "oklch(0.696 0.17 162.48)".to_string());
        vars.insert("--chart-3".to_string(), "oklch(0.769 0.188 70.08)".to_string());
        vars.insert("--chart-4".to_string(), "oklch(0.627 0.265 303.9)".to_string());
        vars.insert("--chart-5".to_string(), "oklch(0.645 0.246 16.439)".to_string());
        
        // Sidebar colors
        vars.insert("--sidebar".to_string(), "oklch(0.08 0 0)".to_string());
        vars.insert("--sidebar-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-primary".to_string(), "oklch(0.488 0.243 264.376)".to_string());
        vars.insert("--sidebar-primary-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-accent".to_string(), "oklch(0.15 0 0)".to_string());
        vars.insert("--sidebar-accent-foreground".to_string(), "oklch(0.985 0 0)".to_string());
        vars.insert("--sidebar-border".to_string(), "oklch(1 0 0 / 8%)".to_string());
        vars.insert("--sidebar-ring".to_string(), "oklch(0.556 0 0)".to_string());

        // Custom colors
        vars.insert("--color-ms-primary".to_string(), "#000000".to_string());

        vars
    }

    /// Loads external themes from user's theme directory
    pub fn load_external_themes(&mut self) -> Result<(), String> {
        let themes_dir = self.get_themes_directory()?;

        if !themes_dir.exists() {
            // Create the directory if it doesn't exist
            fs::create_dir_all(&themes_dir)
                .map_err(|e| format!("Failed to create themes directory: {}", e))?;
            return Ok(());
        }

        // Read all JSON files in the themes directory
        let entries = fs::read_dir(&themes_dir)
            .map_err(|e| format!("Failed to read themes directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match self.load_theme_file(&path) {
                    Ok(mut theme) => {
                        theme.is_external = true;
                        theme.is_premium = true; // External themes are premium
                        self.themes.insert(theme.id.clone(), theme);
                    }
                    Err(e) => {
                        log::warn!("Failed to load theme from {:?}: {}", path, e);
                    }
                }
            }
        }

        Ok(())
    }

    /// Loads a theme from a file
    fn load_theme_file(&self, path: &PathBuf) -> Result<Theme, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read theme file: {}", e))?;

        let theme: Theme = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse theme JSON: {}", e))?;

        Ok(theme)
    }

    /// Gets the user's themes directory
    fn get_themes_directory(&self) -> Result<PathBuf, String> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| "Failed to get config directory".to_string())?;

        Ok(config_dir
            .join("dev.alexitoo.modpackstore")
            .join("themes"))
    }

    /// Sets the current theme
    pub fn set_theme(&mut self, theme_id: &str) -> Result<(), String> {
        if !self.themes.contains_key(theme_id) {
            return Err(format!("Theme '{}' not found", theme_id));
        }

        self.current_theme = theme_id.to_string();
        Ok(())
    }

    /// Gets the current theme
    pub fn get_current_theme(&self) -> Option<&Theme> {
        self.themes.get(&self.current_theme)
    }

    /// Gets a theme by ID
    pub fn get_theme(&self, theme_id: &str) -> Option<&Theme> {
        self.themes.get(theme_id)
    }

    /// Gets all available themes
    pub fn get_all_themes(&self) -> Vec<&Theme> {
        self.themes.values().collect()
    }

    /// Gets all free themes
    pub fn get_free_themes(&self) -> Vec<&Theme> {
        self.themes
            .values()
            .filter(|t| !t.is_premium)
            .collect()
    }

    /// Gets all premium themes
    pub fn get_premium_themes(&self) -> Vec<&Theme> {
        self.themes
            .values()
            .filter(|t| t.is_premium)
            .collect()
    }
}

// Singleton instance
static THEME_MANAGER: Lazy<Mutex<ThemeManager>> = Lazy::new(|| {
    Mutex::new(ThemeManager::new())
});

/// Gets the global theme manager instance
pub fn get_theme_manager() -> &'static Mutex<ThemeManager> {
    &THEME_MANAGER
}

/// Initializes the theme manager and loads external themes
pub fn initialize_theme_manager() -> Result<(), String> {
    let mut manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    manager.load_external_themes()?;

    Ok(())
}

// Tauri commands

#[tauri::command]
pub async fn get_available_themes() -> Result<Vec<Theme>, String> {
    let manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    Ok(manager.get_all_themes().iter().map(|t| (*t).clone()).collect())
}

#[tauri::command]
pub async fn get_free_themes() -> Result<Vec<Theme>, String> {
    let manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    Ok(manager.get_free_themes().iter().map(|t| (*t).clone()).collect())
}

#[tauri::command]
pub async fn get_premium_themes() -> Result<Vec<Theme>, String> {
    let manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    Ok(manager.get_premium_themes().iter().map(|t| (*t).clone()).collect())
}

#[tauri::command]
pub async fn get_theme_by_id(theme_id: String) -> Result<Theme, String> {
    let manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    manager
        .get_theme(&theme_id)
        .cloned()
        .ok_or_else(|| format!("Theme '{}' not found", theme_id))
}

#[tauri::command]
pub async fn get_current_theme() -> Result<Theme, String> {
    let manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    manager
        .get_current_theme()
        .cloned()
        .ok_or_else(|| "No current theme set".to_string())
}

#[tauri::command]
pub async fn set_theme(theme_id: String, app_handle: AppHandle) -> Result<(), String> {
    // Set the theme in the theme manager
    {
        let mut manager = get_theme_manager()
            .lock()
            .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

        manager.set_theme(&theme_id)?;
    }

    // Save the theme preference to config
    {
        let config_manager = crate::config::get_config_manager()
            .lock()
            .map_err(|e| format!("Failed to lock config manager: {}", e))?;

        config_manager
            .set("theme", theme_id.clone())
            .map_err(|e| format!("Failed to save theme preference: {:?}", e))?;

        config_manager
            .save()
            .map_err(|e| format!("Failed to save config: {}", e))?;
    }

    // Get the updated theme and emit event
    let theme = {
        let manager = get_theme_manager()
            .lock()
            .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

        manager
            .get_theme(&theme_id)
            .cloned()
            .ok_or_else(|| format!("Theme '{}' not found", theme_id))?
    };

    // Emit theme changed event
    app_handle
        .emit("theme-changed", &theme)
        .map_err(|e| format!("Failed to emit theme-changed event: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn reload_external_themes() -> Result<Vec<Theme>, String> {
    let mut manager = get_theme_manager()
        .lock()
        .map_err(|e| format!("Failed to lock theme manager: {}", e))?;

    manager.load_external_themes()?;

    Ok(manager.get_premium_themes().iter().map(|t| (*t).clone()).collect())
}
