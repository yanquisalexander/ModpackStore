import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { OnboardingStatus } from '@/types/onboarding';

export const useOnboarding = () => {
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkOnboardingStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await invoke<OnboardingStatus>('get_onboarding_status');
      setOnboardingStatus(status);
    } catch (err) {
      console.error('Error checking onboarding status:', err);
      setError(err as string);
    } finally {
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