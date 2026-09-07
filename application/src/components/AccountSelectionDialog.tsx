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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LucideUser, LucideSettings, LucideGamepad2, LucideLoader2, LucideWifiOff } from 'lucide-react';
import { TauriCommandReturns } from '@/types/TauriCommandReturns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { MicrosoftIcon } from '@/icons/MicrosoftIcon';
import { cn } from '@/lib/utils';

interface AccountSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountSelected: (data: { accountUuid: string | null; useModpackStoreAuth: boolean; ms_nickname: string | null }) => void;
  instanceId?: string;
}

const STEVE_UUID = "8667ba71b85a4004af94457a5a5489f1";

export const AccountSelectionDialog: React.FC<AccountSelectionDialogProps> = ({
  open,
  onOpenChange,
  onAccountSelected,
  instanceId
}) => {
  const [accounts, setAccounts] = useState<TauriCommandReturns['get_all_accounts']>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});
  const [useModpackStoreAuth, setUseModpackStoreAuth] = useState(false);
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
      const loadDialogData = async () => {
        await fetchAccounts();
        setSelectingId(null);
        setAvatarErrors({});

        if (!instanceId) {
          setUseModpackStoreAuth(false);
          return;
        }

        try {
          const currentInstance = await invoke<TauriCommandReturns['get_instance_by_id']>('get_instance_by_id', { instanceId });
          setUseModpackStoreAuth(currentInstance?.useModpackStoreAuth ?? false);
        } catch (error) {
          console.error('Error loading instance auth mode:', error);
          setUseModpackStoreAuth(false);
        }
      };

      loadDialogData();
    }
  }, [open]);

  const handleAccountSelect = async (accountUuid: string) => {
    try {
      setSelectingId(accountUuid);

      const currentInstance = await invoke('get_instance_by_id', { instanceId });

      await invoke('update_instance', {
        instance: {
          ...currentInstance,
          accountUuid: accountUuid,
          useModpackStoreAuth: useModpackStoreAuth,
        }
      });

      onAccountSelected({
        accountUuid,
        useModpackStoreAuth,
        ms_nickname: null,
      });
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
      <DialogContent className="sm:max-w-md bg-[#0e0e10] border-white/[0.06] p-0 gap-0">

        <div className="p-6 pb-4 border-b border-white/[0.04]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <LucideGamepad2 className="h-5 w-5 text-teal-400" />
              Seleccionar Jugador
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500">
              Elige con qué perfil quieres lanzar esta instancia.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-3">
          <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-4 py-3">
            <div className="space-y-0.5">
              <Label className="text-sm text-white cursor-pointer">Usar servicios de autenticación de Modpack Store</Label>
              <p className="text-xs text-neutral-500">
                {useModpackStoreAuth
                  ? "Se usará el nombre de la cuenta seleccionada para autenticarte"
                  : "Se usará la cuenta local directamente"}
              </p>
            </div>
            <Switch
              checked={useModpackStoreAuth}
              onCheckedChange={(checked) => {
                setUseModpackStoreAuth(checked);
                setSelectingId(null);
              }}
            />
          </div>
        </div>

        <div className="p-4 min-h-[200px] max-h-[min(60vh,400px)] overflow-y-auto custom-scrollbar flex flex-col">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-3 text-neutral-500 py-8"
              >
                <LucideLoader2 className="h-6 w-6 animate-spin text-teal-500" />
                <p className="text-sm font-medium">Cargando perfiles...</p>
              </motion.div>
            ) : accounts.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-4 space-y-4 py-8"
              >
                <div className="p-3 rounded-full bg-white/[0.04] border border-white/[0.06]">
                  <LucideUser className="h-6 w-6 text-neutral-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Sin cuentas</h3>
                  <p className="text-sm text-neutral-500 max-w-[200px] mx-auto mt-1">
                    Necesitas añadir al menos una cuenta para jugar.
                  </p>
                </div>
                <Button onClick={handleManageAccounts} className="bg-white text-black hover:bg-white/90 text-sm font-semibold">
                  <LucideSettings className="h-4 w-4 mr-2" />
                  Configurar Cuentas
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-1.5">
                {accounts.map((account, index) => {
                  const isLocal = account.user_type.toLowerCase() === "offline";
                  const isSelecting = selectingId === account.uuid;
                  const avatarFailed = avatarErrors[account.uuid];
                  const headUrl = `https://crafatar.com/renders/head/${account.uuid}?overlay=true&scale=4`;
                  const fallbackUrl = `/images/head_fallback.webp`;

                  return (
                    <motion.button
                      key={account.uuid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => !selectingId && handleAccountSelect(account.uuid)}
                      disabled={!!selectingId}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                        isSelecting
                          ? "bg-white/[0.06] border-white/20"
                          : "border-white/[0.04] hover:bg-white/[0.04] hover:border-white/10"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-black/20 ring-1 ring-white/[0.06]">
                          <img
                            src={avatarFailed ? fallbackUrl : headUrl}
                            alt={account.username}
                            className="w-full h-full object-contain"
                            onError={() => setAvatarErrors(prev => ({ ...prev, [account.uuid]: true }))}
                          />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-[#0e0e10] rounded-full p-0.5">
                          {isLocal ? (
                            <div className="bg-neutral-500/20 text-neutral-400 p-0.5 rounded-full">
                              <LucideWifiOff className="w-2.5 h-2.5" />
                            </div>
                          ) : (
                            <div className="bg-blue-500/20 text-blue-400 p-0.5 rounded-full">
                              <MicrosoftIcon className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className={cn(
                          "font-semibold text-sm truncate",
                          isSelecting ? "text-white" : "text-neutral-300"
                        )}>
                          {account.username}
                        </h4>
                        <p className="text-xs text-neutral-600 truncate">
                          {isLocal ? "Cuenta Offline" : "Cuenta Microsoft"}
                        </p>
                      </div>

                      {isSelecting && (
                        <LucideLoader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </div>

        {accounts.length > 0 && (
          <div className="px-6 py-3 border-t border-white/[0.04] flex justify-between items-center">
            <span className="text-xs text-neutral-600">
              {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
            </span>
            <button
              onClick={handleManageAccounts}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
            >
              <LucideSettings className="h-3.5 w-3.5" />
              Gestionar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
