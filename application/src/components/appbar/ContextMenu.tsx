import React from "react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
    ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { X, LucideMinus, LucidePictureInPicture2, LucideSquare } from "lucide-react";

interface NativeContextMenuProps {
    children: React.ReactNode;
    onMinimize: () => void;
    onMaximize: () => void;
    onRestore: () => void;
    onCloseWindow: () => void;
    isMaximized: boolean;
}

export const NativeContextMenu: React.FC<NativeContextMenuProps> = ({
    children,
    onMinimize,
    onMaximize,
    onRestore,
    onCloseWindow,
    isMaximized,
}) => (
    <ContextMenu>
        <ContextMenuTrigger className="z-[10000]" asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="min-w-[180px] z-[10010] shadow-xl border border-neutral-800 bg-neutral-900/95">
            <ContextMenuItem onClick={onMinimize} className="flex items-center gap-2">
                <LucideMinus className="w-4 h-4 opacity-80" />
                Minimizar
            </ContextMenuItem>
            {isMaximized ? (
                <ContextMenuItem onClick={onRestore} className="flex items-center gap-2">
                    <LucidePictureInPicture2 className="w-4 h-4 opacity-80" />
                    Restaurar
                </ContextMenuItem>
            ) : (
                <ContextMenuItem onClick={onMaximize} className="flex items-center gap-2">
                    <LucideSquare className="w-4 h-4 opacity-80" />
                    Maximizar
                </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onCloseWindow} className="flex items-center gap-2 text-red-500 focus:text-red-700">
                <X className="w-4 h-4 opacity-80" />
                Cerrar
            </ContextMenuItem>
        </ContextMenuContent>
    </ContextMenu>
);
