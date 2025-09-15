import React from 'react';
import { AlertCircle, Download, X, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useJavaValidation } from '@/hooks/useJavaValidation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface JavaStatusBannerProps {
  className?: string;
}

export const JavaStatusBanner: React.FC<JavaStatusBannerProps> = ({ className = '' }) => {
  const { javaValidation, loading, isInstalling, repairStatus, repairJava } = useJavaValidation();
  const [dismissed, setDismissed] = React.useState(false);

  console.log('Java Validation State:', { javaValidation, loading, isInstalling, repairStatus });

  const handleRepairJava = async () => {
    try {
      await repairJava();
      toast.success('Java configurado correctamente', {
        description: 'Java se ha configurado exitosamente en tu sistema.',
      });
    } catch (error) {
      toast.error('Error al reparar Java', {
        description: 'No se pudo reparar Java automáticamente. Por favor, intenta manualmente.',
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

  const getRepairButtonContent = () => {
    if (repairStatus) {
      if (repairStatus.includes('Buscando')) {
        return (
          <>
            <Search className="h-4 w-4 animate-pulse" />
            {repairStatus}
          </>
        );
      } else if (repairStatus.includes('Descargando')) {
        return (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Descargando...
          </>
        );
      } else {
        return (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            {repairStatus}
          </>
        );
      }
    }

    if (isInstalling) {
      return (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          Descargando...
        </>
      );
    }

    return (
      <>
        <Download className="h-4 w-4" />
        Reparar automáticamente
      </>
    );
  };

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
                Java no detectado
              </h3>
              <p className="text-orange-300/90 text-sm">
                {repairStatus || 'Algunas funciones podrían no estar disponibles. Se requiere Java para ejecutar modpacks.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleRepairJava}
              disabled={isInstalling || !!repairStatus}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md flex items-center gap-2 flex-shrink-0"
            >
              {getRepairButtonContent()}
            </Button>

            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="icon"
              className="text-orange-400 hover:text-orange-300 hover:bg-orange-900/30 h-8 w-8"
              disabled={isInstalling || !!repairStatus}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};