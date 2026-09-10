import React, { useState } from 'react';
import { OnboardingStep, OnboardingStepProps } from '@/types/onboarding';
import { RAMConfigurationStep } from './RAMConfigurationStep';
import { JavaValidationStep } from './JavaValidationStep';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';

import { LucideArrowRight, LucideCheck, LucideCpu, LucideLayers, LucideZap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountCreationStep } from "./AccountCreationStep";

// Helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Welcome Step ---
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col h-full justify-center max-w-2xl mx-auto px-8">

      {/* Header */}
      <div className="mb-10">
        <div className="w-16 h-16 bg-muted/30 rounded-xl flex items-center justify-center mb-6 border border-border">
          <LucideLayers className="h-8 w-8 text-muted-foreground" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          Bienvenido a Modpack Store
        </h1>

        <p className="text-muted-foreground text-base leading-relaxed">
          Vamos a preparar tu entorno de juego en unos segundos. Optimizaremos Java y la memoria para que solo te preocupes de jugar.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="p-4 rounded-lg bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/30">
              <LucideCpu className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">Java Check</h3>
              <p className="text-xs text-muted-foreground">Verificamos tu instalación</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-muted/20 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/30">
              <LucideZap className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">RAM Boost</h3>
              <p className="text-xs text-muted-foreground">Optimizamos la memoria</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div>
        <Button
          onClick={() => onNext()}
          className="w-full h-12 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-lg"
        >
          Empezar Configuración
          <LucideArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// --- Loading Component ---
const FinishingView = () => (
  <div className="flex flex-col items-center justify-center h-full animate-in fade-in zoom-in duration-500">
    <div className="w-16 h-16 border-4 border-border border-t-white rounded-full animate-spin mb-6" />
    <h3 className="text-2xl font-bold text-white mb-2">Finalizando...</h3>
    <p className="text-muted-foreground">Aplicando tu configuración óptima.</p>
  </div>
);

// --- Main Component ---

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [ramAllocation, setRamAllocation] = useState<number>(4096);

  const steps: OnboardingStep[] = [
    { id: 'welcome', title: 'Inicio', component: WelcomeStep },
    { id: 'java-validation', title: 'Java', component: JavaValidationStep },
    { id: 'ram-configuration', title: 'Memoria', component: RAMConfigurationStep },
    { id: 'account-creation', title: 'Cuenta', component: AccountCreationStep },
  ];

  const currentStep = steps[currentStepIndex];

  const handleNext = async (data?: any) => {
    if (steps[currentStepIndex].id === 'ram-configuration' && typeof data === 'number') {
      setRamAllocation(data);
    }

    if (currentStepIndex === steps.length - 1) {
      await completeOnboarding(ramAllocation);
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleSkip = async () => {
    setIsCompleting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('skip_onboarding');
      toast('Configuración omitida', { icon: '⏭️' });
      await sleep(800);
      onComplete();
    } catch (error) {
      console.error(error);
      setIsCompleting(false);
    }
  };

  const completeOnboarding = async (finalRam: number) => {
    setIsCompleting(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('complete_onboarding', { ramAllocation: finalRam });
      toast('¡Todo listo!', { icon: '✨' });
      await sleep(1500);
      onComplete();
    } catch (error) {
      console.error(error);
      setIsCompleting(false);
    }
  };

  const StepComponent = currentStep.component;

  return (
    <div className="relative h-full w-full bg-background text-white overflow-hidden flex flex-col items-center justify-center selection:bg-primary/20">

      {/* Header / Stepper */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-center z-20">
        <div className="flex gap-2">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center gap-2">
                <motion.div
                  initial={false}
                  animate={{
                    width: isActive ? 32 : 8,
                    backgroundColor: isActive || isCompleted ? "#ffffff" : "oklch(0.269 0 0)"
                  }}
                  className="h-1.5 rounded-full"
                />
              </div>
            );
          })}
        </div>

        {/* Skip Button */}
        {!isCompleting && currentStepIndex < steps.length - 1 && (
          <button
            onClick={handleSkip}
            className="text-xs font-medium text-muted-foreground hover:text-white transition-colors uppercase tracking-widest"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-2xl px-6 relative z-10">
        {isCompleting ? (
          <FinishingView />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <StepComponent
                onNext={handleNext}
                onSkip={handleSkip}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-8 text-muted-foreground text-xs font-medium tracking-wide">
        PASO {currentStepIndex + 1} DE {steps.length}
      </div>

    </div>
  );
};
