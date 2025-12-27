import { useTheme } from '@/stores/ThemeContext';
import { ThemeInfo, ThemeType } from '@/types/theme';
import {
  Check,
  Lock,
  ExternalLink,
  RefreshCw,
  Palette,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export const ThemeSelector: React.FC = () => {
  const { currentTheme, availableThemes, isLoading, canAccessPremium, setTheme, refreshThemes } = useTheme();

  const handleThemeClick = async (theme: ThemeInfo) => {
    if (theme.isPremium && !canAccessPremium) {
      toast.error('Tema Premium', { description: 'Suscríbete a Modpack Store+ para desbloquear.' });
      return;
    }
    await setTheme(theme.id);
  };

  const openThemesFolder = async () => {
    try {
      const themesPath = await invoke<string>('get_themes_directory_path');
      await openPath(themesPath);
      toast.success('Carpeta abierta');
    } catch { toast.error('Error al abrir carpeta'); }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-white/30">
        <div className="animate-spin h-8 w-8 border-2 border-current border-t-transparent rounded-full" />
        <span className="text-xs uppercase tracking-widest">Cargando Temas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

      {/* --- HEADER ACTIONS --- */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-white">Biblioteca de Temas</h3>
          <p className="text-xs text-white/40">Personaliza la interfaz a tu gusto.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshThemes}
            disabled={isLoading}
            className="h-8 text-white/60 hover:text-white hover:bg-white/5 gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Recargar</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={openThemesFolder}
            className="h-8 text-white/60 hover:text-white hover:bg-white/5 gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Abrir Carpeta</span>
          </Button>
        </div>
      </div>

      {/* --- THEME GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {availableThemes.map((theme) => {
          const isSelected = currentTheme?.id === theme.id;
          const isLocked = theme.isPremium && !canAccessPremium;

          return (
            <button
              key={theme.id}
              onClick={() => handleThemeClick(theme)}
              disabled={isLocked}
              className={cn(
                "group relative flex flex-col items-start p-4 rounded-xl transition-all duration-300",
                "border backdrop-blur-sm overflow-hidden",
                // Styles based on state
                isSelected
                  ? "bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10",
                isLocked && "opacity-60 cursor-not-allowed hover:bg-white/[0.03] hover:border-white/5"
              )}
            >
              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 text-blue-400 animate-in zoom-in duration-300">
                  <div className="bg-blue-500/20 p-1 rounded-full">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                </div>
              )}

              {/* Locked Indicator */}
              {isLocked && (
                <div className="absolute top-3 right-3 text-white/30">
                  <Lock className="h-4 w-4" />
                </div>
              )}

              {/* Theme Icon / Preview */}
              <div className={cn(
                "mb-3 p-2.5 rounded-lg transition-colors",
                isSelected ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/40 group-hover:text-white/80"
              )}>
                <Palette className="h-5 w-5" />
              </div>

              {/* Info */}
              <div className="w-full text-left">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className={cn("font-semibold text-sm", isSelected ? "text-white" : "text-white/90")}>
                    {theme.name}
                  </h4>

                  {theme.isPremium && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/20">
                      <Sparkles className="h-2 w-2" />
                      PLUS
                    </span>
                  )}

                  {theme.type === ThemeType.EXTERNAL && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-white/10 text-white/50 border border-white/5">
                      Custom
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/50 line-clamp-2 min-h-[2.5em]">
                  {theme.description || "Sin descripción disponible."}
                </p>

                {theme.author && (
                  <div className="mt-3 pt-3 border-t border-white/5 w-full text-[10px] text-white/30">
                    Creado por <span className="text-white/50">{theme.author}</span>
                  </div>
                )}
              </div>

              {/* Premium Overlay (If locked) */}
              {isLocked && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl">
                  <Lock className="h-6 w-6 text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Exclusivo Premium</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {availableThemes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
          <Palette className="h-10 w-10 text-white/10" />
          <p className="text-sm text-white/40">No se encontraron temas instalados.</p>
          <Button variant="outline" size="sm" onClick={openThemesFolder} className="mt-2 border-white/10 hover:bg-white/5 text-white/60">
            Abrir carpeta de temas
          </Button>
        </div>
      )}
    </div>
  );
};