import React from 'react';
import { Button } from '@/components/ui/button';
import { LucideArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStepWrapperProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  onNext: () => void;
  onSkip?: () => void;
  nextButtonText?: string;
  skipButtonText?: string;
  nextDisabled?: boolean;
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
    <div className="flex flex-col h-full justify-center max-w-2xl mx-auto px-8">

      {/* Header Section */}
      <div className="mb-10">
        {headerIcon && (
          <div className="w-16 h-16 bg-muted/30 rounded-xl flex items-center justify-center mb-6 border border-border">
            {headerIcon}
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          {title}
        </h1>

        {description && (
          <div className="text-muted-foreground text-base leading-relaxed">
            {description}
          </div>
        )}
      </div>

      {/* Content Section (Flexible) */}
      <div className="space-y-6 mb-8">
        {children}
      </div>

      {/* Footer / Actions */}
      <div className="mt-4 flex flex-col gap-3">
        <Button
          onClick={onNext}
          disabled={nextDisabled}
          className={cn(
            "w-full h-12 text-sm font-medium rounded-lg transition-all",
            nextDisabled
              ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {nextButtonText}
          {!nextDisabled && <LucideArrowRight className="ml-2 h-4 w-4" />}
        </Button>

        {onSkip && (
          <button
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-white transition-colors py-2 text-center"
          >
            {skipButtonText}
          </button>
        )}
      </div>

    </div>
  );
};
