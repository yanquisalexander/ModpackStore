import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Keyboard } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface HotkeyRecorderProps {
    value: string;
    onChange: (value: string) => void;
}

export const HotkeyRecorder: React.FC<HotkeyRecorderProps> = ({ value, onChange }) => {
    const [recording, setRecording] = useState(false);

    useEffect(() => {
        if (recording) {
            // Desactivar hotkeys globales mientras grabamos
            invoke('unregister_hotkeys').catch(console.error);
        } else {
            // Reactivar hotkeys globales al terminar (restaura los guardados)
            invoke('reload_hotkeys').catch(console.error);
        }

        if (!recording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore standalone modifier presses
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                return;
            }

            // Build the shortcut string
            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Ctrl');
            if (e.altKey) modifiers.push('Alt');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.metaKey) modifiers.push('Super');

            // Require at least one modifier key
            if (modifiers.length === 0) {
                return;
            }

            let keyName = e.key.toUpperCase();

            // Map common keys to standard names if needed
            // For now, simple mapping
            if (e.code.startsWith('Key')) keyName = e.code.slice(3);
            if (e.code.startsWith('Digit')) keyName = e.code.slice(5);

            // Function keys
            if (e.code.startsWith('F') && e.code.length <= 3) keyName = e.code;

            const shortcut = [...modifiers, keyName].join('+');
            onChange(shortcut);
            setRecording(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recording, onChange]);

    return (
        <div className="flex items-center gap-2">
            <Button
                variant={recording ? "destructive" : "secondary"}
                className={`w-full justify-between bg-black/20 border-white/10 text-white hover:bg-white/10 ${recording ? 'animate-pulse border-red-500/50 text-red-200' : ''}`}
                onClick={() => setRecording(!recording)}
            >
                <span className="flex items-center gap-2">
                    <Keyboard className="h-4 w-4 opacity-50" />
                    {recording ? "Presiona combinación..." : (value || "Sin asignar")}
                </span>
                {recording && <X className="h-4 w-4" />}
            </Button>
        </div>
    );
};
