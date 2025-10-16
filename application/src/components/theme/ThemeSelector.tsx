import { useTheme } from '@/stores/ThemeContext';
import { ThemeInfo, ThemeType } from '@/types/theme';
import { Check, Lock, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';

export const ThemeSelector: React.FC = () => {
  const { currentTheme, availableThemes, isLoading, canAccessPremium, setTheme, refreshThemes } = useTheme();

  const handleThemeClick = async (theme: ThemeInfo) => {
    if (theme.isPremium && !canAccessPremium) {
      toast.error('Tema premium bloqueado', {
        description: 'Suscríbete a Modpack Store+ para desbloquear este tema',
      });
      return;
    }

    await setTheme(theme.id);
  };

  const openThemesFolder = async () => {
    try {
      const themesPath = await invoke<string>('get_themes_directory_path');
      console.log('Opening themes folder at:', themesPath);
      await openPath(themesPath);
      toast.success('Carpeta de temas abierta');
    } catch (error) {
      console.error('Error opening themes folder:', error);
      console.error(error);
      toast.error('Error al abrir la carpeta de temas');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshThemes}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Recargar temas
          </button>

          <button
            onClick={openThemesFolder}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir carpeta de temas
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableThemes.map((theme) => {
          const isSelected = currentTheme?.id === theme.id;
          const isLocked = theme.isPremium && !canAccessPremium;

          return (
            <button
              key={theme.id}
              onClick={() => handleThemeClick(theme)}
              disabled={isLocked}
              className={cn(
                'relative p-4 border-2 rounded-lg text-left transition-all',
                'hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary',
                isSelected && 'border-primary bg-primary/5',
                !isSelected && 'border-border',
                isLocked && 'opacity-60 cursor-not-allowed hover:border-border'
              )}
            >
              <div className="flex justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{theme.name}</h4>
                    {theme.type === ThemeType.EXTERNAL && (
                      <span className="px-2 py-0.5 text-xs bg-secondary rounded-full">
                        Externo
                      </span>
                    )}
                  </div>
                  {theme.author && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      por {theme.author}
                    </p>
                  )}
                </div>

                {isSelected && (
                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                )}
                {isLocked && (
                  <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {theme.description}
              </p>

              {theme.isPremium && (
                <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                  <Lock className="h-3 w-3" />
                  <span>Modpack Store+ requerido</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {availableThemes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay temas disponibles</p>
        </div>
      )}
    </div>
  );
};
