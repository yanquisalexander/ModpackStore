import React, { useState } from 'react';
import { OnboardingStep, OnboardingStepProps } from '@/types/onboarding';
import { RAMConfigurationStep } from './RAMConfigurationStep';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LucidePackage } from 'lucide-react';

// small helper to wait
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Welcome Step Component ---
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext, onSkip }) => {
  return (
    <div className=" mx-auto p-6 min-h-screen flex items-center">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="grid md:grid-cols-3 gap-6 w-full">
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white">
                <LucidePackage className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Bienvenido</h2>
                <p className="text-sm text-muted-foreground">Configuración inicial</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold mb-2">Bienvenido a ModpackStore</h1>
              <p className="text-sm text-muted-foreground mb-4">Te guiaremos en la configuración inicial para que tu launcher funcione correctamente.</p>

              <motion.div className="mt-4 space-y-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}>
                <p className="text-sm text-muted-foreground">Este asistente te ayudará a:</p>
                <ul className="list-disc ml-6 text-sm text-muted-foreground">
                  <li>Asignar memoria recomendada para Minecraft</li>
                  <li>Configurar opciones iniciales del launcher</li>
                  <li>Preparar tu cuenta y descargas</li>
                </ul>
              </motion.div>

              <div className="flex justify-end mt-6">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={() => onNext()}>
                    Empezar
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);

  // Define the onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Bienvenida',
      component: WelcomeStep,
    },
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
    const start = Date.now();
    try {
      // Try to use real Tauri invoke first
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('skip_onboarding');
      toast.success('Configuración inicial completada', {
        description: 'Se usarán los valores recomendados por el sistema.',
      });

      // Ensure the overlay is visible at least 2 seconds
      const elapsed = Date.now() - start;
      if (elapsed < 2000) await sleep(2000 - elapsed);

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
    const start = Date.now();
    try {
      // Try to use real Tauri invoke first
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('complete_onboarding', { ramAllocation });
      toast.success('¡Configuración completada!', {
        description: `Memoria asignada: ${ramAllocation >= 1024 ? `${(ramAllocation / 1024).toFixed(1)} GB` : `${ramAllocation} MB`}`,
      });

      // Ensure the overlay is visible at least 2 seconds
      const elapsed = Date.now() - start;
      if (elapsed < 2000) await sleep(2000 - elapsed);

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
      <div className="container mx-auto p-6 min-h-screen flex items-center">
        <div className="w-full flex justify-center">
          <Card>
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <h2 className="text-xl font-semibold">Guardando configuración...</h2>
              <p className="text-sm text-muted-foreground">Por favor espera un momento</p>
            </CardContent>
          </Card>
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