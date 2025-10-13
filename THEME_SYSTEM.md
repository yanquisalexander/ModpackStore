# Theme System Documentation

## Overview

ModpackStore includes a powerful theme engine based on CSS Custom Properties that allows users to customize the application's appearance. The system supports both internal (built-in) themes and external (user-imported) themes.

## Default Themes

ModpackStore includes 3 free built-in themes:

1. **Dark** (Default) 🟣
   - The default dark theme with purple accents
   - Optimized for comfortable extended use
   - Perfect balance between readability and eye comfort

2. **Ice** ❄️
   - A cool theme with blue and white tones
   - Light theme variant
   - Ideal for bright environments

3. **Dark Knight** ⚫
   - AMOLED theme with pure blacks
   - Optimized for OLED screens
   - Maximum battery saving on OLED displays
   - Deep contrast for better visibility

## Premium Themes

Additional themes (including user-created external themes) are premium features available only for ModpackStore+ (Patreon) subscribers.

## Theme File Structure

Themes are defined using JSON files with the following structure:

```json
{
  "metadata": {
    "id": "my-theme",
    "name": "My Awesome Theme",
    "description": "A brief description of your theme",
    "author": "Your Name",
    "version": "1.0.0",
    "isPremium": true,
    "isExternal": true
  },
  "colors": {
    "background": "oklch(0.145 0 0)",
    "foreground": "oklch(0.985 0 0)",
    "card": "oklch(0.205 0 0)",
    "cardForeground": "oklch(0.985 0 0)",
    "popover": "oklch(0.205 0 0)",
    "popoverForeground": "oklch(0.985 0 0)",
    "primary": "oklch(0.922 0 0)",
    "primaryForeground": "oklch(0.205 0 0)",
    "secondary": "oklch(0.269 0 0)",
    "secondaryForeground": "oklch(0.985 0 0)",
    "muted": "oklch(0.269 0 0)",
    "mutedForeground": "oklch(0.708 0 0)",
    "accent": "oklch(0.269 0 0)",
    "accentForeground": "oklch(0.985 0 0)",
    "destructive": "oklch(0.704 0.191 22.216)",
    "border": "oklch(1 0 0 / 10%)",
    "input": "oklch(1 0 0 / 15%)",
    "ring": "oklch(0.556 0 0)",
    "chart1": "oklch(0.488 0.243 264.376)",
    "chart2": "oklch(0.696 0.17 162.48)",
    "chart3": "oklch(0.769 0.188 70.08)",
    "chart4": "oklch(0.627 0.265 303.9)",
    "chart5": "oklch(0.645 0.246 16.439)",
    "sidebar": "oklch(0.205 0 0)",
    "sidebarForeground": "oklch(0.985 0 0)",
    "sidebarPrimary": "oklch(0.488 0.243 264.376)",
    "sidebarPrimaryForeground": "oklch(0.985 0 0)",
    "sidebarAccent": "oklch(0.269 0 0)",
    "sidebarAccentForeground": "oklch(0.985 0 0)",
    "sidebarBorder": "oklch(1 0 0 / 10%)",
    "sidebarRing": "oklch(0.556 0 0)"
  }
}
```

## Color Properties

### Metadata Fields

- **id**: Unique identifier for your theme (lowercase, no spaces, use hyphens)
- **name**: Display name shown in the theme selector
- **description**: Brief description of your theme
- **author**: Your name or username
- **version**: Semantic version number (e.g., "1.0.0")
- **isPremium**: Set to `true` for premium themes (requires Patreon)
- **isExternal**: Automatically set to `true` for imported themes

### Color Fields

All colors use the OKLCH color space format: `oklch(lightness chroma hue [/ alpha])`

#### Base Colors
- **background**: Main application background
- **foreground**: Primary text color
- **card**: Card/panel background
- **cardForeground**: Text color on cards
- **popover**: Popup/dropdown background
- **popoverForeground**: Text in popups

#### Interactive Colors
- **primary**: Primary action color (buttons, links)
- **primaryForeground**: Text on primary elements
- **secondary**: Secondary action color
- **secondaryForeground**: Text on secondary elements
- **accent**: Accent/highlight color
- **accentForeground**: Text on accented elements

#### State Colors
- **muted**: Muted/disabled state background
- **mutedForeground**: Muted text color
- **destructive**: Destructive action color (delete, error)

#### UI Elements
- **border**: Border color for elements
- **input**: Input field background
- **ring**: Focus ring color

#### Charts
- **chart1** through **chart5**: Colors for data visualization

#### Sidebar
- **sidebar**: Sidebar background
- **sidebarForeground**: Sidebar text
- **sidebarPrimary**: Sidebar active item
- **sidebarPrimaryForeground**: Text on active sidebar item
- **sidebarAccent**: Sidebar hover state
- **sidebarAccentForeground**: Text on hovered items
- **sidebarBorder**: Sidebar borders
- **sidebarRing**: Sidebar focus ring

## OKLCH Color Format

OKLCH is a perceptually uniform color space that provides better color manipulation than RGB or HSL.

Format: `oklch(L C H [/ A])`

- **L** (Lightness): 0-1 (0 = black, 1 = white)
- **C** (Chroma): 0-0.4 (0 = gray, higher = more saturated)
- **H** (Hue): 0-360 (color angle)
- **A** (Alpha): 0-1 (optional, for transparency)

### Examples:
- Pure black: `oklch(0 0 0)`
- Pure white: `oklch(1 0 0)`
- Vibrant blue: `oklch(0.5 0.2 240)`
- Semi-transparent: `oklch(0.5 0.2 240 / 0.5)`

### Converting from Other Formats

You can use online tools like:
- https://oklch.com/
- https://www.colorhexa.com/

## Creating Your Own Theme

### Step 1: Choose a Base Theme
Start with one of the built-in themes as a template. Copy its JSON structure.

### Step 2: Customize Colors
Modify the color values to match your desired aesthetic. Consider:
- **Contrast**: Ensure sufficient contrast between foreground and background
- **Accessibility**: Test with color blindness simulators
- **Consistency**: Keep related colors harmonious

### Step 3: Test Your Theme
1. Save your theme as `my-theme.json`
2. Open ModpackStore
3. Go to Settings > Themes
4. Click "Import Theme"
5. Select your JSON file

### Step 4: Refine
Apply your theme and navigate through different parts of the app to ensure all colors work well together.

## Theme Storage Locations

### Internal Themes
Built-in themes are bundled with the application:
- Located in the source code at: `application/src/themes/`
- Cannot be modified or deleted by users

### External Themes
User-imported themes are stored in:
- **Windows**: `%APPDATA%\dev.alexitoo.modpackstore\themes\`
- **macOS**: `~/Library/Application Support/dev.alexitoo.modpackstore/themes/`
- **Linux**: `~/.config/dev.alexitoo.modpackstore/themes/`

## Managing Themes

### Importing a Theme
1. Open Settings (gear icon)
2. Navigate to the "Themes" section
3. Click "Import Theme"
4. Select a `.json` theme file
5. The theme will appear in your theme list

### Applying a Theme
1. Open Settings > Themes
2. Browse available themes
3. Click "Apply" on your desired theme
4. The theme is applied immediately

### Deleting an External Theme
1. Open Settings > Themes
2. Find your imported theme
3. Click the trash icon
4. Confirm deletion

### Opening Themes Directory
Click "Open Themes Folder" in the theme selector to access the themes directory directly. You can manually add or edit theme files here.

## Premium Features

External themes (those not included by default) require a ModpackStore+ (Patreon) subscription to use. This helps support the development and maintenance of ModpackStore.

Free themes included:
- Dark (default)
- Ice
- Dark Knight (AMOLED)

## Tips for Theme Creators

1. **Start Simple**: Begin with subtle changes to an existing theme
2. **Test Thoroughly**: Check your theme in different sections of the app
3. **Consider Context**: Think about when and where your theme will be used
4. **Share**: Consider sharing your themes with the community
5. **Document**: Add clear descriptions to help users understand your theme
6. **Version Control**: Use semantic versioning to track changes

## Troubleshooting

### Theme Not Loading
- Verify your JSON syntax is correct
- Check that all required fields are present
- Ensure color values use the OKLCH format correctly

### Colors Look Wrong
- Double-check your OKLCH values
- Ensure lightness values are between 0 and 1
- Verify chroma values aren't too high (typically 0-0.4)

### Theme Not Appearing
- Make sure the file is in the correct directory
- Verify the file extension is `.json`
- Check that the theme ID is unique

## Example Themes

### Cyberpunk Theme
```json
{
  "metadata": {
    "id": "cyberpunk",
    "name": "Cyberpunk",
    "description": "Neon-inspired futuristic theme",
    "author": "ModpackStore Community",
    "version": "1.0.0",
    "isPremium": true
  },
  "colors": {
    "background": "oklch(0.1 0.05 280)",
    "foreground": "oklch(0.95 0.15 330)",
    "primary": "oklch(0.7 0.25 330)",
    ...
  }
}
```

### Forest Theme
```json
{
  "metadata": {
    "id": "forest",
    "name": "Forest",
    "description": "Nature-inspired green theme",
    "author": "ModpackStore Community",
    "version": "1.0.0",
    "isPremium": true
  },
  "colors": {
    "background": "oklch(0.15 0.03 140)",
    "foreground": "oklch(0.9 0.1 140)",
    "primary": "oklch(0.6 0.18 140)",
    ...
  }
}
```

## Contributing Themes

If you've created an awesome theme and want to share it with the community:
1. Test it thoroughly
2. Ensure it meets accessibility guidelines
3. Share it on the ModpackStore Discord or GitHub discussions
4. Consider submitting a pull request to include it as a built-in theme

---

For more information and support, visit:
- Discord: [ModpackStore Community](https://discord.gg/modpackstore)
- GitHub: [ModpackStore Repository](https://github.com/yanquisalexander/ModpackStore)
