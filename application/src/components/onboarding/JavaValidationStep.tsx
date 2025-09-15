import React, { useState, useEffect } from 'react';
import { OnboardingStepProps } from '@/types/onboarding';
import { OnboardingStepWrapper } from './OnboardingStepWrapper';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Download, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface JavaValidationResult {
  is_installed: boolean;
  java_path?: string;
  version?: string;
}

export const JavaValidationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
}) => {
  const [javaValidation, setJavaValidation] = useState<JavaValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [validationComplete, setValidationComplete] = useState(false);

  useEffect(() => {
    validateJavaInstallation();
  }, []);

  const validateJavaInstallation = async () => {
    try {
      setLoading(true);
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<JavaValidationResult>('validate_java_installation');
      setJavaValidation(result);

      if (result.is_installed) {
        // Java found, auto-advance after a brief delay
        setValidationComplete(true);
        setTimeout(() => {
          onNext();
        }, 3500);
      }
    } catch (error) {
      console.error('Error validating Java:', error);
      toast.error('Error al validar la instalación de Java');
      setJavaValidation({ is_installed: false });
    } finally {
      setLoading(false);
    }
  };

  const installJava = async () => {
    try {
      setInstalling(true);
      setInstallProgress(0);

      // Simulate progress during installation
      const progressInterval = setInterval(() => {
        setInstallProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const { invoke } = await import('@tauri-apps/api/core');
      const javaPath = await invoke<string>('install_java');

      clearInterval(progressInterval);
      setInstallProgress(100);

      toast.success('Java instalado correctamente', {
        description: `Instalado en: ${javaPath}`,
      });

      setJavaValidation({
        is_installed: true,
        java_path: javaPath,
        version: '8',
      });

      setValidationComplete(true);

      // Auto-advance after installation complete
      setTimeout(() => {
        onNext();
      }, 2000);

    } catch (error) {
      console.error('Error installing Java:', error);
      toast.error('Error al instalar Java', {
        description: 'No se pudo completar la instalación automática',
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleNext = () => {
    if (javaValidation?.is_installed) {
      onNext();
    } else {
      installJava();
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    }
  };

  if (loading) {
    return (
      <OnboardingStepWrapper
        title="Verificación de Java"
        description="Detectando instalación de Java..."
        onNext={() => { }}
        nextDisabled={true}
      >
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </OnboardingStepWrapper>
    );
  }

  if (validationComplete && javaValidation?.is_installed) {
    return (
      <OnboardingStepWrapper
        title="Java Verificado"
        description="Java está correctamente instalado"
        onNext={() => { }}
        nextDisabled={true}
      >
        <div className="flex flex-col items-center justify-center py-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <CheckCircle className="h-16 w-16 text-green-400" />
          </motion.div>
          <h3 className="text-xl font-semibold text-green-400 mb-2">
            ✓ Java Encontrado
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Java {javaValidation.version} detectado correctamente.
            <br />
            Continuando al siguiente paso...
          </p>
        </div>
      </OnboardingStepWrapper>
    );
  }

  if (installing) {
    return (
      <OnboardingStepWrapper
        title="Instalando Java"
        description="Descargando e instalando Java 8..."
        onNext={() => { }}
        nextDisabled={true}
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center py-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="mb-4"
            >
              <Download className="h-12 w-12 text-blue-400" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-2">
              Descargando Java 8
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esto puede tomar unos minutos según tu conexión...
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progreso de instalación</span>
              <span>{Math.round(installProgress)}%</span>
            </div>
            <Progress value={installProgress} className="w-full" />
          </div>

          <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-4">
            <h4 className="text-blue-300 font-medium mb-2">📦 ¿Qué está pasando?</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Descargando OpenJDK 8 desde repositorios oficiales</li>
              <li>• Extrayendo archivos al directorio de la aplicación</li>
              <li>• Configurando Java para usar con Minecraft</li>
            </ul>
          </div>
        </div>
      </OnboardingStepWrapper>
    );
  }

  return (
    <OnboardingStepWrapper
      title="Verificación de Java"
      description="Java es requerido para ejecutar Minecraft"
      onNext={handleNext}
      onSkip={handleSkip}
      nextButtonText={javaValidation?.is_installed ? "Continuar" : "Instalar Java 8"}
    >
      <div className="space-y-6">
        {javaValidation?.is_installed ? (
          <div className="bg-green-900/20 border border-green-400/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <h3 className="text-lg font-semibold text-green-400">Java Encontrado</h3>
            </div>
            <div className="space-y-2 text-sm">
              {javaValidation.version && (
                <p><span className="text-muted-foreground">Versión:</span> <span className="font-medium">Java {javaValidation.version}</span></p>
              )}
              {javaValidation.java_path && (
                <p><span className="text-muted-foreground">Ubicación:</span> <span className="font-mono text-xs">{javaValidation.java_path}</span></p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-orange-900/20 border border-orange-400/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="h-5 w-5 text-orange-400" />
              <h3 className="text-lg font-semibold text-orange-400">Java No Encontrado</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              No se detectó una instalación válida de Java en tu sistema.
              Es necesario instalar Java 8 o superior para ejecutar Minecraft.
            </p>
          </div>
        )}

        <div className="bg-white/5 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">¿Qué es Java?</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Java es la plataforma de programación que requiere Minecraft para funcionar.
              Minecraft está desarrollado en Java y necesita el Java Runtime Environment (JRE) instalado.
            </p>
            <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-3">
              <h4 className="text-blue-300 font-medium mb-2">🔍 Proceso de Detección</h4>
              <ul className="space-y-1 text-xs">
                <li>1. Verificamos la variable de entorno JAVA_HOME</li>
                <li>2. Buscamos java en el PATH del sistema</li>
                <li>3. Validamos que sea Java 8 o superior</li>
              </ul>
            </div>
          </div>
        </div>

        {!javaValidation?.is_installed && (
          <div className="bg-green-900/20 border border-green-400/30 rounded-lg p-4">
            <h4 className="text-green-300 font-medium mb-2">✨ Instalación Automática</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Se descargará OpenJDK 8 (versión estable y confiable)</li>
              <li>• Instalación silenciosa y automática</li>
              <li>• Se configurará automáticamente para la aplicación</li>
              <li>• No afectará otras instalaciones de Java en tu sistema</li>
            </ul>
          </div>
        )}
      </div>
    </OnboardingStepWrapper>
  );
};