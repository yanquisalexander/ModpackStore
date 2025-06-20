import { LucideDownload } from "lucide-react";
import React from "react";

interface UpdateButtonProps {
    updateState: string;
    applyUpdate: () => void;
}

export const UpdateButton: React.FC<UpdateButtonProps> = ({ updateState, applyUpdate }) => {
    if (updateState !== 'ready-to-install') return null;
    return (
        <button
            onClick={applyUpdate}
            title="Listo para reiniciar"
            className="cursor-pointer flex animate-fade-in-down duration-500 size-9 aspect-square items-center justify-center hover:bg-neutral-800"
            aria-label="Update"
        >
            <LucideDownload className="size-4 text-green-400" />
        </button>
    );
};
