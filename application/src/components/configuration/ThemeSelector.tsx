import { useState, useEffect } from 'react';
import { ThemeEngine } from '@/services/themeEngine';
import type { ThemeDefinition } from '@/types/theme';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Palette, 
  Check, 
  Download, 
  FolderOpen, 
  Trash2,
  Crown,
  Loader
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useAuthentication } from '@/stores/AuthContext';

export const ThemeSelector = () => {
  const [themes, setThemes] = useState<ThemeDefinition[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ThemeDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const { session } = useAuthentication();

  const isPatreonUser = session?.isPatreon || false;

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const [availableThemes, activeTheme] = await Promise.all([
        ThemeEngine.getAvailableThemes(),
        ThemeEngine.getCurrentTheme(),
      ]);
      setThemes(availableThemes);
      setCurrentTheme(activeTheme);
    } catch (error) {
      console.error('Failed to load themes:', error);
      toast.error('Error al cargar los temas');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTheme = async (themeId: string) => {
    try {
      setApplying(themeId);
      await ThemeEngine.applyThemeById(themeId);
      const updatedTheme = await ThemeEngine.getCurrentTheme();
      setCurrentTheme(updatedTheme);
      toast.success('Tema aplicado correctamente');
    } catch (error) {
      console.error('Failed to apply theme:', error);
      toast.error('Error al aplicar el tema');
    } finally {
      setApplying(null);
    }
  };

  const handleImportTheme = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Theme',
          extensions: ['json']
        }]
      });

      if (selected && typeof selected === 'string') {
        await ThemeEngine.importTheme(selected);
        toast.success('Tema importado correctamente');
        await loadThemes();
      }
    } catch (error) {
      console.error('Failed to import theme:', error);
      toast.error('Error al importar el tema');
    }
  };

  const handleDeleteTheme = async (themeId: string) => {
    try {
      await ThemeEngine.deleteTheme(themeId);
      toast.success('Tema eliminado correctamente');
      await loadThemes();
    } catch (error) {
      console.error('Failed to delete theme:', error);
      toast.error('Error al eliminar el tema');
    }
  };

  const handleOpenThemesDirectory = async () => {
    try {
      await ThemeEngine.openThemesDirectory();
    } catch (error) {
      console.error('Failed to open themes directory:', error);
      toast.error('Error al abrir el directorio de temas');
    }
  };

  const canUseTheme = (theme: ThemeDefinition) => {
    if (!theme.metadata.isPremium) return true;
    return isPatreonUser;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="size-5" />
          <h3 className="font-semibold">Seleccionar Tema</h3>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenThemesDirectory}
          >
            <FolderOpen className="size-4 mr-2" />
            Abrir carpeta de temas
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportTheme}
          >
            <Download className="size-4 mr-2" />
            Importar tema
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme) => {
          const isActive = currentTheme?.metadata.id === theme.metadata.id;
          const canUse = canUseTheme(theme);
          const isApplying = applying === theme.metadata.id;

          return (
            <Card
              key={theme.metadata.id}
              className={`relative overflow-hidden transition-all ${
                isActive ? 'ring-2 ring-primary' : ''
              } ${!canUse ? 'opacity-60' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{theme.metadata.name}</h4>
                      {theme.metadata.isPremium && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="size-3 mr-1" />
                          Premium
                        </Badge>
                      )}
                      {theme.metadata.isExternal && (
                        <Badge variant="outline" className="text-xs">
                          Externo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {theme.metadata.description}
                    </p>
                  </div>
                  {isActive && (
                    <Check className="size-5 text-primary flex-shrink-0" />
                  )}
                </div>

                {/* Theme color preview */}
                <div className="grid grid-cols-6 gap-1 mb-3">
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.background }}
                    title="Background"
                  />
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.primary }}
                    title="Primary"
                  />
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.secondary }}
                    title="Secondary"
                  />
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.accent }}
                    title="Accent"
                  />
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.muted }}
                    title="Muted"
                  />
                  <div
                    className="h-8 rounded"
                    style={{ backgroundColor: theme.colors.destructive }}
                    title="Destructive"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>Por {theme.metadata.author}</span>
                  <span>v{theme.metadata.version}</span>
                </div>

                <div className="flex gap-2">
                  {!isActive && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApplyTheme(theme.metadata.id)}
                      disabled={!canUse || isApplying}
                    >
                      {isApplying ? (
                        <Loader className="size-4 mr-2 animate-spin" />
                      ) : null}
                      {!canUse ? 'Requiere Patreon' : 'Aplicar'}
                    </Button>
                  )}
                  {isActive && (
                    <Button
                      size="sm"
                      className="flex-1"
                      variant="outline"
                      disabled
                    >
                      <Check className="size-4 mr-2" />
                      Activo
                    </Button>
                  )}
                  {theme.metadata.isExternal && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteTheme(theme.metadata.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>

                {!canUse && (
                  <p className="text-xs text-destructive mt-2">
                    Este tema requiere ModpackStore+ (Patreon)
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
