import React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EulaDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAccept: () => void;
}

export const EulaDialog: React.FC<EulaDialogProps> = ({ isOpen, onClose, onAccept }) => {
    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="bg-[#121212] border-white/5 text-white max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Aceptar EULA de Minecraft</AlertDialogTitle>
                    <AlertDialogDescription className="text-neutral-400">
                        Para ejecutar un servidor de Minecraft, debes aceptar el Acuerdo de Licencia de Usuario Final (EULA) de Mojang.
                        <br /><br />
                        Al hacer clic en "Aceptar", declaras que has leído y aceptas los términos en{" "}
                        <a
                            href="https://aka.ms/MinecraftEULA"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:underline"
                        >
                            https://aka.ms/MinecraftEULA
                        </a>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        onClick={onClose}
                        className="bg-transparent border-white/10 hover:bg-white/5 text-white"
                    >
                        Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onAccept}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        Aceptar y Continuar
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
