import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Changelog } from './Changelog';
import { invoke } from '@tauri-apps/api/core';

/**
 * Mock Changelog component for browser testing
 */
const MockChangelog: React.FC<{ showFullscreen?: boolean; onClose?: () => void }> = ({ 
  showFullscreen = false, 
  onClose 
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: showFullscreen ? 'stretch' : 'center',
      justifyContent: showFullscreen ? 'stretch' : 'center',
      padding: showFullscreen ? '0' : '20px'
    }}>
      <div style={{
        backgroundColor: 'hsl(var(--background))',
        borderRadius: showFullscreen ? '0' : '8px',
        width: showFullscreen ? '100%' : 'min(90vw, 600px)',
        height: showFullscreen ? '100%' : 'min(80vh, 600px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Banner */}
        <div style={{
          background: 'linear-gradient(to right, #2563eb, #7c3aed)',
          height: showFullscreen ? '80px' : '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: showFullscreen ? '20px' : '18px',
          fontWeight: 'bold'
        }}>
          🎉 ¡Novedades!
        </div>
        
        {/* Header */}
        <div style={{ 
          padding: '24px',
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ 
            fontSize: showFullscreen ? '24px' : '20px',
            fontWeight: 'bold',
            margin: 0,
            color: 'hsl(var(--foreground))'
          }}>
            Changelog - Versión 1.0.0
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ 
          flex: 1,
          padding: '24px',
          overflow: 'auto',
          color: 'hsl(var(--foreground))',
          lineHeight: '1.6'
        }}>
          <div style={{ maxWidth: 'none', fontSize: '14px' }}>
            <h1 style={{ color: 'hsl(var(--foreground))', marginTop: 0 }}>🎉 ¡Bienvenido a Modpack Store v1.0.0!</h1>
            
            <h2 style={{ color: 'hsl(var(--foreground))' }}>🚀 Nuevas Características</h2>
            
            <h3 style={{ color: 'hsl(var(--foreground))' }}>✨ Gestión de Modpacks</h3>
            <ul>
              <li><strong>Exploración mejorada</strong>: Navega por miles de modpacks con filtros avanzados</li>
              <li><strong>Instalación simplificada</strong>: Instala modpacks con un solo clic</li>
              <li><strong>Actualizaciones automáticas</strong>: Mantén tus modpacks siempre actualizados</li>
            </ul>

            <h3 style={{ color: 'hsl(var(--foreground))' }}>🎮 Experiencia de Juego</h3>
            <ul>
              <li><strong>Múltiples instancias</strong>: Ejecuta diferentes versiones de Minecraft simultáneamente</li>
              <li><strong>Perfiles personalizados</strong>: Configura cada instancia según tus preferencias</li>
              <li><strong>Integración con cuentas</strong>: Soporte completo para cuentas de Minecraft</li>
            </ul>

            <h3 style={{ color: 'hsl(var(--foreground))' }}>🔧 Mejoras Técnicas</h3>
            <ul>
              <li><strong>Rendimiento optimizado</strong>: Arranque más rápido y menor uso de recursos</li>
              <li><strong>Interfaz moderna</strong>: Diseño renovado con modo oscuro/claro</li>
              <li><strong>Sincronización en la nube</strong>: Tus configuraciones siempre disponibles</li>
            </ul>

            <h2 style={{ color: 'hsl(var(--foreground))' }}>🛠️ Características para Creadores</h2>
            
            <h3 style={{ color: 'hsl(var(--foreground))' }}>📦 Publicación de Modpacks</h3>
            <ul>
              <li><strong>Editor integrado</strong>: Crea y edita modpacks directamente en la aplicación</li>
              <li><strong>Versionado automático</strong>: Control de versiones simplificado</li>
              <li><strong>Analytics detallados</strong>: Estadísticas de descargas y uso</li>
            </ul>

            <h3 style={{ color: 'hsl(var(--foreground))' }}>💰 Monetización</h3>
            <ul>
              <li><strong>Múltiples opciones</strong>: Modpacks gratuitos, de pago o con donaciones</li>
              <li><strong>Integración PayPal</strong>: Pagos seguros y rápidos</li>
              <li><strong>Dashboard de ganancias</strong>: Seguimiento de ingresos en tiempo real</li>
            </ul>

            <h2 style={{ color: 'hsl(var(--foreground))' }}>🌟 Próximamente</h2>
            <ul>
              <li>Soporte para más launchers</li>
              <li>Integración con Discord Rich Presence</li>
              <li>Marketplace de texturas y shaders</li>
              <li>Y mucho más...</li>
            </ul>

            <hr style={{ margin: '20px 0', borderColor: 'hsl(var(--border))' }}/>
            <p style={{ textAlign: 'center', fontStyle: 'italic' }}>¡Gracias por usar Modpack Store! 🎮✨</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '24px',
          borderTop: '1px solid hsl(var(--border))',
          backgroundColor: 'hsl(var(--muted))',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClose}
            style={{
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              cursor: 'pointer',
              minWidth: '96px'
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Demo component to test the Changelog component
 * This is for testing purposes only and can be removed after implementation
 */
export const ChangelogDemo: React.FC = () => {
  const [showCentered, setShowCentered] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const resetChangelogId = async () => {
    try {
      // Reset the lastChangelogId to force the changelog to show
      await invoke('set_config', { 
        key: 'lastChangelogId', 
        value: 0 
      });
      alert('Changelog ID reset to 0! Refresh the page to see the changelog.');
    } catch (error) {
      console.error('Error resetting changelog ID:', error);
      alert('Cannot reset changelog ID in browser mode. This feature requires Tauri.');
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Changelog Component Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Test the Changelog component in different modes. The changelog automatically 
            shows when lastChangelogId is different from the current CHANGELOG_ID.
          </p>
          
          <div className="flex gap-4">
            <Button 
              onClick={() => setShowCentered(true)}
              variant="outline"
            >
              Show Centered Modal
            </Button>
            
            <Button 
              onClick={() => setShowFullscreen(true)}
              variant="outline"  
            >
              Show Fullscreen Modal
            </Button>
            
            <Button 
              onClick={resetChangelogId}
              variant="secondary"
            >
              Reset Changelog ID (Tauri only)
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            <p><strong>Note:</strong> In browser mode, mock versions are shown for demonstration. 
            In the actual Tauri app, the real Changelog component will be used.</p>
          </div>
        </CardContent>
      </Card>

      {/* Mock changelog for browser testing */}
      {showCentered && (
        <MockChangelog 
          showFullscreen={false} 
          onClose={() => setShowCentered(false)} 
        />
      )}

      {showFullscreen && (
        <MockChangelog 
          showFullscreen={true} 
          onClose={() => setShowFullscreen(false)} 
        />
      )}
    </div>
  );
};

export default ChangelogDemo;