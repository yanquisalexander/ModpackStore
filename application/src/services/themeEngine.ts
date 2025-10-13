// Theme Engine Service
// Manages theme loading, application, and switching

import { invoke } from '@tauri-apps/api/core';
import type { Theme, ThemeDefinition, ThemeColors } from '@/types/theme';

export class ThemeEngine {
  private static currentTheme: ThemeDefinition | null = null;

  /**
   * Initialize the theme engine
   * Loads and applies the current theme from configuration
   */
  static async initialize(): Promise<void> {
    try {
      const theme = await this.getCurrentTheme();
      this.applyThemeToDOM(theme);
      this.currentTheme = theme;
    } catch (error) {
      console.error('Failed to initialize theme engine:', error);
      // Fallback to dark theme if initialization fails
      await this.applyThemeById('dark');
    }
  }

  /**
   * Get all available themes
   */
  static async getAvailableThemes(): Promise<ThemeDefinition[]> {
    try {
      const themes = await invoke<ThemeDefinition[]>('get_available_themes');
      return themes;
    } catch (error) {
      console.error('Failed to get available themes:', error);
      return [];
    }
  }

  /**
   * Get a specific theme by ID
   */
  static async getThemeById(themeId: string): Promise<ThemeDefinition | null> {
    try {
      const theme = await invoke<ThemeDefinition>('get_theme_by_id', { themeId });
      return theme;
    } catch (error) {
      console.error(`Failed to get theme ${themeId}:`, error);
      return null;
    }
  }

  /**
   * Get the current active theme
   */
  static async getCurrentTheme(): Promise<ThemeDefinition> {
    try {
      const theme = await invoke<ThemeDefinition>('get_current_theme');
      return theme;
    } catch (error) {
      console.error('Failed to get current theme:', error);
      throw error;
    }
  }

  /**
   * Apply a theme by its ID
   */
  static async applyThemeById(themeId: string): Promise<void> {
    try {
      // Get the theme first
      const theme = await this.getThemeById(themeId);
      if (!theme) {
        throw new Error(`Theme ${themeId} not found`);
      }

      // Apply the theme in backend (saves to config)
      await invoke('apply_theme', { themeId });

      // Apply theme to DOM
      this.applyThemeToDOM(theme);
      this.currentTheme = theme;
    } catch (error) {
      console.error(`Failed to apply theme ${themeId}:`, error);
      throw error;
    }
  }

  /**
   * Apply theme colors to the DOM using CSS custom properties
   */
  private static applyThemeToDOM(theme: ThemeDefinition): void {
    const root = document.documentElement;
    const colors = theme.colors;

    // Map theme colors to CSS custom properties
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

    // Apply each color to the root element
    Object.entries(colorMap).forEach(([colorKey, cssVar]) => {
      const colorValue = colors[colorKey as keyof ThemeColors];
      if (colorValue) {
        root.style.setProperty(cssVar, colorValue);
      }
    });

    // Add or maintain the dark class based on theme
    // Most themes will be dark, but we can make this smarter later
    if (!root.classList.contains('dark') && theme.metadata.id !== 'ice') {
      root.classList.add('dark');
    } else if (theme.metadata.id === 'ice') {
      root.classList.remove('dark');
    }
  }

  /**
   * Import a theme from a file
   */
  static async importTheme(filePath: string): Promise<string> {
    try {
      const themeId = await invoke<string>('import_theme', { filePath });
      return themeId;
    } catch (error) {
      console.error('Failed to import theme:', error);
      throw error;
    }
  }

  /**
   * Delete an external theme
   */
  static async deleteTheme(themeId: string): Promise<void> {
    try {
      await invoke('delete_theme', { themeId });
    } catch (error) {
      console.error(`Failed to delete theme ${themeId}:`, error);
      throw error;
    }
  }

  /**
   * Open the themes directory in the file explorer
   */
  static async openThemesDirectory(): Promise<void> {
    try {
      await invoke('open_themes_directory');
    } catch (error) {
      console.error('Failed to open themes directory:', error);
      throw error;
    }
  }

  /**
   * Get the currently applied theme (cached)
   */
  static getCachedTheme(): ThemeDefinition | null {
    return this.currentTheme;
  }
}
