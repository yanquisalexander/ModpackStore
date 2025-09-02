import React, { useState } from 'react';
import { OnboardingStep } from '@/types/onboarding';
import { RAMConfigurationStep } from './RAMConfigurationStep';
import { toast } from 'sonner';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);

  // Define the onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'ram-configuration',
      title: 'Configuración de RAM',
      component: RAMConfigurationStep,
    },
    // More steps can be added here in the future
  ];

  const currentStep = steps[currentStepIndex];

  const handleNext = async (data?: any) => {
    if (currentStepIndex === steps.length - 1) {
      // This is the last step, complete onboarding
      await completeOnboarding(data);
    } else {
      // Move to next step
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleSkip = async () => {
    setCompletingOnboarding(true);
    try {
      // Try to use real Tauri invoke first
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('skip_onboarding');
      toast.success('Configuración inicial completada', {
        description: 'Se usarán los valores recomendados por el sistema.',
      });
      onComplete();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
      toast.error('Error al omitir configuración', {
        description: 'Ocurrió un error al aplicar la configuración por defecto.',
      });
    } finally {
      setCompletingOnboarding(false);
    }
  };

  const completeOnboarding = async (ramAllocation: number) => {
    setCompletingOnboarding(true);
    try {
      // Try to use real Tauri invoke first
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('complete_onboarding', { ramAllocation });
      toast.success('¡Configuración completada!', {
        description: `Memoria asignada: ${ramAllocation >= 1024 ? `${(ramAllocation / 1024).toFixed(1)} GB` : `${ramAllocation} MB`}`,
      });
      onComplete();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast.error('Error al guardar configuración', {
        description: 'Ocurrió un error al guardar la configuración. Intenta nuevamente.',
      });
    } finally {
      setCompletingOnboarding(false);
    }
  };

  // Show loading overlay when completing onboarding
  if (completingOnboarding) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-6 mx-auto"></div>
          <h2 className="text-2xl font-bold mb-2">Guardando configuración...</h2>
          <p className="text-gray-300">Por favor espera un momento</p>
        </div>
      </div>
    );
  }

  const StepComponent = currentStep.component;

  return (
    <StepComponent
      onNext={handleNext}
      onSkip={handleSkip}
    />
  );
};