import React, { useState, useEffect } from 'react';
import { OnboardingStepProps, SystemMemoryInfo } from '@/types/onboarding';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { LucideArrowRight, LucideCheck, LucideAlertTriangle, LucideLoader2, LucideCpu, LucideAlertOctagon, LucideThumbsUp, LucideRotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const RAMConfigurationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
}) => {
  const [memoryInfo, setMemoryInfo] = useState<SystemMemoryInfo | null>(null);
  const [selectedRAM, setSelectedRAM] = useState<number>(4096);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSystemMemory = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const systemMemory = await invoke<SystemMemoryInfo>('get_system_memory');

        await sleep(600);

        setMemoryInfo(systemMemory);
        setSelectedRAM(systemMemory.recommended_mb);
      } catch (error) {
        console.error('Error loading system memory:', error);
        setMemoryInfo({
          total_mb: 16384,
          recommended_mb: 4096,
          min_mb: 2048,
          max_mb: 12288,
        });
        setSelectedRAM(4096);
      } finally {
        setLoading(false);
      }
    };

    loadSystemMemory();
  }, []);

  const handleNext = () => {
    onNext(selectedRAM);
  };

  const handleResetToRecommended = () => {
    if (memoryInfo) {
      setSelectedRAM(memoryInfo.recommended_mb);
      toast.info("Restaurado al valor recomendado");
    }
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  // --- Status Logic ---

  const getStatus = (current: number, total: number, recommended: number) => {
    const usagePercent = (current / total) * 100;

    if (current === recommended) {
      return {
        state: 'optimal',
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: LucideThumbsUp,
        label: 'Recomendado',
        message: 'Equilibrio perfecto entre rendimiento y estabilidad.'
      };
    }

    if (current < 2048) {
      return {
        state: 'critical',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: LucideAlertOctagon,
        label: 'Insuficiente',
        message: 'Minecraft podría no iniciarse o cerrarse inesperadamente.'
      };
    }

    if (usagePercent > 80) {
      return {
        state: 'danger',
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: LucideAlertTriangle,
        label: 'Crítico',
        message: 'Estás dejando a tu sistema operativo sin memoria. El PC podría congelarse.'
      };
    }

    if (usagePercent > 60) {
      return {
        state: 'warning',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: LucideAlertTriangle,
        label: 'Precaución',
        message: 'Asignación alta. Asegúrate de cerrar otras aplicaciones mientras juegas.'
      };
    }

    return {
      state: 'stable',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      icon: LucideCheck,
      label: 'Estable',
      message: 'Cantidad adecuada para la mayoría de modpacks.'
    };
  };

  const getSliderPercentage = (value: number) => {
    if (!memoryInfo) return 0;
    const { min_mb, max_mb } = memoryInfo;
    return ((value - min_mb) / (max_mb - min_mb)) * 100;
  };

  // --- Renders ---

  if (loading) {
    return (
      <div className="flex flex-col h-full justify-center items-center max-w-xl mx-auto px-8">
        <LucideLoader2 className="h-10 w-10 animate-spin text-neutral-500 mb-4" />
        <p className="text-neutral-400 text-lg">Analizando hardware...</p>
      </div>
    );
  }

  if (!memoryInfo) return null;

  const status = getStatus(selectedRAM, memoryInfo.total_mb, memoryInfo.recommended_mb);
  const StatusIcon = status.icon;
  const recommendedPosition = getSliderPercentage(memoryInfo.recommended_mb);
  const isRecommendedValue = selectedRAM === memoryInfo.recommended_mb;

  return (
    <div className="flex flex-col h-full justify-center max-w-xl mx-auto px-8 relative">

      {/* Header */}
      <div className="mb-10">
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
          <LucideCpu className="h-8 w-8 text-neutral-300" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          Asignación de Memoria
        </h1>

        <p className="text-neutral-400 text-lg leading-relaxed">
          Define cuánta memoria RAM puede utilizar el juego. Tu sistema tiene un total de <span className="text-white font-medium">{formatMemory(memoryInfo.total_mb)}</span>.
        </p>
      </div>

      {/* Control Area */}
      <div className="space-y-10">

        <div className="space-y-6">
          {/* Valor Principal y Botón Reset */}
          <div className="flex justify-between items-end">
            <span className="text-sm font-medium text-neutral-500 uppercase tracking-widest">Asignado</span>
            <div className="flex items-center gap-4">
              <span className={cn("text-5xl font-bold tracking-tighter transition-colors", status.color)}>
                {formatMemory(selectedRAM)}
              </span>

              {/* Botón para volver al recomendado si se ha cambiado */}
              {!isRecommendedValue && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleResetToRecommended}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors border border-white/5"
                  title="Volver a recomendado"
                >
                  <LucideRotateCcw className="h-4 w-4" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Slider Container */}
          <div className="relative pt-8 pb-2">

            {/* Marcador Recomendado (Clicable para ajustar también) */}
            <div
              className="absolute top-0 flex flex-col items-center transform -translate-x-1/2 transition-all duration-300 z-10 cursor-pointer group"
              style={{ left: `${recommendedPosition}%` }}
              onClick={handleResetToRecommended}
            >
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded mb-1 whitespace-nowrap transition-colors",
                isRecommendedValue
                  ? "text-green-500 bg-green-500/10 border border-green-500/20"
                  : "text-neutral-500 bg-white/5 border border-white/10 group-hover:text-green-400 group-hover:border-green-500/30"
              )}>
                RECOMENDADO
              </span>
              <div className={cn(
                "w-0.5 h-3 transition-colors",
                isRecommendedValue ? "bg-green-500/50" : "bg-white/10 group-hover:bg-green-500/30"
              )}></div>
            </div>

            <Slider
              value={[selectedRAM]}
              onValueChange={(value) => setSelectedRAM(value[0])}
              min={memoryInfo.min_mb}
              max={memoryInfo.max_mb}
              step={256} // Paso más fino (256MB)
              className="w-full cursor-pointer relative z-20"
            />

            {/* Etiquetas Min/Max */}
            <div className="flex justify-between mt-3 text-xs text-neutral-600 font-mono">
              <span>{formatMemory(memoryInfo.min_mb)}</span>
              <span>{formatMemory(memoryInfo.max_mb)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Status Box */}
        <AnimatePresence mode="wait">
          <motion.div
            key={status.state}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "p-4 rounded-xl border flex gap-4 items-start transition-colors duration-300",
              status.bg,
              status.border
            )}
          >
            <div className={cn("mt-0.5 shrink-0", status.color)}>
              <StatusIcon className="w-5 h-5" />
            </div>
            <div>
              <h4 className={cn("text-sm font-bold uppercase tracking-wide mb-1", status.color)}>
                {status.label}
              </h4>
              <p className="text-sm text-neutral-300/80 leading-relaxed">
                {status.message}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

      </div>

      {/* Action Buttons */}
      <div className="mt-10">
        <Button
          onClick={handleNext}
          disabled={status.state === 'critical' || status.state === 'danger'}
          className={cn(
            "w-full h-14 text-base font-medium text-black rounded-xl transition-all shadow-lg",
            (status.state === 'critical' || status.state === 'danger')
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              : "bg-white hover:bg-neutral-200 shadow-white/5"
          )}
        >
          {(status.state === 'critical' || status.state === 'danger') ? 'Ajuste Inseguro' : 'Finalizar Configuración'}
          {(status.state !== 'critical' && status.state !== 'danger') && <LucideArrowRight className="ml-2 h-5 w-5" />}
        </Button>
      </div>

    </div>
  );
};