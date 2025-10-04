import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface SessionExpiredDialogProps {
  isOpen: boolean;
  onLogin: () => void;
}

export const SessionExpiredDialog: React.FC<SessionExpiredDialogProps> = ({ isOpen, onLogin }) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-md max-w-[90vw] flex flex-col p-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="w-full bg-gradient-to-br from-orange-500 to-red-600 p-8 flex items-center justify-center">
          <AlertTriangle className="w-16 h-16 text-white" />
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <h2 className="text-2xl font-bold text-center">Sesión Expirada</h2>
          <p className="text-center text-muted-foreground">
            Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente para continuar usando la aplicación.
          </p>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <Button 
            onClick={onLogin}
            className="w-full"
          >
            Iniciar Sesión
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
