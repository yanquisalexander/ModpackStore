import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface SessionExpiredDialogProps {
  isOpen: boolean;
  onLogin: () => void;
}

export const SessionExpiredDialog: React.FC<SessionExpiredDialogProps> = ({ isOpen, onLogin }) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-md max-w-[90vw] bg-[#0e0e10] border-white/[0.06] p-0 gap-0 rounded-2xl overflow-hidden">
        <div className="p-6 pb-4 border-b border-white/[0.04]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-400" />
              Sesión Expirada
            </DialogTitle>
            <DialogDescription className="text-sm text-neutral-500">
              Tu sesión ha expirado por seguridad
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Por favor, inicia sesión nuevamente para continuar usando la aplicación.
          </p>
        </div>

        <div className="p-6 pt-2 bg-[#0e0e10] border-t border-white/[0.04] flex justify-end">
          <Button
            onClick={onLogin}
            className="bg-white text-black hover:bg-white/90 font-semibold min-w-[120px] text-sm"
          >
            Iniciar Sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
