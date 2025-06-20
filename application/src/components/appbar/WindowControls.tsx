import { LucideMinus, LucidePictureInPicture2, LucideSquare, LucideX } from "lucide-react";
import { Window } from '@tauri-apps/api/window';
import React from "react";

interface WindowControlsProps {
    window: Window | null;
    isMaximized: boolean | undefined;
    onMinimize: () => void;
    onMaximize: () => void;
    onClose: () => void;
}

export const WindowControls: React.FC<WindowControlsProps> = ({ window, isMaximized, onMinimize, onMaximize, onClose }) => (
    <div className="flex items-center justify-end" onContextMenu={(e) => {
        e.preventDefault();
    }}>
        <button
            className="cursor-pointer flex size-9 aspect-square items-center justify-center hover:bg-neutral-800"
            aria-label="Minimize"
            onClick={onMinimize}
        >
            <LucideMinus className="h-4 w-4" />
        </button>
        <button
            className="cursor-pointer flex size-9 aspect-square items-center justify-center hover:bg-neutral-800"
            aria-label="Maximize"
            onClick={onMaximize}
        >
            {isMaximized
                ? <LucidePictureInPicture2 className="h-4 w-4" />
                : <LucideSquare className="h-3.5 w-3.5" />
            }
        </button>
        <button
            onClick={onClose}
            className="cursor-pointer flex size-9 aspect-square items-center justify-center hover:bg-red-600"
            aria-label="Close"
        >
            <LucideX className="h-4 w-4" />
        </button>
    </div>
);
