import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LucideUser, LucideSettings, LucideGamepad2, LucideLoader2, LucideWifiOff, LucideCheckCircle2 } from 'lucide-react';
import { TauriCommandReturns } from '@/types/TauriCommandReturns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { MicrosoftIcon } from '@/icons/MicrosoftIcon';
import { cn } from '@/lib/utils';

interface AccountSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountSelected: (accountUuid: string) => void;
  instanceId?: string;
}

export const AccountSelectionDialog: React.FC<AccountSelectionDialogProps> = ({
  open,
  onOpenChange,
  onAccountSelected,
  instanceId
}) => {
  const [accounts, setAccounts] = useState<TauriCommandReturns['get_all_accounts']>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const fetchedAccounts = await invoke<TauriCommandReturns['get_all_accounts']>('get_all_accounts');
      setAccounts(fetchedAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Error al cargar cuentas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAccounts();
      setSelectingId(null);
    }
  }, [open]);

  const handleAccountSelect = async (accountUuid: string) => {
    try {
      setSelectingId(accountUuid);

      // Obtener datos actuales de la instancia
      const currentInstance = await invoke('get_instance_by_id', { instanceId });

      // Actualizar la instancia con la cuenta seleccionada
      await invoke('update_instance', {
        instance: {
          ...currentInstance,
          accountUuid: accountUuid,
        }
      });

      onAccountSelected(accountUuid);
      onOpenChange(false);
    } catch (error) {
      console.error('Error selecting account:', error);
      toast.error('Error al asignar la cuenta');
      setSelectingId(null);
    }
  };

  const handleManageAccounts = () => {
    onOpenChange(false);
    navigate('/mc-accounts');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0a0a0a] border-white/10 p-0 gap-0 shadow-2xl overflow-hidden">

        {/* HEADER */}
        <div className="p-6 pb-4 border-b border-white/5 bg-gradient-to-b from-emerald-500/[0.05] to-transparent">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-white">
              <LucideGamepad2 className="h-5 w-5 text-emerald-400" />
              Seleccionar Jugador
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Elige con qué perfil quieres lanzar esta instancia.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-4 min-h-[300px] flex flex-col">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500"
              >
                <LucideLoader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-sm font-medium">Cargando perfiles...</p>
              </motion.div>
            ) : accounts.length === 0 ? (
              /* EMPTY STATE */
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-4"
              >
                <div className="p-4 rounded-full bg-neutral-900 border border-white/5">
                  <LucideUser className="h-8 w-8 text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-white">Sin cuentas</h3>
                  <p className="text-sm text-neutral-400 max-w-[200px] mx-auto mt-1">
                    Necesitas añadir al menos una cuenta para jugar.
                  </p>
                </div>
                <Button onClick={handleManageAccounts} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  <LucideSettings className="h-4 w-4 mr-2" />
                  Configurar Cuentas
                </Button>
              </motion.div>
            ) : (
              /* ACCOUNT LIST - Renderizado directo sin variantes complejas en el padre */
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[320px] pr-1">
                {accounts.map((account, index) => {
                  const isLocal = account.user_type.toLowerCase() === "offline";
                  const isSelecting = selectingId === account.uuid;

                  return (
                    <motion.button
                      key={account.uuid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => !selectingId && handleAccountSelect(account.uuid)}
                      disabled={!!selectingId}
                      className={cn(
                        "group relative w-full flex items-center gap-4 p-3 rounded-xl border transition-all duration-200 text-left",
                        isSelecting
                          ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/20"
                          : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-emerald-500/30"
                      )}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-neutral-900 ring-1 ring-white/10 group-hover:ring-emerald-500/40 transition-all shadow-lg">
                          <img
                            src={`https://crafatar.com/renders/head/${account.uuid}?overlay=true&scale=4`}
                            alt={account.username}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = `https://crafatar.com/renders/head/8667ba71b85a4004af94457a5a5489f1?overlay=true&scale=4`;
                            }}
                          />
                        </div>
                        {/* Badge Tipo de Cuenta */}
                        <div className="absolute -bottom-1 -right-1 bg-[#0a0a0a] rounded-full p-0.5 border border-white/10 z-10">
                          {isLocal ? (
                            <div className="bg-yellow-500/20 text-yellow-500 p-0.5 rounded-full">
                              <LucideWifiOff className="w-2.5 h-2.5" />
                            </div>
                          ) : (
                            <div className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full">
                              <MicrosoftIcon className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          "font-bold text-sm truncate transition-colors",
                          isSelecting ? "text-emerald-400" : "text-white group-hover:text-emerald-200"
                        )}>
                          {account.username}
                        </h4>
                        <p className="text-xs text-neutral-500 truncate group-hover:text-neutral-400 transition-colors">
                          {isLocal ? "Cuenta Offline" : "Cuenta Microsoft"}
                        </p>
                      </div>

                      {/* Status Indicator */}
                      <div className={cn(
                        "text-emerald-500 transition-opacity duration-200",
                        isSelecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}>
                        {isSelecting ? <LucideLoader2 className="w-5 h-5 animate-spin" /> : <LucideCheckCircle2 className="w-5 h-5" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* FOOTER */}
        {accounts.length > 0 && (
          <div className="p-4 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
            <span className="text-xs text-neutral-500 pl-2">
              {accounts.length} {accounts.length === 1 ? 'cuenta disponible' : 'cuentas disponibles'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManageAccounts}
              className="text-neutral-400 hover:text-white hover:bg-white/5 h-8 text-xs"
            >
              <LucideSettings className="h-3.5 w-3.5 mr-2" />
              Gestionar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};