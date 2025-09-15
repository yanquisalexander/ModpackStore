import React, { useState } from 'react';
import { OnboardingStepProps } from '@/types/onboarding';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideUser, LucideUserPlus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { TauriCommandReturns } from '@/types/TauriCommandReturns';

export const AccountCreationStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAccount = async () => {
    if (!username.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      await invoke<TauriCommandReturns['add_offline_account']>('add_offline_account', { 
        username: username.trim() 
      });

      toast.success('¡Cuenta creada!', {
        description: `Se ha creado la cuenta ${username} correctamente`,
      });

      // Continue to next step
      onNext();
    } catch (error) {
      console.error('Error creating account:', error);
      toast.error('Error al crear la cuenta', {
        description: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isUsernameValid = username.trim().length > 0;

  return (
    <div className="mx-auto p-6 min-h-screen flex items-center">
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.45 }} 
        className="grid md:grid-cols-3 gap-6 w-full"
      >
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white">
                <LucideUserPlus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Primera Cuenta</h2>
                <p className="text-sm text-muted-foreground">Configurar jugador</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h1 className="text-2xl font-bold mb-2">Vamos a añadir tu primera cuenta</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Para empezar, vamos a añadir tu primera cuenta offline para que puedas jugar.
              </p>

              <motion.div 
                className="space-y-4" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 0.12 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="player-name" className="text-sm font-medium">
                    Nombre de jugador
                  </Label>
                  <div className="relative">
                    <LucideUser className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="player-name"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        // Prevent spacing and special characters, similar to AddAccountDialog
                        const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                        setUsername(value);
                      }}
                      placeholder="Ingresa tu nombre de jugador"
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solo se permiten letras, números y guiones bajos.
                  </p>
                </div>

                <motion.div 
                  className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 mt-6"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    ¿Qué puedes hacer después?
                  </h3>
                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Gestionar tus cuentas desde la sección "Cuentas"</li>
                    <li>• Eliminar esta cuenta si lo deseas</li>
                    <li>• Añadir una cuenta Microsoft (premium)</li>
                    <li>• Añadir más cuentas offline</li>
                  </ul>
                </motion.div>
              </motion.div>

              <div className="flex justify-end mt-6">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    onClick={handleCreateAccount}
                    disabled={!isUsernameValid || isLoading}
                    className="cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creando cuenta...' : 'Crear cuenta y continuar'}
                  </Button>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};