import { ThemeDefinition, ThemeColors } from '@/types/theme';

/**
 * Applies a theme by setting CSS custom properties on the document root
 */
export function applyTheme(theme: ThemeDefinition): void {
  const root = document.documentElement;

  // Remove any existing theme class
  root.classList.remove('dark', 'light');
  
  // Add 'dark' class (most themes are dark-based)
  root.classList.add('dark');

  // Apply color variables
  applyColorVariables(theme.colors);

  // Apply custom properties if any
  if (theme.customProperties) {
    Object.entries(theme.customProperties).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }

  // Apply background image if specified
  if (theme.backgroundImage) {
    root.style.setProperty('--theme-background-image', `url(${theme.backgroundImage})`);
    document.body.style.backgroundImage = `var(--theme-background-image)`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
  } else {
    root.style.removeProperty('--theme-background-image');
    document.body.style.backgroundImage = '';
  }

  // Apply font family if specified
  if (theme.fontFamily) {
    root.style.setProperty('--default-font-family', theme.fontFamily);
  } else {
    root.style.setProperty('--default-font-family', 'var(--font-jost)');
  }
}

/**
 * Applies color variables to the root element
 */
function applyColorVariables(colors: ThemeColors): void {
  const root = document.documentElement;

  const colorMap: Record<keyof ThemeColors, string> = {
    background: '--background',
    foreground: '--foreground',
    card: '--card',
    cardForeground: '--card-foreground',
    popover: '--popover',
    popoverForeground: '--popover-foreground',
    primary: '--primary',
    primaryForeground: '--primary-foreground',
    secondary: '--secondary',
    secondaryForeground: '--secondary-foreground',
    muted: '--muted',
    mutedForeground: '--muted-foreground',
    accent: '--accent',
    accentForeground: '--accent-foreground',
    destructive: '--destructive',
    border: '--border',
    input: '--input',
    ring: '--ring',
    chart1: '--chart-1',
    chart2: '--chart-2',
    chart3: '--chart-3',
    chart4: '--chart-4',
    chart5: '--chart-5',
    sidebar: '--sidebar',
    sidebarForeground: '--sidebar-foreground',
    sidebarPrimary: '--sidebar-primary',
    sidebarPrimaryForeground: '--sidebar-primary-foreground',
    sidebarAccent: '--sidebar-accent',
    sidebarAccentForeground: '--sidebar-accent-foreground',
    sidebarBorder: '--sidebar-border',
    sidebarRing: '--sidebar-ring',
  };

  Object.entries(colorMap).forEach(([colorKey, cssVar]) => {
    const value = colors[colorKey as keyof ThemeColors];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });
}

/**
 * Resets theme to default (removes custom properties)
 */
export function resetTheme(): void {
  const root = document.documentElement;
  
  // Remove background image
  root.style.removeProperty('--theme-background-image');
  document.body.style.backgroundImage = '';
  
  // Reset to default font
  root.style.setProperty('--default-font-family', 'var(--font-jost)');
}
