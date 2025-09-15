import React from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useJavaValidation } from '@/hooks/useJavaValidation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface JavaStatusBannerProps {
  className?: string;
}

export const JavaStatusBanner: React.FC<JavaStatusBannerProps> = ({ className = '' }) => {
  const { javaValidation, loading, isInstalling, installJava } = useJavaValidation();
  const [dismissed, setDismissed] = React.useState(false);

  const handleRepairJava = async () => {
    try {
      await installJava();
      toast.success('Java instalado correctamente', {
        description: 'Java se ha configurado exitosamente en tu sistema.',
      });
    } catch (error) {
      toast.error('Error al instalar Java', {
        description: 'No se pudo instalar Java automáticamente. Por favor, intenta manualmente.',
      });
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Don't show banner if loading, dismissed, or if Java is installed
  if (loading || dismissed || !javaValidation || javaValidation.is_installed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={`bg-orange-900/20 border border-orange-400/30 rounded-lg p-4 mb-6 ${className}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-orange-400 font-semibold text-sm">
                ⚠️ Java no detectado
              </h3>
              <p className="text-orange-300/90 text-sm">
                Algunas funciones podrían no estar disponibles. Se requiere Java para ejecutar modpacks.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRepairJava}
              disabled={isInstalling}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center gap-2 flex-shrink-0"
            >
              {isInstalling ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Reparar automáticamente
                </>
              )}
            </Button>
            
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="icon"
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};