import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface ModpackPasswordDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modpackId: string;
    modpackName?: string;
}

export const ModpackPasswordDialog: React.FC<ModpackPasswordDialogProps> = ({
    isOpen,
    onClose,
    onSuccess,
    modpackId,
    modpackName
}) => {
    const [password, setPassword] = useState('');
    const [validating, setValidating] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!password.trim()) {
            toast.error('Por favor ingresa la contraseña');
            return;
        }

        setValidating(true);

        try {
            const isValid = await invoke<boolean>('validate_modpack_password', {
                modpackId,
                password: password.trim()
            });

            if (isValid) {
                toast.success('Contraseña correcta');
                onSuccess();
                handleClose();
            } else {
                toast.error('Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Error validating password:', error);
            toast.error('Error al validar la contraseña');
        } finally {
            setValidating(false);
        }
    };

    const handleClose = () => {
        setPassword('');
        setValidating(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Contraseña requerida</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {modpackName ? `El modpack "${modpackName}"` : 'Este modpack'} requiere una contraseña para continuar.
                    </p>
                </DialogHeader>
                
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingresa la contraseña"
                                disabled={validating}
                                autoFocus
                            />
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={handleClose}
                            disabled={validating}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={validating || !password.trim()}
                        >
                            {validating ? 'Validando...' : 'Continuar'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};