import React, { useState } from 'react';
import { OnboardingStepProps } from '@/types/onboarding';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LucideUser, LucideArrowRight, LucideCheck, LucideGamepad2, LucideLoader2, LucideInfo } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TauriCommandReturns } from '@/types/TauriCommandReturns';
import { cn } from '@/lib/utils';

export const AccountCreationStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (!username.trim()) return;

    setIsLoading(true);
    try {
      await invoke<TauriCommandReturns['add_offline_account']>('add_offline_account', {
        username: username.trim()
      });

      toast.success(`Bienvenido, ${username}`);

      // Pequeño delay para la transición
      setTimeout(() => {
        onNext();
      }, 500);

    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Error al crear el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Regex estricto para nicks de Minecraft (Alfanumérico + guion bajo)
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
    setUsername(value);
  };

  const isValid = username.trim().length >= 3;

  return (
    <div className="flex flex-col h-full justify-center max-w-xl mx-auto px-8 relative">

      {/* Header */}
      <div className="mb-10">
        <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
          <LucideUser className="h-8 w-8 text-neutral-300" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
          Crea tu Perfil
        </h1>

        <p className="text-neutral-400 text-lg leading-relaxed">
          Para terminar, elige un nombre de jugador. Esta será una cuenta local para empezar a jugar inmediatamente.
        </p>
      </div>

      {/* Form Area */}
      <div className="space-y-8">

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <LucideGamepad2 className={cn("h-5 w-5 transition-colors", isValid ? "text-white" : "text-neutral-500")} />
          </div>

          <Input
            type="text"
            value={username}
            onChange={handleChange}
            placeholder="Nombre de usuario"
            className="h-16 pl-12 text-lg bg-white/5 border-white/10 focus:border-white/30 rounded-xl transition-all placeholder:text-neutral-600"
            maxLength={16}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && isValid && handleCreateAccount()}
          />

          {/* Validation Indicator */}
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            {isValid && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-green-500/20 p-1 rounded-full"
              >
                <LucideCheck className="h-4 w-4 text-green-500" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex gap-4 items-start">
          <LucideInfo className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-medium text-white">Nota sobre cuentas</h4>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Esta es una cuenta <strong>Offline</strong>. Podrás añadir tu cuenta premium de Microsoft más tarde desde el menú de configuración si lo deseas.
            </p>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className="mt-10">
        <Button
          onClick={handleCreateAccount}
          disabled={!isValid || isLoading}
          className={cn(
            "w-full h-14 text-base font-medium rounded-xl transition-all shadow-lg",
            (!isValid || isLoading)
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
              : "bg-white text-black hover:bg-neutral-200 shadow-white/5"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LucideLoader2 className="animate-spin h-5 w-5" /> Creando perfil...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Crear y Finalizar <LucideArrowRight className="ml-2 h-5 w-5" />
            </span>
          )}
        </Button>
      </div>

    </div>
  );
};