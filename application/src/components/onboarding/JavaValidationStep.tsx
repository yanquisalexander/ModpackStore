import React, { useState, useEffect } from 'react';
import { OnboardingStepProps } from '@/types/onboarding';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { LucideCheck, LucideCoffee, LucideDownload, LucideLoader2, LucideAlertTriangle, LucideArrowRight, LucideSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface JavaValidationResult {
  is_installed: boolean;
  java_path?: string;
  version?: string;
}

export const JavaValidationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
}) => {
  const [status, setStatus] = useState<'checking' | 'found' | 'missing' | 'installing' | 'success'>('checking');
  const [javaData, setJavaData] = useState<JavaValidationResult | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    validateJava();
  }, []);

  const validateJava = async () => {
    setStatus('checking');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<JavaValidationResult>('validate_java_installation');

      await sleep(1500); // Un poco más de tiempo para apreciar la animación de carga

      setJavaData(result);
      if (result.is_installed) {
        setStatus('found');
      } else {
        setStatus('missing');
      }
    } catch (error) {
      console.error(error);
      setStatus('missing');
    }
  };

  const handleAutoInstall = async () => {
    setStatus('installing');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => (prev >= 95 ? 95 : prev + Math.random() * 5));
    }, 200);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const javaPath = await invoke<string>('install_java');

      clearInterval(interval);
      setProgress(100);
      await sleep(500);

      setJavaData({ is_installed: true, java_path: javaPath, version: '17.0.8' });
      setStatus('success');
      toast.success('Java instalado correctamente');

      await sleep(1000);
      onNext();

    } catch (error) {
      clearInterval(interval);
      toast.error('Error en la instalación automática');
      setStatus('missing');
    }
  };

  return (
    <div className="flex flex-col h-full justify-center max-w-xl mx-auto px-8 relative">

      {/* Icono Hero (Estado Dinámico) */}
      <div className="mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          key={status}
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-colors duration-500",
            status === 'checking' ? "bg-white/5 border border-white/10" :
              status === 'missing' ? "bg-orange-500/10 border border-orange-500/20 text-orange-500" :
                status === 'installing' ? "bg-blue-500/10 border border-blue-500/20 text-blue-500" :
                  "bg-green-500 text-black shadow-green-500/20"
          )}
        >
          {status === 'checking' && <LucideSearch className="h-8 w-8 text-neutral-400 animate-pulse" />}
          {status === 'missing' && <LucideAlertTriangle className="h-8 w-8" />}
          {status === 'installing' && <LucideDownload className="h-8 w-8 animate-bounce" />}
          {(status === 'found' || status === 'success') && <LucideCheck className="h-8 w-8" />}
        </motion.div>

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          Entorno Java
        </h1>

        <div className="min-h-[60px]">
          <p className="text-neutral-400 text-lg leading-relaxed">
            {status === 'checking' && "Escaneando archivos del sistema..."}
            {status === 'missing' && "No detectamos Java. Es necesario para ejecutar el juego."}
            {(status === 'found' || status === 'success') && "Todo correcto. Se ha detectado una versión compatible."}
            {status === 'installing' && "Descargando componentes necesarios..."}
          </p>
        </div>
      </div>

      {/* Area de Contenido Dinámico */}
      <div className="space-y-6 relative min-h-[120px]">

        {/* ESTADO: ESCANEANDO */}
        {status === 'checking' && (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-neutral-500 uppercase tracking-wider font-medium">
                <span>Analizando PATH</span>
                <span>En progreso...</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white/20"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ESTADO: ENCONTRADO / ÉXITO */}
        {(status === 'found' || status === 'success') && javaData && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-center gap-2 mb-1 text-neutral-400">
                <LucideCoffee className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Versión</span>
              </div>
              <div className="text-xl font-mono text-white truncate">
                {javaData.version || 'Detectada'}
              </div>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <div className="flex items-center gap-2 mb-1 text-neutral-400">
                <LucideCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Estado</span>
              </div>
              <div className="text-xl font-medium text-green-400">
                Compatible
              </div>
            </div>
            <div className="col-span-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <p className="text-xs text-neutral-600 font-mono truncate px-1">
                {javaData.java_path || "Ruta del sistema"}
              </p>
            </div>
          </motion.div>
        )}

        {/* ESTADO: INSTALANDO */}
        {status === 'installing' && (
          <div className="space-y-4">
            <div className="p-6 border border-blue-500/20 bg-blue-500/5 rounded-2xl flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <span className="text-blue-400 font-medium">Descargando OpenJDK...</span>
                <span className="text-2xl font-bold text-white">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full bg-blue-500/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear", duration: 0.2 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ESTADO: FALTA JAVA */}
        {status === 'missing' && (
          <div className="p-5 border border-orange-500/20 bg-orange-500/5 rounded-2xl">
            <h3 className="text-orange-400 font-medium mb-1">Instalación Requerida</h3>
            <p className="text-sm text-neutral-400">
              No te preocupes, podemos descargar e instalar una versión optimizada de Java automáticamente.
            </p>
          </div>
        )}

      </div>

      {/* Botones de Acción */}
      <div className="mt-10 h-14">
        {(status === 'found' || status === 'success') && (
          <Button
            onClick={() => onNext()}
            className="w-full h-14 text-base font-medium bg-white text-black hover:bg-neutral-200 rounded-xl transition-all shadow-lg shadow-white/5"
          >
            Continuar <LucideArrowRight className="ml-2 h-5 w-5" />
          </Button>
        )}

        {status === 'missing' && (
          <div className="flex gap-4">
            <Button
              onClick={handleAutoInstall}
              className="flex-1 h-14 text-base font-medium bg-white text-black hover:bg-neutral-200 rounded-xl transition-all"
            >
              Instalar Java (Recomendado)
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="h-14 px-6 text-base font-medium border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white rounded-xl"
            >
              Omitir
            </Button>
          </div>
        )}
      </div>

    </div>
  );
};