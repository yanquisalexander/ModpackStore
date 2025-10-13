// Theme types and interfaces for the theme engine

export interface ThemeColors {
  // Base colors
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  
  // Primary colors
  primary: string;
  primaryForeground: string;
  
  // Secondary colors
  secondary: string;
  secondaryForeground: string;
  
  // Muted colors
  muted: string;
  mutedForeground: string;
  
  // Accent colors
  accent: string;
  accentForeground: string;
  
  // Destructive colors
  destructive: string;
  
  // Border and input colors
  border: string;
  input: string;
  ring: string;
  
  // Chart colors
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  
  // Sidebar colors
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
}

export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  isPremium?: boolean;
  isExternal?: boolean;
}

export interface Theme {
  metadata: ThemeMetadata;
  colors: ThemeColors;
}

export interface ThemeDefinition extends Theme {
  filePath?: string;
}

export enum ThemeType {
  INTERNAL = 'internal',
  EXTERNAL = 'external'
}

export interface LoadedTheme {
  theme: Theme;
  type: ThemeType;
}
