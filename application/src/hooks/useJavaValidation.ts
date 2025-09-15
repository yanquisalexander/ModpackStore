import { useState, useEffect, useCallback, useRef } from 'react';
import { JavaValidationResult } from '@/types/onboarding';

export const useJavaValidation = () => {
  const [javaValidation, setJavaValidation] = useState<JavaValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [repairStatus, setRepairStatus] = useState<string | null>(null);
  const isValidatingRef = useRef(false);

  const validateJava = useCallback(async () => {
    // Prevent multiple simultaneous validations
    if (isValidatingRef.current) return;
    
    isValidatingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<JavaValidationResult>('validate_java_installation');
      setJavaValidation(result);
    } catch (err) {
      console.error('Error validating Java:', err);
      setError(err as string);
      setJavaValidation({ is_installed: false });
    } finally {
      setLoading(false);
      isValidatingRef.current = false;
    }
  }, []);

  const installJava = useCallback(async () => {
    setIsInstalling(true);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_java');
      // Re-validate after installation
      await validateJava();
    } catch (err) {
      console.error('Error installing Java:', err);
      setError(err as string);
    } finally {
      setIsInstalling(false);
    }
  }, [validateJava]);

  const repairJava = useCallback(async () => {
    setIsInstalling(true);
    setError(null);
    setRepairStatus('Buscando Java en el sistema...');

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Use the new repair command that includes local scanning
      await invoke('repair_java_installation');
      
      setRepairStatus('Reparación completada');
      
      // Re-validate after repair
      await validateJava();
    } catch (err) {
      console.error('Error repairing Java:', err);
      setError(err as string);
      setRepairStatus(null);
    } finally {
      setIsInstalling(false);
      // Clear status after a brief delay
      setTimeout(() => setRepairStatus(null), 2000);
    }
  }, [validateJava]);

  // Validate Java on hook initialization (lightweight check)
  useEffect(() => {
    validateJava();
  }, [validateJava]);

  return {
    javaValidation,
    loading,
    error,
    isInstalling,
    repairStatus,
    validateJava,
    installJava,
    repairJava,
  };
};