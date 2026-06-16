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

const STEVE_UUID = "8667ba71b85a4004af94457a5a5489f1";

export const AccountCard = ({ account, onRemove }: { account: TauriCommandReturns['get_all_accounts'][0], onRemove: (uuid: string) => void }) => {
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    const headUrl = `https://crafatar.com/renders/head/${account.uuid}?overlay=true&scale=8`;
    const fallbackHeadUrl = `/images/head_fallback.webp`;

    const isLocalAccount = account.user_type.toLowerCase() === "offline";

    const handleConfirmDelete = () => {
        onRemove(account.uuid);
        setShowDeleteAlert(false);
    };

    return (
        <>
            <div className="group relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#121212] transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1">

                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent z-10" />
                    <img
                        src="/images/account-bg.webp"
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover opacity-40 transition-all duration-500 group-hover:opacity-60 group-hover:scale-105 blur-sm"
                        alt="Background"
                    />
                </div>

                <div className="relative z-20 flex h-full flex-col items-center justify-center p-6">

                    <div className="relative mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-75" />

                        <img
                            src={avatarFailed ? fallbackHeadUrl : headUrl}
                            draggable={false}
                            alt={account.username}
                            className="relative h-24 w-24 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                            onError={() => setAvatarFailed(true)}
                        />
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="text-lg font-bold text-white tracking-tight truncate max-w-[180px]">
                            {account.username}
                        </h3>

                        <div className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border",
                            isLocalAccount
                                ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                            {isLocalAccount ? <LucideGamepad2 size={10} /> : <MicrosoftIcon className="w-2.5 h-2.5" />}
                            {isLocalAccount ? "Offline" : "Microsoft"}
                        </div>
                    </div>

                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                            onClick={() => setShowDeleteAlert(true)}
                            className="p-1.5 rounded-md bg-white/[0.04] text-neutral-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            title="Eliminar cuenta"
                        >
                            <LucideTrash2 size={14} />
                        </button>
                    </div>

                    <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
                            <LucideUser size={12} />
                            <span>Disponible</span>
                        </span>
                    </div>

                </div>
            </div>

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent className="bg-[#0e0e10] border-white/[0.06] text-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-base font-semibold">¿Desvincular cuenta?</AlertDialogTitle>
                        <AlertDialogDescription className="text-neutral-500 text-sm">
                            Estás a punto de eliminar a <span className="text-white font-medium">{account.username}</span> de la lista.
                            Tendrás que iniciar sesión nuevamente para usarla.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-white/[0.06] text-neutral-400 hover:bg-white/[0.04] hover:text-white text-xs">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs border-0"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
