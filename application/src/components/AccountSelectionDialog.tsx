import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LucideUser, LucideSettings, LucideGamepad2 } from 'lucide-react';
import { TauriCommandReturns } from '@/types/TauriCommandReturns';
import { toast } from 'sonner';

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
  const [selecting, setSelecting] = useState(false);
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const fetchedAccounts = await invoke<TauriCommandReturns['get_all_accounts']>('get_all_accounts');
      setAccounts(fetchedAccounts);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Error al cargar cuentas', {
        description: 'No se pudieron cargar las cuentas disponibles.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  const handleAccountSelect = async (accountUuid: string) => {
    try {
      setSelecting(true);
      
      // Get current instance data
      const currentInstance = await invoke('get_instance_by_id', { instanceId });
      
      // Update the instance with the selected account
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
      toast.error('Error al seleccionar cuenta', {
        description: 'No se pudo asignar la cuenta a la instancia.'
      });
    } finally {
      setSelecting(false);
    }
  };

  const handleManageAccounts = () => {
    onOpenChange(false);
    navigate('/mc-accounts');
  };

  const getHeadUrl = (uuid: string) => {
    return `https://crafatar.com/renders/head/${uuid}?overlay=true&scale=4`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LucideGamepad2 className="h-5 w-5 text-emerald-500" />
            Seleccionar cuenta
          </DialogTitle>
          <DialogDescription>
            Selecciona una cuenta para jugar o gestiona tus cuentas existentes.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-6 w-6 border-2 border-emerald-500 rounded-full border-t-transparent"></div>
                <p className="text-sm text-neutral-400">Cargando cuentas...</p>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <LucideUser className="h-12 w-12 text-neutral-600 mb-3" />
              <h3 className="text-lg font-medium text-neutral-50 mb-2">No hay cuentas</h3>
              <p className="text-sm text-neutral-400 mb-4">
                No tienes cuentas configuradas. Añade una cuenta para empezar a jugar.
              </p>
              <Button onClick={handleManageAccounts} className="bg-emerald-600 hover:bg-emerald-700">
                <LucideSettings className="h-4 w-4 mr-2" />
                Gestionar cuentas
              </Button>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {accounts.map((account) => {
                const isLocalAccount = account.user_type.toLowerCase() === "offline";
                
                return (
                  <div
                    key={account.uuid}
                    className="flex items-center gap-3 p-3 rounded-lg border border-neutral-700 hover:border-emerald-500/50 hover:bg-neutral-800/50 transition cursor-pointer"
                    onClick={() => handleAccountSelect(account.uuid)}
                  >
                    <div className="w-10 h-10 relative">
                      <img
                        src={getHeadUrl(account.uuid)}
                        alt={account.username}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = `https://crafatar.com/renders/head/00000000-0000-0000-0000-000000000000?overlay=true&scale=4`;
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{account.username}</h4>
                      <p className="text-xs text-neutral-400">
                        {isLocalAccount ? "Cuenta offline" : "Cuenta Microsoft"}
                      </p>
                    </div>
                    <div className="text-neutral-500">
                      <LucideUser className="h-4 w-4" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {accounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-700">
              <Button 
                variant="outline" 
                onClick={handleManageAccounts}
                className="w-full border-neutral-600 hover:border-emerald-500 hover:bg-emerald-500/10"
                disabled={selecting}
              >
                <LucideSettings className="h-4 w-4 mr-2" />
                Gestionar cuentas
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};