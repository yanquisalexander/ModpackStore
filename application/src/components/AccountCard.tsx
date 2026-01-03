import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { LucideTrash2, LucideUser, LucideGamepad2 } from "lucide-react";
import { useState } from "react";
import { MicrosoftIcon } from "@/icons/MicrosoftIcon";
import { cn } from "@/lib/utils";

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

// UUID conocido que tiene la skin de Steve por defecto
const STEVE_UUID = "8667ba71b85a4004af94457a5a5489f1";

export const AccountCard = ({ account, onRemove }: { account: TauriCommandReturns['get_all_accounts'][0], onRemove: (uuid: string) => void }) => {
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    // URL principal usando el UUID de la cuenta
    const headUrl = `https://crafatar.com/renders/head/${account.uuid}?overlay=true&scale=8`;
    // URL de fallback usando el UUID de Steve
    const fallbackHeadUrl = `https://crafatar.com/renders/head/${STEVE_UUID}?overlay=true&scale=8`;

    const isLocalAccount = account.user_type.toLowerCase() === "offline";

    const handleConfirmDelete = () => {
        onRemove(account.uuid);
        setShowDeleteAlert(false);
    };

    return (
        <>
            <div className="group relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#121212] transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1">

                {/* --- FONDO ESTÁTICO CON EFECTOS --- */}
                <div className="absolute inset-0 overflow-hidden">
                    {/* Gradiente para oscurecer la parte inferior y que el texto se lea bien */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent z-10" />

                    {/* Imagen de fondo estática */}
                    <img
                        src="/images/account-bg.webp"
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover opacity-20 transition-all duration-500 group-hover:opacity-30 group-hover:scale-105 blur-sm"
                        alt="Background"
                    />
                </div>

                {/* --- CONTENIDO --- */}
                <div className="relative z-20 flex h-full flex-col items-center justify-center p-6">

                    {/* Avatar 3D Flotante */}
                    <div className="relative mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        {/* Glow detrás de la cabeza */}
                        <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-75" />

                        <img
                            src={headUrl}
                            draggable={false}
                            alt={account.username}
                            className="relative h-24 w-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                            onError={(e) => {
                                // Evitar bucle infinito si el fallback también falla
                                e.currentTarget.onerror = null;
                                // Usar la cabeza de Steve si falla la principal
                                e.currentTarget.src = fallbackHeadUrl;
                            }}
                        />
                    </div>

                    {/* Información del Usuario */}
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-bold text-white tracking-tight truncate max-w-[180px]">
                            {account.username}
                        </h3>

                        {/* Badge de Tipo de Cuenta */}
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                            isLocalAccount
                                ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                            {isLocalAccount ? <LucideGamepad2 size={12} /> : <MicrosoftIcon className="w-3 h-3" />}
                            {isLocalAccount ? "Offline" : "Microsoft"}
                        </div>
                    </div>

                    {/* --- ACCIONES (Hover) --- */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={() => setShowDeleteAlert(true)}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                            title="Eliminar cuenta"
                        >
                            <LucideTrash2 size={16} />
                        </button>
                    </div>

                    {/* Decoración inferior */}
                    <div className="absolute bottom-6 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <span className="text-xs font-medium text-neutral-400 flex items-center gap-2">
                            <LucideUser size={12} />
                            <span>Disponible</span>
                        </span>
                    </div>

                </div>
            </div>

            {/* --- ALERT DIALOG --- */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="bg-[#0a0a0a] border-white/10 text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desvincular cuenta?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-400">
                            Estás a punto de eliminar a <span className="text-white font-medium">{account.username}</span> de la lista.
                            Tendrás que iniciar sesión nuevamente para usarla.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white border-0"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};