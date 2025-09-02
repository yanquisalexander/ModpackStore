export interface OnboardingStatus {
  first_run_at: string | null;
  ram_allocation: number | null;
}

export interface SystemMemoryInfo {
  total_mb: number;
  recommended_mb: number;
  min_mb: number;
  max_mb: number;
}

export interface OnboardingStep {
  id: string;
  title: string;
  component: React.ComponentType<OnboardingStepProps>;
}

export interface OnboardingStepProps {
  onNext: (data?: any) => void;
  onSkip?: () => void;
  data?: any;
}