import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { builtInThemes, freeThemes } from '@/themes/built-in-themes';
import { ThemeDefinition, ThemeInfo, ThemeType, ExternalThemeManifest } from '@/types/theme';
import { applyTheme } from '@/themes/theme-utils';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface ThemeContextType {
  currentTheme: ThemeDefinition | null;
  availableThemes: ThemeInfo[];
  isLoading: boolean;
  canAccessPremium: boolean;
  setTheme: (themeId: string) => Promise<void>;
  refreshThemes: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition | null>(null);
  const [availableThemes, setAvailableThemes] = useState<ThemeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [externalThemes, setExternalThemes] = useState<Record<string, ThemeDefinition>>({});
  const { user } = useAuth();

  // Check if user can access premium themes
  const canAccessPremium = user?.isAdmin?.() || user?.isSuperAdmin?.() || false;

  /**
   * Load external themes from the themes directory
   */
  const loadExternalThemes = useCallback(async (): Promise<Record<string, ThemeDefinition>> => {
    try {
      const themes = await invoke<ExternalThemeManifest[]>('get_external_themes');
      const themeMap: Record<string, ThemeDefinition> = {};

      themes.forEach((manifest) => {
        themeMap[manifest.id] = {
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          author: manifest.author,
          version: manifest.version,
          isPremium: manifest.isPremium || false,
          colors: manifest.colors,
          customProperties: manifest.customProperties,
          backgroundImage: manifest.backgroundImage,
          fontFamily: manifest.fontFamily,
        };
      });

      return themeMap;
    } catch (error) {
      console.error('Error loading external themes:', error);
      return {};
    }
  }, []);

  /**
   * Get all available themes (built-in + external)
   */
  const getAllThemes = useCallback((): Record<string, ThemeDefinition> => {
    return { ...builtInThemes, ...externalThemes };
  }, [externalThemes]);

  /**
   * Build the list of available themes for the UI
   */
  const buildAvailableThemes = useCallback((): ThemeInfo[] => {
    const allThemes = getAllThemes();
    const themeList: ThemeInfo[] = [];

    Object.entries(allThemes).forEach(([id, theme]) => {
      const isExternal = !builtInThemes[id];
      themeList.push({
        id: theme.id,
        name: theme.name,
        description: theme.description,
        isPremium: theme.isPremium,
        type: isExternal ? ThemeType.EXTERNAL : ThemeType.INTERNAL,
        author: theme.author,
      });
    });

    // Sort: free themes first, then premium
    themeList.sort((a, b) => {
      if (a.isPremium === b.isPremium) {
        return a.name.localeCompare(b.name);
      }
      return a.isPremium ? 1 : -1;
    });

    return themeList;
  }, [getAllThemes]);

  /**
   * Load and apply the saved theme
   */
  const loadSavedTheme = useCallback(async () => {
    try {
      // Get the selected theme from config
      const selectedThemeId = await invoke<string>('get_config_value', { key: 'selectedTheme' });
      
      const allThemes = getAllThemes();
      const theme = allThemes[selectedThemeId] || builtInThemes.dark;

      // Check if user can access this theme
      if (theme.isPremium && !freeThemes.includes(theme.id) && !canAccessPremium) {
        console.warn(`Theme ${theme.id} is premium and user doesn't have access. Falling back to dark theme.`);
        setCurrentTheme(builtInThemes.dark);
        applyTheme(builtInThemes.dark);
      } else {
        setCurrentTheme(theme);
        applyTheme(theme);
      }
    } catch (error) {
      console.error('Error loading saved theme:', error);
      // Fallback to dark theme
      setCurrentTheme(builtInThemes.dark);
      applyTheme(builtInThemes.dark);
    }
  }, [getAllThemes, canAccessPremium]);

  /**
   * Refresh the list of available themes
   */
  const refreshThemes = useCallback(async () => {
    setIsLoading(true);
    try {
      const external = await loadExternalThemes();
      setExternalThemes(external);
      
      const themes = buildAvailableThemes();
      setAvailableThemes(themes);
    } catch (error) {
      console.error('Error refreshing themes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadExternalThemes, buildAvailableThemes]);

  /**
   * Set a new theme
   */
  const setTheme = useCallback(async (themeId: string) => {
    const allThemes = getAllThemes();
    const theme = allThemes[themeId];

    if (!theme) {
      toast.error(`Tema "${themeId}" no encontrado`);
      return;
    }

    // Check premium access
    if (theme.isPremium && !freeThemes.includes(theme.id) && !canAccessPremium) {
      toast.error('Este tema requiere Modpack Store+', {
        description: 'Suscríbete para desbloquear temas premium',
      });
      return;
    }

    try {
      // Save theme preference to config
      await invoke('set_config_value', { 
        key: 'selectedTheme', 
        value: themeId 
      });

      // TODO: Sync with backend if user is logged in
      // await syncThemePreference(themeId);

      // Apply the theme
      setCurrentTheme(theme);
      applyTheme(theme);

      toast.success(`Tema "${theme.name}" aplicado`);
    } catch (error) {
      console.error('Error setting theme:', error);
      toast.error('Error al aplicar el tema');
    }
  }, [getAllThemes, canAccessPremium]);

  // Initialize themes on mount
  useEffect(() => {
    const initThemes = async () => {
      setIsLoading(true);
      try {
        // Load external themes first
        const external = await loadExternalThemes();
        setExternalThemes(external);

        // Build available themes list
        const themes = buildAvailableThemes();
        setAvailableThemes(themes);

        // Load and apply saved theme
        await loadSavedTheme();
      } catch (error) {
        console.error('Error initializing themes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initThemes();
  }, [loadExternalThemes, buildAvailableThemes, loadSavedTheme]);

  // Update theme list when external themes change
  useEffect(() => {
    const themes = buildAvailableThemes();
    setAvailableThemes(themes);
  }, [externalThemes, buildAvailableThemes]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        availableThemes,
        isLoading,
        canAccessPremium,
        setTheme,
        refreshThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
