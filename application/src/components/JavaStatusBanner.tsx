import React from 'react';
import { AlertCircle, X, Search, Sparkles, Download, CheckCircle2, TriangleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useJavaValidation } from '@/hooks/useJavaValidation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils'; // Asumo que tienes esto, si no, usa string templates

interface JavaStatusBannerProps {
  className?: string;
}

export const JavaStatusBanner: React.FC<JavaStatusBannerProps> = ({ className = '' }) => {
  const { javaValidation, loading, isInstalling, repairStatus, repairJava } = useJavaValidation();
  const [dismissed, setDismissed] = React.useState(false);

  // Estados derivados para limpiar el renderizado
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
        initial={{ height: 0, opacity: 0, scale: 0.95 }}
        animate={{ height: "auto", opacity: 1, scale: 1 }}
        exit={{ height: 0, opacity: 0, scale: 0.95, marginBottom: 0 }}
        transition={{ duration: 0.4, type: "spring", bounce: 0.3 }}
        className={cn("overflow-hidden mb-6", className)}
      >
        <div className="relative bg-neutral-900/80 backdrop-blur-xl border border-orange-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-orange-900/10">

          {/* Barra de progreso decorativa en el fondo si está trabajando */}
          {isWorking && (
            <motion.div
              className="absolute bottom-0 left-0 h-1 bg-orange-500/50 blur-[2px]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Glow effect lateral */}
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-600" />

          <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">

            {/* Contenido Izquierdo */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/10 shadow-inner">
                {isWorking ? (
                  <Download className="h-6 w-6 text-orange-400 animate-bounce" />
                ) : (
                  <TriangleAlert className="h-6 w-6 text-orange-500" />
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  Se requiere Java
                  {!isWorking && (
                    <span className="text-[10px] uppercase tracking-wider bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/10">
                      Importante
                    </span>
                  )}
                </h3>
                <p className="text-neutral-400 text-sm max-w-lg leading-relaxed">
                  {repairStatus ? (
                    <span className="text-orange-300 animate-pulse font-medium">{repairStatus}</span>
                  ) : (
                    "Para ejecutar Minecraft y los mods correctamente, necesitamos instalar una versión compatible de Java."
                  )}
                </p>
              </div>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center gap-3 w-full md:w-auto pl-14 md:pl-0">
              <button
                onClick={handleRepairJava}
                disabled={isWorking}
                className={cn(
                  "relative group flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg",
                  isWorking
                    ? "bg-neutral-800 text-neutral-400 cursor-wait border border-neutral-700"
                    : "bg-gradient-to-r from-orange-500 to-amber-600 hover:to-orange-500 text-white hover:scale-105 border border-orange-400/20 shadow-orange-900/20 hover:shadow-orange-500/20"
                )}
              >
                {/* Lógica de Iconos/Texto del Botón */}
                {isWorking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Reparar Automáticamente</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setDismissed(true)}
                disabled={isWorking}
                className="p-2.5 rounded-xl text-neutral-500 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/5"
                title="Descartar por ahora"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};