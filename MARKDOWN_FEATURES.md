# 📝 ModpackStore - Markdown Documentation

## 🚀 New Markdown Support for Modpack Descriptions

ModpackStore now supports rich Markdown formatting for modpack descriptions, allowing creators to build engaging and informative descriptions with custom components.

## ✨ Supported Features

### Basic Markdown
- **Headers** (H1-H6): `# ## ### #### ##### ######`
- **Bold text**: `**bold**` or `__bold__`
- **Italic text**: `*italic*` or `_italic_`
- **Links**: `[Link text](URL)`
- **Lists**: Bulleted (`- item`) and numbered (`1. item`)
- **Code**: Inline `code` or code blocks using triple backticks
- **Blockquotes**: `> Important note`
- **Tables**: Standard Markdown table syntax
- **Images**: `![Alt text](URL)`
- **Horizontal rules**: `---`

### 🎥 Custom Components

#### YouTube Embeds
Embed YouTube videos directly in your modpack description:

```markdown
[youtube: https://www.youtube.com/watch?v=VIDEO_ID]
```

**Example:**
```markdown
# Mi Modpack Épico

¡Mira este trailer increíble!

[youtube: https://www.youtube.com/watch?v=dQw4w9WgXcQ]
```

## 🎨 Styling Guide

The Markdown renderer follows ModpackStore's dark theme with these styling conventions:

- **Headers**: White text with appropriate sizing (3xl, 2xl, xl, lg, base, sm)
- **Body text**: White with 80% opacity for readability
- **Links**: Blue (#60a5fa) with hover effects
- **Code blocks**: Dark background with green text
- **Inline code**: Dark background with blue text
- **Blockquotes**: Blue left border with subtle background
- **Tables**: Bordered with alternating header styling

## 📖 Best Practices

### 1. Structure Your Content
Use headers to organize your modpack description:

```markdown
# Modpack Name

## Overview
Brief description of what makes your modpack special.

## Features
- Feature 1
- Feature 2
- Feature 3

## Installation
Step-by-step installation guide.
```

### 2. Use Media Effectively
- Add a trailer video at the top for immediate engagement
- Include screenshots of key features
- Use YouTube embeds for tutorials or showcases

### 3. Provide Clear Information
- List system requirements in a table
- Include installation instructions
- Mention mod authors and credits

## 🛠️ Implementation Details

### For Developers

The Markdown renderer is implemented as a React component (`MarkdownRenderer`) that:

1. **Processes custom syntax**: Detects `[youtube: URL]` patterns
2. **Renders standard Markdown**: Uses `react-markdown` for standard formatting
3. **Applies consistent styling**: Matches application theme
4. **Handles errors gracefully**: Shows helpful messages for invalid content

### Usage in Components

```tsx
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

<MarkdownRenderer 
  content={modpackDescription} 
  className="additional-classes"
/>
```

### Editor Integration

The ModpackEditView now includes:
- **Live preview toggle**: Switch between edit and preview modes
- **Helpful placeholder**: Shows example Markdown syntax
- **Custom component hints**: Guides users on using special features

## 📝 Example Modpack Description

Here's a complete example of how a modpack description might look:

```markdown
# 🚀 TechnoMagic Adventures

Welcome to the ultimate fusion of **technology** and **magic**!

## 📺 Trailer

[youtube: https://www.youtube.com/watch?v=example]

## 🌟 Features

- **100+ mods** carefully balanced for the best experience
- **Custom quests** to guide your progression
- **Unique recipes** that blend tech and magic
- **Beautiful world generation** with new biomes

### 🔬 Technology Mods
1. **Thermal Expansion** - Energy and automation
2. **Applied Energistics 2** - Advanced storage systems
3. **Mekanism** - High-tech machinery

### 🧙‍♂️ Magic Mods
1. **Thaumcraft** - Research-based magic
2. **Blood Magic** - Dark magical arts
3. **Botania** - Nature magic and automation

## 📋 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 6GB | 8GB+ |
| Java | Java 8 | Java 17 |
| Minecraft | 1.12.2 | 1.12.2 |

## 🔧 Installation

1. Download the modpack from ModpackStore
2. Open your favorite launcher
3. Import the `.zip` file
4. Allocate at least 6GB RAM
5. Launch and enjoy!

> **Pro Tip**: Start with the questbook - it will guide you through the basics!

## 📸 Screenshots

![Starting area](screenshot-url-here)

*Your epic journey begins here*

---

**Created with ❤️ by [YourName]**

Need help? Join our [Discord](https://discord.gg/example)!
```

## 🔄 Migration from Simple Text

Existing modpack descriptions will continue to work as plain text. To upgrade:

1. Edit your modpack in the Creator Dashboard
2. Switch to the new description field (now supports Markdown)
3. Add Markdown formatting to enhance your description
4. Use the preview toggle to see how it looks
5. Save your changes

The system gracefully handles both old plain text and new Markdown descriptions.