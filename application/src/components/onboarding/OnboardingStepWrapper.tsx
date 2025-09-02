import React from 'react';
import { OnboardingStepProps } from '@/types/onboarding';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
    <div className="max-w-4xl mx-auto pb-6 min-h-screen flex items-center">
      <div className="grid md:grid-cols-3 gap-6 w-full">
        {/* Left panel: info card */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-2">{title}</h2>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right panel: step content */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              {children}

              <div className="flex justify-between items-center mt-6">
                {onSkip ? (
                  <Button variant="ghost" onClick={onSkip}>
                    {skipButtonText}
                  </Button>
                ) : <div />}

                <Button onClick={onNext} disabled={nextDisabled}>
                  {nextButtonText}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};