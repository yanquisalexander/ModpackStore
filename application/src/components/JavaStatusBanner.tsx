import React from 'react';
import { X, Sparkles, Download, CheckCircle2, TriangleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useJavaValidation } from '@/hooks/useJavaValidation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface JavaStatusBannerProps {
  className?: string;
}

export const JavaStatusBanner: React.FC<JavaStatusBannerProps> = ({ className = '' }) => {
  const { javaValidation, loading, isInstalling, repairStatus, repairJava } = useJavaValidation();
  const [dismissed, setDismissed] = React.useState(false);

  const isWorking = isInstalling || !!repairStatus;

  const handleRepairJava = async () => {
    try {
      await repairJava();
      toast.success('Java configurado correctamente', {
        description: 'Todo listo para jugar.',
        icon: <CheckCircle2 className="text-green-500" />,
      });
    } catch (error) {
      toast.error('Error al reparar Java', {
        description: 'Intenta instalarlo manualmente desde java.com',
      });
    }
  };

  if (loading || dismissed || !javaValidation || javaValidation.is_installed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
        transition={{ duration: 0.35 }}
        className={cn("overflow-hidden", className)}
      >
        <div className="relative bg-[#1a1a1d] border border-white/[0.06] rounded-xl overflow-hidden">

          {isWorking && (
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-neutral-600"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />
          )}

          <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/[0.04] rounded-lg flex-shrink-0 mt-0.5">
                {isWorking ? (
                  <Download className="h-4 w-4 text-neutral-400" />
                ) : (
                  <TriangleAlert className="h-4 w-4 text-neutral-400" />
                )}
              </div>

              <div className="space-y-0.5">
                <h3 className="text-white text-sm font-semibold">
                  Se requiere Java
                </h3>
                <p className="text-neutral-500 text-xs max-w-lg leading-relaxed">
                  {repairStatus ? (
                    <span className="text-neutral-400">{repairStatus}</span>
                  ) : (
                    "Necesitamos instalar Java para ejecutar Minecraft y los mods."
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto pl-11 md:pl-0">
              <button
                onClick={handleRepairJava}
                disabled={isWorking}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                  isWorking
                    ? "bg-neutral-800 text-neutral-500 cursor-wait"
                    : "bg-white text-black hover:bg-white/90 active:scale-95"
                )}
              >
                {isWorking ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    <span>Reparar</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setDismissed(true)}
                disabled={isWorking}
                className="p-2 rounded-lg text-neutral-600 hover:text-neutral-400 transition-colors"
                title="Descartar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
