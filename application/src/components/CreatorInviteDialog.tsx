import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';

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

¿Listo para dar el siguiente paso en tu carrera como creador de contenido?`;

export const CreatorInviteDialog: React.FC<CreatorInviteDialogProps> = ({ isOpen, onClose }) => {
    const { refreshTokens } = useAuthentication();
    const [showForm, setShowForm] = React.useState(false);
    const [displayName, setDisplayName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleClose = () => {
        setShowForm(false);
        setDisplayName('');
        setDescription('');
        setError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetchWithAuth(`${API_ENDPOINT}/creators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: displayName.trim(),
                    description: description.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.errors?.[0]?.detail || 'Error al enviar la solicitud');
            }

            await refreshTokens();
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error inesperado');
        } finally {
            setIsSubmitting(false);
        }
    };

    const Banner = () => (
        <div className="w-full h-56 flex items-center justify-center relative">
            <img
                src="/images/become-creator-banner.webp"
                alt="Conviértete en creador"
                className="h-56 w-full object-cover object-top"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
        </div>
    );

    return (
        <>
            {/* Info Dialog */}
            <Dialog open={isOpen && !showForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
                <DialogContent className="sm:max-w-xl max-w-[90vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
                    <Banner />

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

                    <div className="p-4 border-t border-gray-800 flex justify-between bg-gray-900/40">
                        <Button onClick={handleClose} variant="outline" className="min-w-24">
                            Cerrar
                        </Button>
                        <Button
                            onClick={() => setShowForm(true)}
                            className="min-w-32 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            Solicitar ahora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Form Dialog */}
            <Dialog open={showForm} onOpenChange={(open) => { if (!open) handleClose(); }}>
                <DialogContent className="sm:max-w-lg max-w-[90vw] max-h-[85vh] flex flex-col p-0 rounded-2xl overflow-hidden">
                    <Banner />

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        <form id="creator-form" onSubmit={handleSubmit} className="space-y-5">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-white">Solicitud de Creador</h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    Completa los datos para enviar tu solicitud
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Nombre de tu equipo/creador <span className="text-red-400">*</span>
                                </label>
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Ej: Studio Pixel"
                                    className="bg-gray-800 border-gray-700 text-white"
                                    required
                                    maxLength={64}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                    Descripción
                                </label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Cuéntanos sobre ti y tu equipo..."
                                    className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                                    maxLength={500}
                                />
                                <p className="text-xs text-gray-500 mt-1">{description.length}/500</p>
                            </div>

                            {error && (
                                <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-2">
                                    {error}
                                </div>
                            )}
                        </form>
                    </div>

                    <div className="p-4 border-t border-gray-800 flex justify-between bg-gray-900/40">
                        <Button
                            type="button"
                            onClick={handleClose}
                            variant="outline"
                            className="min-w-24"
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            form="creator-form"
                            disabled={!displayName.trim() || isSubmitting}
                            className="min-w-32 bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isSubmitting ? (
                                <><Loader2 size={16} className="mr-2 animate-spin" /> Enviando...</>
                            ) : (
                                'Enviar solicitud'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};

export default CreatorInviteDialog;
