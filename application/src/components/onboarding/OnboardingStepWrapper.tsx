import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStepWrapperProps {
  title: string;
  description?: React.ReactNode; // ReactNode permite pasar JSX o strings
  children: React.ReactNode;
  onNext: () => void;
  onSkip?: () => void;
  nextButtonText?: string;
  skipButtonText?: string;
  nextDisabled?: boolean;
  // Opcional: Para permitir un icono o elemento extra en la cabecera
  headerIcon?: React.ReactNode;
}

export const OnboardingStepWrapper: React.FC<OnboardingStepWrapperProps> = ({
  title,
  description,
  children,
  onNext,
  onSkip,
  nextButtonText = "Continuar",
  skipButtonText = "Omitir",
  nextDisabled = false,
  headerIcon,
}) => {
  return (
    // Usamos h-full en lugar de min-h-screen para evitar el scroll innecesario dentro del layout principal
    <div className="flex flex-col h-full justify-center max-w-xl mx-auto px-8 relative">

      {/* Header Section */}
      <div className="mb-10">
        {headerIcon && (
          <div className="mb-6">
            {headerIcon}
          </div>
        )}

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          {title}
        </h1>

        {description && (
          <div className="text-neutral-400 text-lg leading-relaxed">
            {description}
          </div>
        )}
      </div>

      {/* Content Section (Flexible) */}
      <div className="space-y-8 mb-8">
        {children}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 flex flex-col gap-3">
        <Button
          onClick={onNext}
          disabled={nextDisabled}
          className={cn(
            "w-full h-14 text-base font-medium rounded-xl transition-all shadow-lg",
            nextDisabled
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              : "bg-white text-black hover:bg-neutral-200 shadow-white/5"
          )}
        >
          {nextButtonText}
          {!nextDisabled && <LucideArrowRight className="ml-2 h-5 w-5" />}
        </Button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors py-2 text-center"
          >
            {skipButtonText}
          </button>
        )}
      </div>

    </div>
  );
};