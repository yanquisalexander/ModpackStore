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

// --- Welcome Step (Minimalista) ---
const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto">
      {/* Icono Hero */}
      <div className="mb-8 relative group">
        <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-80 transition-opacity duration-700" />
        <div className="relative w-20 h-20 bg-[#111] rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
          <LucideLayers className="h-10 w-10 text-white" />
        </div>
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
        Bienvenido a Modpack Store
      </h1>

      <p className="text-neutral-400 text-lg leading-relaxed mb-10">
        Vamos a preparar tu entorno de juego en unos segundos. Optimizaremos Java y la memoria para que solo te preocupes de jugar.
      </p>

      {/* Feature Pills */}
      <div className="flex gap-3 mb-12 flex-wrap justify-center">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-sm text-neutral-300">
          <LucideCpu size={14} /> Java Check
        </span>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-sm text-neutral-300">
          <LucideZap size={14} /> RAM Boost
        </span>
      </div>

      <Button
        onClick={() => onNext()}
        size="lg"
        className="h-12 px-8 text-base bg-white text-black hover:bg-white/90 hover:scale-105 transition-all duration-300 rounded-full font-medium shadow-[0_0_20px_rgba(255,255,255,0.2)]"
      >
        Empezar Configuración
      </Button>
    </div>
  );
};

// --- Loading Component ---
const FinishingView = () => (
  <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
    <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin mb-6" />
    <h3 className="text-2xl font-bold text-white mb-2">Finalizando...</h3>
    <p className="text-neutral-500">Aplicando tu configuración óptima.</p>
  </div>
);

// --- Componente Principal ---

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
    <div className="relative min-h-dvh w-full bg-[#050505] text-white overflow-hidden flex flex-col items-center justify-center selection:bg-white/20">

      {/* Background Gradients (Subtle) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-blue-900/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-purple-900/5 blur-[150px] rounded-full" />
      </div>

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
                    backgroundColor: isActive || isCompleted ? "#ffffff" : "#333333"
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
            className="text-xs font-medium text-neutral-500 hover:text-white transition-colors uppercase tracking-widest"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-4xl px-6 relative z-10">
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
      <div className="absolute bottom-8 text-neutral-600 text-xs font-medium tracking-wide">
        PASO {currentStepIndex + 1} DE {steps.length}
      </div>

    </div>
  );
};