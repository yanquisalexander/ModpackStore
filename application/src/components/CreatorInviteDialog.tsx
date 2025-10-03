import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { ExternalLink } from 'lucide-react';
import { open } from "@tauri-apps/plugin-shell";

interface CreatorInviteDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

const CREATOR_CONTENT = `

¿Tienes talento para crear modpacks increíbles? ¿Quieres compartir tus creaciones con miles de jugadores?

**¡Conviértete en creador oficial de Modpack Store!**

### ✨ Beneficios de ser creador:
- **Visibilidad global**: Tus modpacks llegarán a miles de jugadores
- **Monetización**: Gana dinero con tus creaciones
- **Comunidad**: Únete a una comunidad de creadores apasionados
- **Soporte**: Recibe ayuda técnica y promoción de tu trabajo
- **Herramientas exclusivas**: Acceso a herramientas avanzadas de creación

### 📋 Requisitos:
- Conocimientos básicos de Minecraft y mods
- Creatividad y pasión por el gaming
- Compromiso con la calidad y actualización de tus modpacks
- Respeto a las reglas de la comunidad

### 🎯 Próximos pasos:
1. Únete a nuestro servidor de Discord
2. Lee las reglas y guías para creadores
3. Envía tu solicitud con ejemplos de tu trabajo
4. ¡Comienza tu viaje como creador oficial!

¿Listo para dar el siguiente paso en tu carrera como creador de contenido?`;

export const CreatorInviteDialog: React.FC<CreatorInviteDialogProps> = ({ isOpen, onClose }) => {
    const handleJoinDiscord = () => {
        // Open Discord invite link
        open('https://discord.gg/bcxeTy2q8d');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl max-w-[90vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">

                {/* Imagen arriba */}
                <div className="w-full h-56  flex items-center justify-center relative">
                    <img
                        src="/images/become-creator-banner.webp"
                        alt="Conviértete en creador"
                        className="h-56 w-full object-cover object-top"
                        onError={(e) => {
                            // Fallback if image fails to load
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-white mb-2">🚀 Conviértete en Creador</h1>
                        <p className="text-sm text-gray-300">Únete a nuestra comunidad de creadores</p>
                    </div>

                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-3
            prose-h2:text-lg prose-h2:font-bold prose-h2:text-purple-400 prose-h2:mb-3
            prose-h3:text-base prose-h3:font-semibold prose-h3:text-pink-400
            prose-hr:border-gray-700
            prose-p:text-gray-200 prose-li:text-gray-200
            prose-ul:space-y-1 prose-li:marker:text-purple-400">
                        <ReactMarkdown>{CREATOR_CONTENT}</ReactMarkdown>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-between bg-gray-900/40">
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="min-w-24"
                    >
                        Cerrar
                    </Button>
                    <Button
                        onClick={handleJoinDiscord}
                        className="min-w-32 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                        <ExternalLink size={16} className="mr-2" />
                        Unirme al Discord
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CreatorInviteDialog;