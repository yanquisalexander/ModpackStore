import React from 'react';
import { OnboardingStepProps } from '@/types/onboarding';

interface OnboardingStepWrapperProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext: () => void;
  onSkip?: () => void;
  nextButtonText?: string;
  skipButtonText?: string;
  nextDisabled?: boolean;
}

export const OnboardingStepWrapper: React.FC<OnboardingStepWrapperProps> = ({
  title,
  description,
  children,
  onNext,
  onSkip,
  nextButtonText = "Siguiente",
  skipButtonText = "Omitir",
  nextDisabled = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 text-white p-8">
      <div className="max-w-2xl w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          {description && (
            <p className="text-xl text-gray-300">{description}</p>
          )}
        </div>
        
        <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/10">
          {children}
        </div>
        
        <div className="flex justify-between items-center mt-8">
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-6 py-3 text-gray-300 hover:text-white transition-colors"
            >
              {skipButtonText}
            </button>
          )}
          
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="ml-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {nextButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};