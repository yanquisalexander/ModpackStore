# Internal Themes

This directory contains the built-in themes for ModpackStore. These themes are embedded into the application and available to all users.

## Available Themes

### 🟣 Dark (Default)
- **ID**: `dark`
- **Description**: The default dark theme with purple accents
- **Best for**: General use, extended sessions
- **Premium**: No

### ❄️ Ice
- **ID**: `ice`
- **Description**: A cool theme with blue and white tones
- **Best for**: Bright environments, light theme preference
- **Premium**: No

### ⚫ Dark Knight (AMOLED)
- **ID**: `dark-knight`
- **Description**: Pure black theme optimized for OLED displays
- **Best for**: OLED screens, battery saving, maximum contrast
- **Premium**: No

## Structure

Each theme file is a JSON document with two main sections:

1. **metadata**: Information about the theme
2. **colors**: OKLCH color definitions for all UI elements

## Note

These internal themes cannot be modified or deleted by users. They serve as the base themes and examples for creating custom themes.

For detailed information about creating custom themes, see [THEME_SYSTEM.md](../../../THEME_SYSTEM.md) in the repository root.
