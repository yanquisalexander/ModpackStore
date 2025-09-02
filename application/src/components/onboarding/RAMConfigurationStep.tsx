import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OnboardingStepProps, SystemMemoryInfo } from '@/types/onboarding';
import { OnboardingStepWrapper } from './OnboardingStepWrapper';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export const RAMConfigurationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
}) => {
  const [memoryInfo, setMemoryInfo] = useState<SystemMemoryInfo | null>(null);
  const [selectedRAM, setSelectedRAM] = useState<number>(2048);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSystemMemory = async () => {
      try {
        const systemMemory = await invoke<SystemMemoryInfo>('get_system_memory');
        setMemoryInfo(systemMemory);
        setSelectedRAM(systemMemory.recommended_mb);
      } catch (error) {
        console.error('Error loading system memory:', error);
        toast.error('Error al obtener información de memoria del sistema');
        // Use default values if system info fails
        setMemoryInfo({
          total_mb: 8192,
          recommended_mb: 4096,
          min_mb: 2048,
          max_mb: 8192,
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

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  if (loading) {
    return (
      <OnboardingStepWrapper
        title="Configuración de Memoria"
        description="Detectando memoria del sistema..."
        onNext={() => {}}
        nextDisabled={true}
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      </OnboardingStepWrapper>
    );
  }

  if (!memoryInfo) {
    return (
      <OnboardingStepWrapper
        title="Error"
        description="No se pudo obtener información de memoria del sistema"
        onNext={handleNext}
        onSkip={handleSkip}
      >
        <div className="text-center py-8">
          <p className="text-red-300">Error al detectar la memoria del sistema.</p>
          <p className="text-gray-300 mt-2">Se usará el valor por defecto de 4 GB.</p>
        </div>
      </OnboardingStepWrapper>
    );
  }

  return (
    <OnboardingStepWrapper
      title="Configuración de Memoria RAM"
      description="Asigna la cantidad de memoria RAM que Minecraft podrá usar"
      onNext={handleNext}
      onSkip={handleSkip}
      nextButtonText="Finalizar Configuración"
    >
      <div className="space-y-6">
        {/* System Information */}
        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Información del Sistema</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-300">Memoria Total:</span>
              <span className="ml-2 font-medium">{formatMemory(memoryInfo.total_mb)}</span>
            </div>
            <div>
              <span className="text-gray-300">Recomendado:</span>
              <span className="ml-2 font-medium text-green-400">{formatMemory(memoryInfo.recommended_mb)}</span>
            </div>
          </div>
        </div>

        {/* Memory Slider */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-lg font-medium">Memoria para Minecraft</label>
            <span className="text-2xl font-bold text-blue-400">{formatMemory(selectedRAM)}</span>
          </div>
          
          <Slider
            value={[selectedRAM]}
            onValueChange={(value) => setSelectedRAM(value[0])}
            min={memoryInfo.min_mb}
            max={memoryInfo.max_mb}
            step={256}
            className="w-full"
          />
          
          <div className="flex justify-between text-sm text-gray-400">
            <span>Mínimo: {formatMemory(memoryInfo.min_mb)}</span>
            <span>Máximo: {formatMemory(memoryInfo.max_mb)}</span>
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-4">
          <h4 className="text-blue-300 font-medium mb-2">💡 Recomendaciones</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Usa el valor recomendado para mejor rendimiento</li>
            <li>• No asignes toda tu RAM, deja memoria para el sistema</li>
            <li>• Para modpacks pesados, considera usar más memoria</li>
          </ul>
        </div>
      </div>
    </OnboardingStepWrapper>
  );
};