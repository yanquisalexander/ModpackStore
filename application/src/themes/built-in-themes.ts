import { ThemeDefinition } from '@/types/theme';

// Default dark theme (free)
export const darkTheme: ThemeDefinition = {
  id: 'dark',
  name: '🌙 Dark',
  description: 'El tema oscuro por defecto de ModpackStore',
  author: 'ModpackStore',
  version: '1.0.0',
  isPremium: false,
  colors: {
    background: 'oklch(0.145 0 0)',
    foreground: 'oklch(0.985 0 0)',
    card: 'oklch(0.205 0 0)',
    cardForeground: 'oklch(0.985 0 0)',
    popover: 'oklch(0.205 0 0)',
    popoverForeground: 'oklch(0.985 0 0)',
    primary: 'oklch(0.922 0 0)',
    primaryForeground: 'oklch(0.205 0 0)',
    secondary: 'oklch(0.269 0 0)',
    secondaryForeground: 'oklch(0.985 0 0)',
    muted: 'oklch(0.269 0 0)',
    mutedForeground: 'oklch(0.708 0 0)',
    accent: 'oklch(0.269 0 0)',
    accentForeground: 'oklch(0.985 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(1 0 0 / 10%)',
    input: 'oklch(1 0 0 / 15%)',
    ring: 'oklch(0.556 0 0)',
    chart1: 'oklch(0.488 0.243 264.376)',
    chart2: 'oklch(0.696 0.17 162.48)',
    chart3: 'oklch(0.769 0.188 70.08)',
    chart4: 'oklch(0.627 0.265 303.9)',
    chart5: 'oklch(0.645 0.246 16.439)',
    sidebar: 'oklch(0.205 0 0)',
    sidebarForeground: 'oklch(0.985 0 0)',
    sidebarPrimary: 'oklch(0.488 0.243 264.376)',
    sidebarPrimaryForeground: 'oklch(0.985 0 0)',
    sidebarAccent: 'oklch(0.269 0 0)',
    sidebarAccentForeground: 'oklch(0.985 0 0)',
    sidebarBorder: 'oklch(1 0 0 / 10%)',
    sidebarRing: 'oklch(0.556 0 0)',
  },
};

// Ice theme (free) - Cool white tones
export const iceTheme: ThemeDefinition = {
  id: 'ice',
  name: '❄️ Ice',
  description: 'Un tema fresco con tonos blancos y grises',
  author: 'ModpackStore',
  version: '1.0.0',
  isPremium: false,
  colors: {
    background: 'oklch(0.98 0.005 240)',
    foreground: 'oklch(0.15 0.01 240)',
    card: 'oklch(0.95 0.01 240)',
    cardForeground: 'oklch(0.15 0.01 240)',
    popover: 'oklch(0.95 0.01 240)',
    popoverForeground: 'oklch(0.15 0.01 240)',
    primary: 'oklch(0.7 0.08 240)',
    primaryForeground: 'oklch(0.98 0.005 240)',
    secondary: 'oklch(0.9 0.005 240)',
    secondaryForeground: 'oklch(0.15 0.01 240)',
    muted: 'oklch(0.9 0.005 240)',
    mutedForeground: 'oklch(0.45 0.01 240)',
    accent: 'oklch(0.85 0.02 240)',
    accentForeground: 'oklch(0.15 0.01 240)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(0.85 0.01 240 / 20%)',
    input: 'oklch(0.85 0.01 240 / 25%)',
    ring: 'oklch(0.7 0.08 240)',
    chart1: 'oklch(0.7 0.08 240)',
    chart2: 'oklch(0.65 0.12 210)',
    chart3: 'oklch(0.75 0.06 250)',
    chart4: 'oklch(0.6 0.15 220)',
    chart5: 'oklch(0.8 0.04 200)',
    sidebar: 'oklch(0.95 0.01 240)',
    sidebarForeground: 'oklch(0.15 0.01 240)',
    sidebarPrimary: 'oklch(0.7 0.08 240)',
    sidebarPrimaryForeground: 'oklch(0.98 0.005 240)',
    sidebarAccent: 'oklch(0.9 0.005 240)',
    sidebarAccentForeground: 'oklch(0.15 0.01 240)',
    sidebarBorder: 'oklch(0.85 0.01 240 / 20%)',
    sidebarRing: 'oklch(0.7 0.08 240)',
  },
};

// Dark Knight theme (free) - Very dark with purple accents
export const darkKnightTheme: ThemeDefinition = {
  id: 'dark-knight',
  name: '⚔️ Dark Knight',
  description: 'Tema ultra oscuro con acentos púrpura',
  author: 'ModpackStore',
  version: '1.0.0',
  isPremium: false,
  colors: {
    background: 'oklch(0.08 0.01 280)',
    foreground: 'oklch(0.95 0.01 280)',
    card: 'oklch(0.12 0.02 280)',
    cardForeground: 'oklch(0.95 0.01 280)',
    popover: 'oklch(0.12 0.02 280)',
    popoverForeground: 'oklch(0.95 0.01 280)',
    primary: 'oklch(0.65 0.25 290)',
    primaryForeground: 'oklch(0.98 0 0)',
    secondary: 'oklch(0.18 0.03 280)',
    secondaryForeground: 'oklch(0.95 0.01 280)',
    muted: 'oklch(0.18 0.03 280)',
    mutedForeground: 'oklch(0.65 0.02 280)',
    accent: 'oklch(0.55 0.22 280)',
    accentForeground: 'oklch(0.98 0 0)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(0.9 0.02 280 / 8%)',
    input: 'oklch(0.9 0.02 280 / 12%)',
    ring: 'oklch(0.6 0.2 290)',
    chart1: 'oklch(0.55 0.25 290)',
    chart2: 'oklch(0.6 0.2 270)',
    chart3: 'oklch(0.5 0.22 310)',
    chart4: 'oklch(0.45 0.28 280)',
    chart5: 'oklch(0.65 0.18 300)',
    sidebar: 'oklch(0.12 0.02 280)',
    sidebarForeground: 'oklch(0.95 0.01 280)',
    sidebarPrimary: 'oklch(0.65 0.25 290)',
    sidebarPrimaryForeground: 'oklch(0.98 0 0)',
    sidebarAccent: 'oklch(0.18 0.03 280)',
    sidebarAccentForeground: 'oklch(0.95 0.01 280)',
    sidebarBorder: 'oklch(0.9 0.02 280 / 8%)',
    sidebarRing: 'oklch(0.6 0.2 290)',
  },
};

// Example premium theme - Sunset (requires Modpack Store+)
export const sunsetTheme: ThemeDefinition = {
  id: 'sunset',
  name: '🌅 Sunset',
  description: 'Tonos cálidos de atardecer (Modpack Store+ requerido)',
  author: 'ModpackStore',
  version: '1.0.0',
  isPremium: true,
  colors: {
    background: 'oklch(0.15 0.05 30)',
    foreground: 'oklch(0.98 0.02 40)',
    card: 'oklch(0.22 0.06 30)',
    cardForeground: 'oklch(0.98 0.02 40)',
    popover: 'oklch(0.22 0.06 30)',
    popoverForeground: 'oklch(0.98 0.02 40)',
    primary: 'oklch(0.7 0.2 40)',
    primaryForeground: 'oklch(0.15 0.05 30)',
    secondary: 'oklch(0.3 0.08 30)',
    secondaryForeground: 'oklch(0.98 0.02 40)',
    muted: 'oklch(0.3 0.08 30)',
    mutedForeground: 'oklch(0.7 0.05 40)',
    accent: 'oklch(0.65 0.22 50)',
    accentForeground: 'oklch(0.15 0.05 30)',
    destructive: 'oklch(0.704 0.191 22.216)',
    border: 'oklch(0.9 0.05 40 / 12%)',
    input: 'oklch(0.9 0.05 40 / 18%)',
    ring: 'oklch(0.65 0.18 40)',
    chart1: 'oklch(0.7 0.2 40)',
    chart2: 'oklch(0.65 0.22 50)',
    chart3: 'oklch(0.6 0.18 35)',
    chart4: 'oklch(0.75 0.15 45)',
    chart5: 'oklch(0.55 0.25 30)',
    sidebar: 'oklch(0.22 0.06 30)',
    sidebarForeground: 'oklch(0.98 0.02 40)',
    sidebarPrimary: 'oklch(0.7 0.2 40)',
    sidebarPrimaryForeground: 'oklch(0.15 0.05 30)',
    sidebarAccent: 'oklch(0.3 0.08 30)',
    sidebarAccentForeground: 'oklch(0.98 0.02 40)',
    sidebarBorder: 'oklch(0.9 0.05 40 / 12%)',
    sidebarRing: 'oklch(0.65 0.18 40)',
  },
};

export const minecraftiaTheme: ThemeDefinition = {
  id: 'minecraftia',
  name: '🟩 Minecraftia',
  description: 'Verdes pixelados al estilo Minecraft',
  author: 'ModpackStore',
  version: '1.0.0',
  isPremium: false,
  colors: {
    // Fondo oscuro con toque marrón/terroso
    background: 'oklch(0.12 0.02 120)',
    foreground: 'oklch(0.98 0.01 120)',

    card: 'oklch(0.16 0.02 120)',
    cardForeground: 'oklch(0.98 0.01 120)',

    popover: 'oklch(0.16 0.02 120)',
    popoverForeground: 'oklch(0.98 0.01 120)',

    // Verde Creeper brillante
    primary: 'oklch(0.72 0.18 140)',
    primaryForeground: 'oklch(0.12 0.02 120)',

    // Verde apagado (tipo hierba sombreada)
    secondary: 'oklch(0.48 0.10 140)',
    secondaryForeground: 'oklch(0.98 0.01 120)',

    muted: 'oklch(0.28 0.05 140)',
    mutedForeground: 'oklch(0.72 0.02 140)',

    accent: 'oklch(0.60 0.15 140)',
    accentForeground: 'oklch(0.12 0.02 120)',

    destructive: 'oklch(0.704 0.191 22.216)',

    border: 'oklch(0.20 0.02 120 / 15%)',
    input: 'oklch(0.20 0.02 120 / 20%)',
    ring: 'oklch(0.60 0.15 140)',

    // Charts estilo biomas: verde, tierra, piedra, esmeralda
    chart1: 'oklch(0.72 0.18 140)', // Verde brillante
    chart2: 'oklch(0.45 0.07 120)', // Verde oscuro
    chart3: 'oklch(0.35 0.03 80)',  // Tierra
    chart4: 'oklch(0.55 0.02 250)', // Piedra
    chart5: 'oklch(0.80 0.18 140)', // Esmeralda clara

    sidebar: 'oklch(0.14 0.02 120)',
    sidebarForeground: 'oklch(0.98 0.01 120)',
    sidebarPrimary: 'oklch(0.72 0.18 140)',
    sidebarPrimaryForeground: 'oklch(0.12 0.02 120)',
    sidebarAccent: 'oklch(0.48 0.10 140)',
    sidebarAccentForeground: 'oklch(0.98 0.01 120)',
    sidebarBorder: 'oklch(0.20 0.02 120 / 15%)',
    sidebarRing: 'oklch(0.60 0.15 140)',
  },
};

// Map of all built-in themes
export const builtInThemes: Record<string, ThemeDefinition> = {
  dark: darkTheme,
  ice: iceTheme,
  minecraftia: minecraftiaTheme,
  'dark-knight': darkKnightTheme,
  sunset: sunsetTheme,
};

// List of free themes
export const freeThemes = ['dark', 'ice', 'dark-knight'];
