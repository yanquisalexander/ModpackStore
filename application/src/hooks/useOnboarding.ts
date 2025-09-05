import { useState, useEffect } from 'react';
import { OnboardingStatus } from '@/types/onboarding';

export const useOnboarding = () => {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkOnboardingStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to use real Tauri invoke first
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<OnboardingStatus>('get_onboarding_status');
      setOnboardingStatus(status);
    } catch (err) {
      console.error('Error checking onboarding status:', err);
      setError(err as string);

      // Fallback for development/demo mode or offline mode - assume not first run
      setOnboardingStatus({
        first_run_at: new Date().toISOString(),
        ram_allocation: 4096,
      });
    } finally {
      // Ensure loading is always set to false
      setLoading(false);
    }
  };

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const refreshStatus = () => {
    checkOnboardingStatus();
  };

  const isFirstRun = onboardingStatus?.first_run_at === null;

  return {
    onboardingStatus,
    loading,
    error,
    isFirstRun,
    refreshStatus,
  };
};