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
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
    setUsername(value);
  };

  const isValid = username.trim().length >= 3;

  return (
    <div className="flex flex-col h-full justify-center max-w-2xl mx-auto px-8">

      {/* Header */}
      <div className="mb-8">
        <div className="w-14 h-14 bg-muted/30 rounded-xl flex items-center justify-center mb-5 border border-border">
          <LucideUser className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Crea tu Perfil</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Elige un nombre de jugador. Esta será una cuenta local para empezar a jugar inmediatamente.
        </p>
      </div>

      {/* Form Area */}
      <div className="space-y-5">

        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <LucideGamepad2 className={cn("h-5 w-5 transition-colors", isValid ? "text-white" : "text-muted-foreground")} />
          </div>

          <Input
            type="text"
            value={username}
            onChange={handleChange}
            placeholder="Nombre de usuario"
            className="h-12 pl-12 text-sm bg-muted/30 border-border focus:border-primary/50 rounded-lg transition-all placeholder:text-muted-foreground"
            maxLength={16}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && isValid && handleCreateAccount()}
          />

          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            {isValid && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="bg-emerald-500/10 p-1 rounded-full"
              >
                <LucideCheck className="h-4 w-4 text-emerald-400" />
              </motion.div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-lg border border-border bg-muted/20 flex gap-3 items-start">
          <LucideInfo className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Esta es una cuenta <strong className="text-white">Offline</strong>. Podrás añadir tu cuenta premium de Microsoft más tarde.
          </p>
        </div>

      </div>

      {/* Action Button */}
      <div className="mt-8">
        <Button
          onClick={handleCreateAccount}
          disabled={!isValid || isLoading}
          className={cn(
            "w-full h-12 text-sm font-medium rounded-lg transition-all",
            (!isValid || isLoading)
              ? "bg-muted/30 text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LucideLoader2 className="animate-spin h-4 w-4" /> Creando perfil...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Crear y Finalizar <LucideArrowRight className="ml-2 h-4 w-4" />
            </span>
          )}
        </Button>
      </div>

    </div>
  );
};
