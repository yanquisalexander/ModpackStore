import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Correct import for shadcn/ui
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { toast } from 'sonner';
import { Modpack } from '@/types/modpacks';
import { UploadCloud } from 'lucide-react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentWithTab } from '@codemirror/commands';
import { CategorySelector } from '@/components/CategorySelector';
import { ModpackCategoryDisplay } from '@/components/ModpackCategoryDisplay';
import { ModpackStatusManager } from '@/components/creator/ModpackStatusManager';

// --- Props del componente principal ---
interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    modpack: Modpack | null;
}

// --- NUEVO: Componente reutilizable para cargar imágenes ---
interface ImageUploaderProps {
    label: string;
    currentImageUrl: string;
    onFileChange: (file: File | null) => void;
    id: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, currentImageUrl, onFileChange, id }) => {
    const [preview, setPreview] = useState<string | null>(null);

    // Resetear la previsualización si la URL actual cambia (ej. al abrir el diálogo con otro modpack)
    useEffect(() => {
        setPreview(null);
    }, [currentImageUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
            // Crear una URL local para la previsualización
            setPreview(URL.createObjectURL(file));
            onFileChange(file);
        } else {
            setPreview(null);
            onFileChange(null);
        }
    };

    return (
        <div>
            <label className="text-sm text-zinc-300 block mb-2">{label}</label>
            <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-zinc-800 border-2 border-dashed border-zinc-700 rounded-md flex items-center justify-center overflow-hidden">
                    {preview || currentImageUrl ? (
                        <img src={preview || currentImageUrl} alt={`${label} preview`} className="w-full h-full object-cover" />
                    ) : (
                        <UploadCloud className="text-zinc-500" size={32} />
                    )}
                </div>
                <label htmlFor={id} className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    Seleccionar archivo
                </label>
                <input
                    id={id}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
        </div>
    );
};


// --- Componente principal refactorizado ---
export const EditModpackDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, modpack }) => {
    const { sessionTokens } = useAuthentication();

    // Estado para los campos del formulario
    const [name, setName] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);

    // NUEVO: Estado para los archivos de imagen
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    // NUEVO: Estado para prelaunchAppearance
    const [prelaunchAppearanceJson, setPrelaunchAppearanceJson] = useState('{}');

    // NUEVO: Estado para validar el JSON
    const [isJsonValid, setIsJsonValid] = useState(true);

    // Estado para categorías
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');

    // Estado para el status del modpack
    const [modpackStatus, setModpackStatus] = useState<'draft' | 'published' | 'archived' | 'deleted'>('draft');

    // Estado para access mode
    const [accessMode, setAccessMode] = useState<'free' | 'paid' | 'password'>('free');

    // Estado para pricing (solo edición de precio, no método)
    const [currentPrice, setCurrentPrice] = useState('');
    const [newPrice, setNewPrice] = useState('');

    // Estado para contraseña
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Estado para Twitch access mode
    const [twitchAccessEnabled, setTwitchAccessEnabled] = useState(false);

    // Estado para Twitch channels
    const [twitchChannels, setTwitchChannels] = useState<{
        id: string;
        username: string;
        displayName: string;
    }[]>([]);
    const [channelSearchQuery, setChannelSearchQuery] = useState('');
    const [isSearchingChannels, setIsSearchingChannels] = useState(false);

    // Efecto para popular el formulario cuando el modpack cambia
    useEffect(() => {
        if (modpack) {
            setName(modpack.name || '');
            setShortDescription(modpack.shortDescription || '');
            setDescription(modpack.description || '');
            setVisibility((modpack.visibility as any) || 'public');
            // Resetear los archivos al cambiar de modpack
            setIconFile(null);
            setBannerFile(null);

            // Inicializar categorías
            if (modpack.categories) {
                const categoryIds = modpack.categories.map(mc => mc.categoryId);
                const primaryCategory = modpack.categories.find(mc => mc.isPrimary);
                setSelectedCategories(categoryIds);
                setPrimaryCategoryId(primaryCategory?.categoryId || '');
            } else {
                setSelectedCategories([]);
                setPrimaryCategoryId('');
            }

            // Inicializar status
            setModpackStatus(modpack.status as any || 'draft');

            // Inicializar access mode basado en el estado actual
            if (modpack.isPaid) {
                setAccessMode('paid');
            } else if (modpack.password) {
                setAccessMode('password');
            } else {
                setAccessMode('free');
            }

            // Inicializar Twitch access basado en canales existentes
            setTwitchAccessEnabled((modpack.twitchChannels && modpack.twitchChannels.length > 0) || false);

            // Inicializar pricing
            const price = modpack.price ? parseFloat(modpack.price).toFixed(2) : '0.00';
            setCurrentPrice(price);
            setNewPrice(price);

            // Inicializar Twitch channels
            if (modpack.twitchChannels && Array.isArray(modpack.twitchChannels)) {
                setTwitchChannels(modpack.twitchChannels);
            } else {
                setTwitchChannels([]);
            }

            // Inicializar el JSON del prelaunchAppearance
            try {
                const prelaunchData = modpack.prelaunchAppearance;
                if (typeof prelaunchData === 'string') {
                    // Si viene como string, parsearlo y formatearlo
                    const parsed = JSON.parse(prelaunchData);
                    setPrelaunchAppearanceJson(JSON.stringify(parsed, null, 2));
                } else if (prelaunchData && typeof prelaunchData === 'object') {
                    // Si ya es un objeto, formatearlo
                    setPrelaunchAppearanceJson(JSON.stringify(prelaunchData, null, 2));
                } else {
                    // Si no existe, usar objeto vacío formateado
                    setPrelaunchAppearanceJson('{}');
                }
            } catch (error) {
                console.warn('Error parsing prelaunchAppearance:', error);
                setPrelaunchAppearanceJson('{}');
            }
        }
    }, [modpack]);

    // Efecto para manejar cambios en accessMode
    useEffect(() => {
        if (accessMode === 'paid' || accessMode === 'password') {
            setTwitchAccessEnabled(false);
            setTwitchChannels([]); // Limpiar canales cuando no es gratuito
        }
    }, [accessMode]);

    // Efecto para validar el JSON cuando cambia (sin formatear automáticamente)
    useEffect(() => {
        if (prelaunchAppearanceJson.trim()) {
            try {
                JSON.parse(prelaunchAppearanceJson);
                setIsJsonValid(true);
            } catch (error) {
                setIsJsonValid(false);
            }
        } else {
            setIsJsonValid(true); // Vacío se considera válido
        }
    }, [prelaunchAppearanceJson]);

    // Función para formatear el JSON manualmente
    const formatJson = () => {
        if (!prelaunchAppearanceJson.trim()) {
            setPrelaunchAppearanceJson('{}');
            return;
        }

        try {
            const parsed = JSON.parse(prelaunchAppearanceJson);
            const formatted = JSON.stringify(parsed, null, 2);
            setPrelaunchAppearanceJson(formatted);
            setIsJsonValid(true);
        } catch (error) {
            toast.error('No se puede formatear: JSON inválido');
        }
    };

    // Funciones para manejo de Twitch channels
    const searchTwitchChannel = async (query: string) => {
        if (!query || query.length < 2) return;

        setIsSearchingChannels(true);
        try {
            const response = await fetch(`${API_ENDPOINT}/explore/twitch-channels/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.channels && data.channels.length > 0) {
                const channel = data.channels[0];
                // Verificar que no esté ya añadido
                if (!twitchChannels.find(c => c.id === channel.id)) {
                    setTwitchChannels(prev => [...prev, channel]);
                    setChannelSearchQuery('');
                    toast.success(`Canal ${channel.displayName} añadido`);
                } else {
                    toast.error('Este canal ya está añadido');
                }
            } else {
                toast.error('Canal no encontrado');
            }
        } catch (error) {
            console.error('Error searching Twitch channel:', error);
            toast.error('Error al buscar el canal');
        } finally {
            setIsSearchingChannels(false);
        }
    };

    const removeTwitchChannel = (channelId: string) => {
        setTwitchChannels(prev => prev.filter(c => c.id !== channelId));
        toast.success('Canal eliminado');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modpack) return;

        setLoading(true);
        try {
            // CAMBIO: Usar FormData para enviar archivos y datos
            const formData = new FormData();

            // Añadir campos de texto
            formData.append('name', name);
            formData.append('shortDescription', shortDescription);
            formData.append('description', description);
            formData.append('visibility', visibility);
            formData.append('status', modpackStatus);
            formData.append('acquisitionMethod', accessMode);

            // Añadir prelaunchAppearance si es válido
            if (!isJsonValid) {
                toast.error('JSON del pre-launch no es válido');
                setLoading(false);
                return;
            }

            try {
                const prelaunchAppearance = JSON.parse(prelaunchAppearanceJson);
                formData.append('prelaunchAppearance', JSON.stringify(prelaunchAppearance));
            } catch (error) {
                // Este catch es por si acaso, aunque isJsonValid debería prevenirlo
                toast.error('Error inesperado al procesar el JSON del pre-launch');
                setLoading(false);
                return;
            }

            // Añadir archivos solo si han sido seleccionados
            if (iconFile) {
                formData.append('icon', iconFile);
            }
            if (bannerFile) {
                formData.append('banner', bannerFile);
            }

            // Añadir categorías
            formData.append('categories', JSON.stringify(selectedCategories));
            if (primaryCategoryId) {
                formData.append('primaryCategoryId', primaryCategoryId);
            }

            // Validar Twitch access
            if (accessMode === 'free' && twitchAccessEnabled && twitchChannels.length === 0) {
                toast.error('Debes añadir al menos un canal de Twitch si activas el acceso restringido.');
                setLoading(false);
                return;
            }

            // Añadir Twitch channels (vacío si no está habilitado o no es gratuito)
            formData.append('twitchChannels', JSON.stringify((accessMode === 'free' && twitchAccessEnabled) ? twitchChannels : []));

            // Validar y añadir precio si se cambió y el modo es paid
            if (accessMode === 'paid' && newPrice !== currentPrice) {
                const newPriceNum = parseFloat(newPrice);
                const currentPriceNum = parseFloat(currentPrice);

                // Validar restricciones de precio
                if (currentPriceNum === 0 && newPriceNum > 0) {
                    toast.error('No se puede convertir un modpack gratuito a de pago.');
                    setLoading(false);
                    return;
                }

                if (newPriceNum > currentPriceNum) {
                    toast.error(`No se puede aumentar el precio. El precio actual es $${currentPriceNum.toFixed(2)} USD.`);
                    setLoading(false);
                    return;
                }

                if (newPriceNum < 0) {
                    toast.error('El precio no puede ser negativo.');
                    setLoading(false);
                    return;
                }

                formData.append('price', newPriceNum.toFixed(2));
            }

            // Validar y añadir contraseña si el modo es password
            if (accessMode === 'password') {
                if (!newPassword && !modpack?.password) {
                    toast.error('Debes proporcionar una contraseña para el modo protegido.');
                    setLoading(false);
                    return;
                }

                if (newPassword) {
                    if (newPassword !== confirmPassword) {
                        toast.error('Las contraseñas no coinciden.');
                        setLoading(false);
                        return;
                    }

                    if (newPassword.length < 4) {
                        toast.error('La contraseña debe tener al menos 4 caracteres.');
                        setLoading(false);
                        return;
                    }

                    formData.append('password', newPassword);
                }
            }

            // Si cambia a free, no enviar precio ni contraseña (se eliminarán automáticamente)

            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${modpack.publisherId}/modpacks/${modpack.id}`, {
                method: 'PATCH',
                headers: {
                    // 'Content-Type' es establecido automáticamente por el navegador con FormData
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: formData, // Enviar el objeto FormData
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.error || err?.detail || err?.errors?.[0]?.detail || `Error ${res.status}: ${res.statusText}`;
                toast.error(`Error al actualizar modpack`, { description: String(message) });
                return; // No continuar si hay error
            }

            toast.success('Modpack actualizado correctamente');
            onClose();
            onSuccess?.();
        } catch (error) {
            console.error('Edit modpack error', error);
            toast.error('Ocurrió un error inesperado al actualizar el modpack.');
        } finally {
            setLoading(false);
        }
    };

    // --- Componente CodeMirror personalizado para evitar conflictos ---
    interface CodeMirrorEditorProps {
        value: string;
        onChange: (value: string) => void;
        height?: string;
        className?: string;
    }

    const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({ value, onChange, height = "300px", className = "" }) => {
        const editorRef = useRef<HTMLDivElement>(null);
        const viewRef = useRef<EditorView | null>(null);
        const initialValueRef = useRef(value);

        useEffect(() => {
            if (!editorRef.current) return;

            const startState = EditorState.create({
                doc: initialValueRef.current,
                extensions: [
                    basicSetup,
                    keymap.of([indentWithTab]),
                    json(),
                    oneDark,
                    EditorView.updateListener.of((update) => {
                        if (update.docChanged) {
                            onChange(update.state.doc.toString());
                        }
                    }),
                    EditorView.theme({
                        "&": {
                            height,
                            fontSize: "14px"
                        },
                        ".cm-scroller": {
                            fontFamily: "var(--font-mono, 'Fira Code', monospace)"
                        }
                    })
                ],
            });

            const view = new EditorView({
                state: startState,
                parent: editorRef.current,
            });

            viewRef.current = view;

            return () => {
                view.destroy();
            };
        }, []);

        // Actualizar el contenido cuando cambia el value prop
        useEffect(() => {
            if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
                viewRef.current.dispatch({
                    changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
                });
            }
        }, [value]);

        return <div ref={editorRef} className={`border rounded-md overflow-hidden ${className}`} />;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Editar modpack</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Modificar los detalles del modpack "{modpack?.name}".
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 p-2 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Nombre</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>


                    {/* NUEVO: Uploader para el icono */}
                    <ImageUploader
                        id="icon-upload"
                        label="Icono"
                        currentImageUrl={modpack?.iconUrl || ''}
                        onFileChange={setIconFile}
                    />

                    {/* NUEVO: Uploader para el banner */}
                    <ImageUploader
                        id="banner-upload"
                        label="Banner"
                        currentImageUrl={modpack?.bannerUrl || ''}
                        onFileChange={setBannerFile}
                    />

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Visibilidad</label>
                        {/* CAMBIO: Componente Select corregido */}
                        <Select value={visibility} onValueChange={(v: 'public' | 'private' | 'patreon') => setVisibility(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona una visibilidad" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="public">Público</SelectItem>
                                <SelectItem value="private">Privado</SelectItem>
                                <SelectItem value="patreon">Solo Patreon</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Access Mode Section */}
                    <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-zinc-300">Modo de Adquisición</h3>
                            <div className="text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded">Obligatorio</div>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-sm text-zinc-300 block mb-2">Selecciona cómo los usuarios accederán al modpack</label>
                                <Select value={accessMode} onValueChange={(v: 'free' | 'paid' | 'password') => setAccessMode(v)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecciona un modo de adquisición" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="free">
                                            <div className="flex flex-col">
                                                <span className="font-medium">Gratuito</span>
                                                <span className="text-xs text-zinc-400">Acceso libre para todos los usuarios</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="paid">
                                            <div className="flex flex-col">
                                                <span className="font-medium">De Pago</span>
                                                <span className="text-xs text-zinc-400">Los usuarios pagan por acceder</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="password">
                                            <div className="flex flex-col">
                                                <span className="font-medium">Protegido con Contraseña</span>
                                                <span className="text-xs text-zinc-400">Acceso mediante contraseña</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded border">
                                {accessMode === 'free' && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-green-400">✅</span>
                                        <span>Modpack gratuito - Los usuarios pueden descargarlo sin costo ni restricciones adicionales.</span>
                                    </div>
                                )}
                                {accessMode === 'paid' && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400">💰</span>
                                        <span>Modpack de pago - Configura el precio abajo. Los usuarios deben pagar para acceder.</span>
                                    </div>
                                )}
                                {accessMode === 'password' && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-orange-400">🔒</span>
                                        <span>Modpack protegido - Los usuarios necesitan una contraseña para acceder.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pricing Section */}
                    {accessMode === 'paid' && (
                        <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-zinc-300">Gestión de Precios</h3>
                                <div className="text-xs text-blue-400 bg-blue-900/20 px-2 py-1 rounded">USD</div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm text-zinc-400">
                                    <span className="font-medium">Método actual:</span> {' '}
                                    {modpack?.isPaid ? (
                                        <span className="text-green-400">De pago</span>
                                    ) : modpack?.password ? (
                                        <span className="text-yellow-400">Protegido con contraseña</span>
                                    ) : (
                                        <span className="text-blue-400">Gratuito</span>
                                    )}
                                </div>

                                {modpack?.isPaid && (
                                    <div>
                                        <label className="text-sm text-zinc-300 block mb-1">
                                            Precio actual: ${currentPrice} USD
                                        </label>
                                        <label className="text-sm text-zinc-300 block mb-1">
                                            Nuevo precio (USD) - Solo se puede mantener o reducir
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={currentPrice}
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(e.target.value)}
                                            placeholder={currentPrice}
                                        />
                                        <p className="text-xs text-zinc-400 mt-1">
                                            ⚠️ Restricciones: No se puede aumentar el precio, solo mantener igual o reducir.
                                        </p>
                                    </div>
                                )}

                                {!modpack?.isPaid && !modpack?.password && (
                                    <p className="text-xs text-green-400">
                                        ✅ Modpack gratuito - Los usuarios pueden descargarlo sin costo.
                                    </p>
                                )}

                                {modpack?.password && (
                                    <p className="text-xs text-yellow-400">
                                        🔒 Modpack protegido con contraseña - Los precios no se pueden cambiar para modpacks con contraseña.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Password Section */}
                    {accessMode === 'password' && (
                        <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-zinc-300">Gestión de Contraseña</h3>
                                <div className="text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">Obligatorio</div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm text-zinc-400">
                                    <span className="font-medium">Estado actual:</span> {' '}
                                    {modpack?.password ? (
                                        <span className="text-yellow-400">Protegido con contraseña</span>
                                    ) : (
                                        <span className="text-blue-400">Sin contraseña</span>
                                    )}
                                </div>

                                <div>
                                    <label className="text-sm text-zinc-300 block mb-1">
                                        Nueva contraseña (dejar vacío para mantener actual)
                                    </label>
                                    <Input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Nueva contraseña"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-zinc-300 block mb-1">
                                        Confirmar nueva contraseña
                                    </label>
                                    <Input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirmar contraseña"
                                    />
                                </div>

                                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                                    <p className="text-xs text-red-400">
                                        Las contraseñas no coinciden.
                                    </p>
                                )}

                                <p className="text-xs text-zinc-500 mt-1">
                                    Si se establece una contraseña, los usuarios necesitarán introducirla para acceder al modpack.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Twitch Access Section */}
                    {accessMode === 'free' && (
                        <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-zinc-300">Acceso con Suscripción de Twitch</h3>
                                <div className="text-xs text-purple-400 bg-purple-900/20 px-2 py-1 rounded">Opcional</div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-zinc-300 block mb-2">¿Requiere suscripción de Twitch?</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            className={`flex flex-col items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${!twitchAccessEnabled
                                                ? "border-green-500 bg-green-900/20"
                                                : "border-gray-700 hover:border-gray-500"
                                                }`}
                                            onClick={() => setTwitchAccessEnabled(false)}
                                        >
                                            <span className="text-lg">🚫</span>
                                            <span className="font-medium text-sm text-center">Sin restricción</span>
                                            <span className="text-xs text-zinc-400 text-center">Acceso libre</span>
                                        </div>

                                        <div
                                            className={`flex flex-col items-center gap-2 p-3 rounded-md border cursor-pointer transition-all ${twitchAccessEnabled
                                                ? "border-purple-500 bg-purple-900/20"
                                                : "border-gray-700 hover:border-gray-500"
                                                }`}
                                            onClick={() => setTwitchAccessEnabled(true)}
                                        >
                                            <span className="text-lg">📺</span>
                                            <span className="font-medium text-sm text-center">Requiere Twitch</span>
                                            <span className="text-xs text-zinc-400 text-center">Suscripción necesaria</span>
                                        </div>
                                    </div>
                                </div>

                                {twitchAccessEnabled && (
                                    <div className="space-y-3 pt-3 border-t border-zinc-700">
                                        <p className="text-xs text-zinc-400">
                                            Los usuarios necesitarán estar suscritos a al menos uno de estos canales para acceder al modpack.
                                        </p>

                                        {/* Canal Search */}
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Buscar canal de Twitch..."
                                                value={channelSearchQuery}
                                                onChange={(e) => setChannelSearchQuery(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        searchTwitchChannel(channelSearchQuery);
                                                    }
                                                }}
                                                disabled={isSearchingChannels}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => searchTwitchChannel(channelSearchQuery)}
                                                disabled={isSearchingChannels || !channelSearchQuery}
                                                className="px-3"
                                            >
                                                {isSearchingChannels ? '...' : 'Añadir'}
                                            </Button>
                                        </div>

                                        {/* Canales añadidos */}
                                        {twitchChannels.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs text-zinc-300 font-medium">Canales requeridos:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {twitchChannels.map((channel) => (
                                                        <div
                                                            key={channel.id}
                                                            className="flex items-center gap-2 bg-purple-900/20 border border-purple-700/30 rounded px-2 py-1 text-xs"
                                                        >
                                                            <span className="text-purple-200">{channel.displayName}</span>
                                                            <span className="text-purple-400">(@{channel.username})</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTwitchChannel(channel.id)}
                                                                className="text-purple-400 hover:text-red-400 ml-1"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {twitchChannels.length === 0 && (
                                            <p className="text-xs text-zinc-500">
                                                No hay canales añadidos. Los usuarios no podrán acceder al modpack.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded border">
                                    {!twitchAccessEnabled ? (
                                        <div className="flex items-start gap-2">
                                            <span className="text-green-400">✅</span>
                                            <span>Acceso libre - Los usuarios pueden descargar el modpack sin restricciones de Twitch.</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-2">
                                            <span className="text-purple-400">📺</span>
                                            <span>Acceso restringido - Los usuarios deben estar suscritos a los canales especificados.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Mensaje cuando no se puede usar Twitch */}
                    {accessMode !== 'free' && (
                        <div className="space-y-3 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-zinc-300">Acceso con Suscripción de Twitch</h3>
                                <div className="text-xs text-gray-400 bg-gray-900/20 px-2 py-1 rounded">No disponible</div>
                            </div>

                            <div className="text-xs text-zinc-500 bg-zinc-900/50 p-3 rounded border">
                                <div className="flex items-start gap-2">
                                    <span className="text-gray-400">🚫</span>
                                    <span>El acceso por Twitch solo está disponible para modpacks gratuitos. Cambia el modo de adquisición a "Gratuito" para poder configurar restricciones de Twitch.</span>
                                </div>
                            </div>
                        </div>
                    )}                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Descripción corta</label>
                        <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Descripción completa</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                    </div>

                    {/* Current Categories Display */}
                    {modpack?.categories && modpack.categories.length > 0 && (
                        <ModpackCategoryDisplay
                            categories={modpack.categories}
                            className="space-y-2"
                        />
                    )}

                    {/* Category Selection */}
                    <CategorySelector
                        selectedCategories={selectedCategories}
                        primaryCategoryId={primaryCategoryId}
                        onCategoriesChange={setSelectedCategories}
                        onPrimaryCategoryChange={setPrimaryCategoryId}
                        disabled={loading}
                    />

                    {/* Modpack Status Management */}
                    <ModpackStatusManager
                        currentStatus={modpackStatus}
                        onStatusChange={(newStatus) => setModpackStatus(newStatus)}
                        disabled={loading}
                        hasPrimaryCategory={!!primaryCategoryId || selectedCategories.length > 0}
                    />

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-zinc-300">Configuración Pre-Launch (JSON)</label>
                            <div className="flex items-center gap-2">
                                {isJsonValid && (
                                    <span className="text-xs text-green-400 flex items-center gap-1">
                                        <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                        JSON válido
                                    </span>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={formatJson}
                                    className="text-xs h-7 px-2"
                                    disabled={!prelaunchAppearanceJson.trim()}
                                >
                                    Formatear JSON
                                </Button>
                            </div>
                        </div>
                        <div className={`border rounded-md overflow-hidden ${!isJsonValid ? 'border-red-500' : 'border-zinc-700'}`}>
                            <CodeMirrorEditor
                                value={prelaunchAppearanceJson}
                                onChange={setPrelaunchAppearanceJson}
                                height="300px"
                            />
                        </div>
                        {!isJsonValid && (
                            <p className="text-xs text-red-400 mt-1">
                                JSON no válido. Por favor, corrige la sintaxis.
                            </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">
                            Configura la apariencia del launcher antes de iniciar Minecraft. Usa JSON válido.
                        </p>
                    </div>

                    <DialogFooter className="pt-4">
                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                            <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditModpackDialog;
