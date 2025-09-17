import React, { useEffect, useState } from 'react';
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
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
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

    // Efecto para formatear automáticamente el JSON cuando cambia
    useEffect(() => {
        if (prelaunchAppearanceJson.trim()) {
            try {
                const parsed = JSON.parse(prelaunchAppearanceJson);
                const formatted = JSON.stringify(parsed, null, 2);
                if (formatted !== prelaunchAppearanceJson) {
                    setPrelaunchAppearanceJson(formatted);
                }
                setIsJsonValid(true);
            } catch (error) {
                setIsJsonValid(false);
            }
        } else {
            setIsJsonValid(true); // Vacío se considera válido
        }
    }, [prelaunchAppearanceJson]);

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
                const message = err?.errors?.[0]?.detail || err?.detail || `Error ${res.status}: ${res.statusText}`;
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

                    <div>
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
                        <label className="text-sm text-zinc-300 block mb-2">Configuración Pre-Launch (JSON)</label>
                        <div className={`border rounded-md overflow-hidden ${!isJsonValid ? 'border-red-500' : 'border-zinc-700'}`}>
                            <CodeMirror
                                value={prelaunchAppearanceJson}
                                height="300px"
                                theme={oneDark}
                                extensions={[json()]}
                                onChange={(value) => setPrelaunchAppearanceJson(value)}
                                className="text-sm"
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
