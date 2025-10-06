import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';

const reminders = [
    {
        title: "¡No abandones Modpack Store! 💚",
        message:
            "También podés usarlo como launcher normal para crear instancias separadas de Minecraft vanilla o Forge, cada una con su propio nombre y configuración. ¡Todo en un solo lugar!",
    },
    {
        title: "Tu launcher, a tu manera ⚡",
        message:
            "Recordá que Modpack Store no es solo para modpacks — también podés iniciar instancias vanilla personalizadas, con mods opcionales, o versiones Forge específicas, manteniendo todo organizado y fácil de acceder.",
    },
    {
        title: "Centralizá tu experiencia 🎮",
        message:
            "Usá Modpack Store como tu launcher principal para gestionar múltiples instancias de Minecraft, desde vanilla hasta modpacks complejos, con nombres personalizados y actualizaciones automáticas. ¡Nunca fue tan fácil!",
    },
];

export function ReminderModal() {
    const [reminder, setReminder] = useState<{ title: string; message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkShouldShow = async () => {
            try {
                const lastShown = await invoke<number | null>('get_config_value', {
                    key: 'lastReminderTimestamp'
                });
                const now = Date.now();
                const sevenDays = 1000 * 60 * 60 * 24 * 7;

                const shouldShow = !lastShown || now - lastShown > sevenDays;
                const randomChance = Math.random() < 0.2; // 20% de probabilidad

                if (shouldShow && randomChance) {
                    const randomReminder = reminders[Math.floor(Math.random() * reminders.length)];
                    setReminder(randomReminder);
                }
            } catch {
                // Si hay error, mostrar de todas formas
                const randomReminder = reminders[Math.floor(Math.random() * reminders.length)];
                setReminder(randomReminder);
            }
        };
        checkShouldShow();
    }, []);

    const handleClose = async () => {
        setLoading(true);
        try {
            await invoke('set_config', {
                key: 'lastReminderTimestamp',
                value: Date.now()
            });
        } finally {
            setReminder(null);
            setLoading(false);
        }
    };

    if (!reminder) return null;

    const content = `## ${reminder.title}\n\n${reminder.message}`;

    return (
        <Dialog open={!!reminder} onOpenChange={() => { }}>
            <DialogContent className="sm:max-w-xl max-w-[90vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
                {/* Imagen arriba */}
                <div className="w-full h-48 flex items-center justify-center">
                    <img
                        src={`/images/reminder.webp?${Date.now()}`}
                        alt="Recordatorio"
                        className="h-48 w-full object-cover object-top"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto px-6 space-y-3">
                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-1
            prose-h2:text-sm prose-h2:uppercase prose-h2:font-bold prose-h2:text-emerald-400
            prose-hr:border-gray-700
            prose-p:text-gray-200 prose-li:text-gray-200">
                        <ReactMarkdown>{content}</ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-900/40">
                    <Button
                        onClick={handleClose}
                        disabled={loading}
                        className="min-w-24"
                    >
                        {loading ? 'Cerrando...' : 'Entendido'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ReminderModal;