# Architecture Diagram - ModpackStore Theme Engine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ModpackStore Application                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         App.tsx (Root)                               │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                                │
│  ┌──────────────────────────▼──────────────────────────────────────────┐   │
│  │                    AppProviders.tsx                                  │   │
│  │  ┌────────────────────────────────────────────────────────────┐    │   │
│  │  │           ThemeProvider (stores/ThemeContext.tsx)          │    │   │
│  │  │                                                             │    │   │
│  │  │  State:                                                     │    │   │
│  │  │  • currentTheme: ThemeDefinition                          │    │   │
│  │  │  • availableThemes: ThemeInfo[]                           │    │   │
│  │  │  • isLoading: boolean                                     │    │   │
│  │  │  • canAccessPremium: boolean                              │    │   │
│  │  │                                                             │    │   │
│  │  │  Methods:                                                   │    │   │
│  │  │  • setTheme(themeId)                                      │    │   │
│  │  │  • refreshThemes()                                        │    │   │
│  │  │  • loadExternalThemes()                                   │    │   │
│  │  └───────────────────┬─────────────────────────────────────┘    │   │
│  └────────────────────────┼──────────────────────────────────────────┘   │
│                           │                                                │
│  ┌────────────────────────▼─────────────────────────────────────────┐    │
│  │            UI Components (useTheme() hook)                        │    │
│  │  ┌──────────────────────────────────────────────────────────┐  │    │
│  │  │  ConfigurationDialog.tsx                                  │  │    │
│  │  │    └─► ThemeSelector.tsx                                 │  │    │
│  │  │         • Displays available themes                       │  │    │
│  │  │         • Shows lock icon for premium themes             │  │    │
│  │  │         • Handles theme selection                        │  │    │
│  │  │         • Opens themes directory                         │  │    │
│  │  └──────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   Theme Utilities                                    │  │
│  │  themes/theme-utils.ts                                              │  │
│  │    • applyTheme(theme)                                              │  │
│  │    • applyColorVariables(colors)                                    │  │
│  │    • resetTheme()                                                   │  │
│  │                                                                       │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  CSS Custom Properties (Applied to :root)                    │  │  │
│  │  │  • --background, --foreground, --primary, etc.              │  │  │
│  │  │  • --custom-gradient, --special-shadow (custom)             │  │  │
│  │  │  • --theme-background-image (if provided)                   │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   Built-in Themes                                    │  │
│  │  themes/built-in-themes.ts                                          │  │
│  │    • dark (free)     • ice (free)                                   │  │
│  │    • dark-knight (free)  • sunset (premium)                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└───────────────────────────┬─────────────────────────────────────────────────┘
                            │
                            │ Tauri Commands
                            │
┌───────────────────────────▼─────────────────────────────────────────────────┐
│                            BACKEND (Rust/Tauri)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Tauri Commands (main.rs)                          │   │
│  │                                                                       │   │
│  │  • get_external_themes() → Vec<ExternalThemeManifest>              │   │
│  │  • get_themes_directory_path() → String                            │   │
│  │  • get_config_value(key) → Option<Value>                           │   │
│  │  • set_config_value(key, value) → Result<()>                       │   │
│  └─────────────────┬───────────────────────────────────────────────────┘   │
│                    │                                                         │
│  ┌─────────────────▼───────────────────────────────────────────────────┐   │
│  │           Theme Manager (core/theme_manager.rs)                      │   │
│  │                                                                       │   │
│  │  Functions:                                                          │   │
│  │  • get_themes_directory() → PathBuf                                │   │
│  │  • get_external_themes() → Result<Vec<ExternalThemeManifest>>     │   │
│  │                                                                       │   │
│  │  Structures:                                                         │   │
│  │  • ThemeColors (all color fields)                                  │   │
│  │  • ExternalThemeManifest                                           │   │
│  │    - id, name, description, author, version                        │   │
│  │    - isPremium, colors, customProperties                           │   │
│  │    - backgroundImage, fontFamily, jsFile                           │   │
│  └─────────────────┬───────────────────────────────────────────────────┘   │
│                    │                                                         │
│  ┌─────────────────▼───────────────────────────────────────────────────┐   │
│  │           Config Manager (config/mod.rs)                             │   │
│  │                                                                       │   │
│  │  • ConfigManager::get(key)                                          │   │
│  │  • ConfigManager::set(key, value)                                   │   │
│  │  • ConfigManager::save()                                            │   │
│  │                                                                       │   │
│  │  Config Schema (resources/config_schema.yml):                       │   │
│  │  selectedTheme:                                                      │   │
│  │    type: string                                                      │   │
│  │    default: "dark"                                                   │   │
│  │    ui_section: appearance                                            │   │
│  └─────────────────┬───────────────────────────────────────────────────┘   │
│                    │                                                         │
└────────────────────┼─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FILE SYSTEM                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Config File: %APPDATA%/dev.alexitoo.modpackstore/config.json      │   │
│  │  {                                                                   │   │
│  │    "selectedTheme": "dark",                                         │   │
│  │    "instancesDir": "...",                                           │   │
│  │    ...                                                              │   │
│  │  }                                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  External Themes: %APPDATA%/dev.alexitoo.modpackstore/themes/      │   │
│  │                                                                       │   │
│  │  my-custom-theme/                                                    │   │
│  │  ├── theme.json          ← Theme manifest                          │   │
│  │  ├── background.jpg      ← Optional background image               │   │
│  │  └── index.js           ← Optional JS (future sandbox)             │   │
│  │                                                                       │   │
│  │  cyberpunk-neon/                                                     │   │
│  │  ├── theme.json                                                      │   │
│  │  └── README.md                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. User Opens Configuration                                                 │
│     └─► ThemeSelector renders with current theme                            │
│                                                                               │
│  2. ThemeProvider Initializes                                                │
│     ├─► Load external themes (invoke get_external_themes)                   │
│     ├─► Get saved preference (invoke get_config_value "selectedTheme")      │
│     ├─► Merge built-in + external themes                                    │
│     ├─► Check premium access (session.isAdmin() || isSuperAdmin())         │
│     └─► Apply saved theme (applyTheme)                                      │
│                                                                               │
│  3. User Selects New Theme                                                   │
│     ├─► Check if premium & user has access                                  │
│     ├─► Save preference (invoke set_config_value "selectedTheme" themeId)  │
│     ├─► Apply theme to DOM (applyTheme)                                    │
│     │   ├─► Set CSS custom properties on :root                             │
│     │   ├─► Apply background image if present                              │
│     │   ├─► Apply custom font if specified                                 │
│     │   └─► Apply custom CSS properties                                    │
│     └─► Show success toast                                                  │
│                                                                               │
│  4. App Restart                                                              │
│     ├─► Load config.json                                                    │
│     ├─► Get selectedTheme value                                             │
│     ├─► Load theme definition (built-in or external)                        │
│     └─► Apply theme immediately                                             │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                          SECURITY LAYERS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ✅ Manifest Validation                                                      │
│     • JSON schema validation                                                 │
│     • Required fields check                                                  │
│     • Type checking                                                          │
│                                                                               │
│  ✅ Premium Access Control                                                   │
│     • Check user session role                                                │
│     • Verify admin/superadmin status                                         │
│     • Block premium themes for regular users                                 │
│                                                                               │
│  ✅ File Path Validation                                                     │
│     • Only load from approved directories                                    │
│     • Resolve relative paths safely                                          │
│     • Convert to file:// URLs                                                │
│                                                                               │
│  ⚠️  JavaScript Sandbox (PREPARED, NOT IMPLEMENTED)                         │
│     • Execute in isolated iframe                                             │
│     • Remove dangerous APIs (fetch, localStorage, etc.)                      │
│     • Whitelist safe functions                                               │
│     • No DOM manipulation                                                    │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       INTEGRATION POINTS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Authentication (AuthContext)                                                │
│  └─► Provides session and role information                                  │
│       └─► Used for premium access control                                   │
│                                                                               │
│  Configuration System                                                        │
│  └─► Persists theme preference                                              │
│       └─► Syncs with config.json                                            │
│                                                                               │
│  Patreon Integration (Future)                                                │
│  └─► Will verify active subscription                                         │
│       └─► Enable premium theme access                                       │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Components

### Frontend
- **ThemeProvider**: React Context providing theme state and methods
- **ThemeSelector**: UI component for theme selection
- **theme-utils**: Helper functions to apply themes to DOM
- **built-in-themes**: Definitions of 4 default themes

### Backend
- **theme_manager.rs**: Loads and validates external themes
- **config/mod.rs**: Manages configuration persistence
- **main.rs**: Exposes Tauri commands

### Storage
- **config.json**: Stores user's theme preference
- **themes/**: Directory for external/custom themes

## Color System

ModpackStore uses **OKLCH** color space:
```
oklch(lightness chroma hue / alpha)
       ↓        ↓      ↓      ↓
     0-1      0-0.4   0-360  0-1
```

Benefits:
- More vibrant colors
- Better interpolation
- Uniform perceived brightness
- Native CSS support
