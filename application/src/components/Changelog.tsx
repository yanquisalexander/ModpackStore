import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Current changelog version ID - increment this when updating changelog content
const CHANGELOG_ID = 1;

// Changelog content in Markdown format
const CHANGELOG_CONTENT = `# 🎉 ¡Bienvenido a Modpack Store v1.0.0!

## 🚀 Nuevas Características

### ✨ Gestión de Modpacks
- **Exploración mejorada**: Navega por miles de modpacks con filtros avanzados
- **Instalación simplificada**: Instala modpacks con un solo clic
- **Actualizaciones automáticas**: Mantén tus modpacks siempre actualizados

### 🎮 Experiencia de Juego
- **Múltiples instancias**: Ejecuta diferentes versiones de Minecraft simultáneamente
- **Perfiles personalizados**: Configura cada instancia según tus preferencias
- **Integración con cuentas**: Soporte completo para cuentas de Minecraft

### 🔧 Mejoras Técnicas
- **Rendimiento optimizado**: Arranque más rápido y menor uso de recursos
- **Interfaz moderna**: Diseño renovado con modo oscuro/claro
- **Sincronización en la nube**: Tus configuraciones siempre disponibles

## 🛠️ Características para Creadores

### 📦 Publicación de Modpacks
- **Editor integrado**: Crea y edita modpacks directamente en la aplicación
- **Versionado automático**: Control de versiones simplificado
- **Analytics detallados**: Estadísticas de descargas y uso

### 💰 Monetización
- **Múltiples opciones**: Modpacks gratuitos, de pago o con donaciones
- **Integración PayPal**: Pagos seguros y rápidos
- **Dashboard de ganancias**: Seguimiento de ingresos en tiempo real

## 🌟 Próximamente
- Soporte para más launchers
- Integración con Discord Rich Presence
- Marketplace de texturas y shaders
- Y mucho más...

---

¡Gracias por usar Modpack Store! 🎮✨`;

interface ChangelogProps {
  showFullscreen?: boolean;
}

export const Changelog: React.FC<ChangelogProps> = ({ showFullscreen = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if changelog should be shown on component mount
  useEffect(() => {
    const checkShouldShow = async () => {
      try {
        const lastChangelogId = await invoke<number | null>('get_config_value', { 
          key: 'lastChangelogId' 
        });
        
        // Show changelog if lastChangelogId is different from current CHANGELOG_ID
        // If lastChangelogId is null or undefined, default to 0
        const currentStoredId = lastChangelogId ?? 0;
        if (currentStoredId !== CHANGELOG_ID) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error('Error checking changelog ID:', error);
        // If there's an error (like config doesn't exist), show the changelog
        setIsOpen(true);
      }
    };

    checkShouldShow();
  }, []);

  const handleClose = async () => {
    setLoading(true);
    try {
      // Update lastChangelogId in config
      await invoke('set_config', { 
        key: 'lastChangelogId', 
        value: CHANGELOG_ID 
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating changelog ID:', error);
      // Even if there's an error, close the modal
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const DialogContentComponent = showFullscreen ? (
    <DialogContent 
      className={cn(
        "fixed inset-0 z-50 bg-background",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "w-full h-full max-w-none max-h-none m-0 p-0 rounded-none border-0",
        "flex flex-col"
      )}
      role="dialog"
      aria-labelledby="changelog-title"
      aria-describedby="changelog-content"
    >
      {/* Banner area - Discord-like (no padding) */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-20 flex items-center justify-center">
        <h2 className="text-white text-xl font-bold">🎉 ¡Novedades!</h2>
      </div>
      
      {/* Header with close button */}
      <div className="flex items-center justify-between p-6 border-b">
        <DialogHeader className="flex-1">
          <DialogTitle id="changelog-title" className="text-2xl font-bold">
            Changelog - Versión 1.0.0
          </DialogTitle>
        </DialogHeader>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          disabled={loading}
          className="ml-4"
          aria-label="Cerrar changelog"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <ScrollArea className="h-full">
          <div 
            id="changelog-content"
            className="prose prose-sm dark:prose-invert max-w-none pr-4"
          >
            <ReactMarkdown>{CHANGELOG_CONTENT}</ReactMarkdown>
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-6 border-t bg-muted/30">
        <div className="flex justify-end">
          <Button
            onClick={handleClose}
            disabled={loading}
            className="min-w-24"
          >
            {loading ? 'Cerrando...' : 'Entendido'}
          </Button>
        </div>
      </div>
    </DialogContent>
  ) : (
    <DialogContent 
      className="sm:max-w-2xl max-w-[90vw] max-h-[80vh] flex flex-col p-0"
      role="dialog"
      aria-labelledby="changelog-title"
      aria-describedby="changelog-content"
    >
      {/* Banner area - Discord-like (no padding) */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-16 flex items-center justify-center rounded-t-lg">
        <h2 className="text-white text-lg font-bold">🎉 ¡Novedades!</h2>
      </div>
      
      {/* Header */}
      <DialogHeader className="p-6 pb-4">
        <DialogTitle id="changelog-title" className="text-xl font-bold">
          Changelog - Versión 1.0.0
        </DialogTitle>
      </DialogHeader>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-6">
        <ScrollArea className="h-96">
          <div 
            id="changelog-content"
            className="prose prose-sm dark:prose-invert max-w-none pr-4"
          >
            <ReactMarkdown>{CHANGELOG_CONTENT}</ReactMarkdown>
          </div>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="p-6 pt-4 border-t">
        <div className="flex justify-end">
          <Button
            onClick={handleClose}
            disabled={loading}
            className="min-w-24"
          >
            {loading ? 'Cerrando...' : 'Entendido'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      {DialogContentComponent}
    </Dialog>
  );
};

export default Changelog;