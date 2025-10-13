export interface ThemeColors {
  // Base colors
  background?: string;
  foreground?: string;
  
  // UI Components
  card?: string;
  cardForeground?: string;
  popover?: string;
  popoverForeground?: string;
  
  // States
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  destructive?: string;
  
  // Borders and inputs
  border?: string;
  input?: string;
  ring?: string;
  
  // Charts
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
  
  // Sidebar
  sidebar?: string;
  sidebarForeground?: string;
  sidebarPrimary?: string;
  sidebarPrimaryForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarBorder?: string;
  sidebarRing?: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  isPremium: boolean;
  colors: ThemeColors;
  // Optional custom properties
  customProperties?: Record<string, string>;
  // Optional background image
  backgroundImage?: string;
  // Optional custom fonts
  fontFamily?: string;
}

export interface ExternalThemeManifest {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  isPremium?: boolean;
  colors: ThemeColors;
  customProperties?: Record<string, string>;
  backgroundImage?: string;
  fontFamily?: string;
  // Path to optional JavaScript file (will be sandboxed)
  jsFile?: string;
}

export enum ThemeType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
  isPremium: boolean;
  type: ThemeType;
  author?: string;
}
