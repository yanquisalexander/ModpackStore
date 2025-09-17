import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Modpack } from '@/types/modpacks';
import { UploadCloud } from 'lucide-react';
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { CategorySelector } from '@/components/CategorySelector';



interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (created?: Modpack) => void;
    teamId?: string;
}

// --- Componente reutilizable para cargar imágenes (copiado de EditModpackDialog) ---
interface ImageUploaderProps {
    label: string;
    onFileChange: (file: File | null) => void;
    id: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, onFileChange, id }) => {
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
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
                    {preview ? (
                        <img src={preview} alt={`${label} preview`} className="w-full h-full object-cover" />
                    ) : (
                        <UploadCloud className="text-zinc-500" size={32} />
                    )}
                </div>
                <label htmlFor={id} className="cursor-pointer bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md transition-colors">
                    Seleccionar archivo
                </label>
                <input id={id} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
        </div>
    );
};

// --- Componente principal optimizado ---
const CreateModpackDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, teamId }) => {
    const { sessionTokens } = useAuthentication();

    // Estado del formulario
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);

    // Estado para los archivos de imagen
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    // Estado para categorías
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');

    // MEJORA: Auto-generar el slug a partir del nombre
    useEffect(() => {
        const generatedSlug = name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-') // Reemplazar espacios con -
            .replace(/[^\w-]+/g, '') // Eliminar caracteres no válidos
            .replace(/--+/g, '-'); // Reemplazar múltiples - con uno solo
        setSlug(generatedSlug);
    }, [name]);


    const resetForm = () => {
        setName('');
        setSlug('');
        setShortDescription('');
        setDescription('');
        setVisibility('public');
        setIconFile(null);
        setBannerFile(null);
        setSelectedCategories([]);
        setPrimaryCategoryId('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamId) {
            toast.error('No se ha seleccionado un equipo.');
            return;
        }

        // Validar que se haya seleccionado al menos una categoría
        if (selectedCategories.length === 0) {
            toast.error('Debes seleccionar al menos una categoría para tu modpack.');
            return;
        }

        // Validar que se haya seleccionado una categoría primaria
        if (!primaryCategoryId) {
            toast.error('Debes seleccionar una categoría primaria.');
            return;
        }

        setLoading(true);
        try {
            // CAMBIO: Usar FormData para enviar archivos y datos
            const formData = new FormData();
            formData.append('name', name);
            formData.append('slug', slug);
            formData.append('shortDescription', shortDescription);
            formData.append('description', description);
            formData.append('visibility', visibility);
            formData.append('categories', JSON.stringify(selectedCategories));
            formData.append('primaryCategoryId', primaryCategoryId);

            if (iconFile) formData.append('icon', iconFile);
            if (bannerFile) formData.append('banner', bannerFile);

            const res = await fetch(`${API_ENDPOINT}/creators/publishers/${teamId}/modpacks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.errors?.[0]?.detail || err?.detail || `Error ${res.status}: ${res.statusText}`;
                toast.error('Error al crear el modpack', { description: String(message) });
                return;
            }

            const created = await res.json();
            toast.success('Modpack creado con éxito');
            resetForm();
            onClose();
            onSuccess?.(created);
        } catch (error) {
            console.error('Create modpack error', error);
            toast.error('Ocurrió un error inesperado al crear el modpack.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Crear nuevo modpack</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Completa los detalles para crear un nuevo modpack.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 p-2 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Nombre</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Slug (auto-generado)</label>
                        <p className="p-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-400 select-all">{slug || 'El slug se generará automáticamente al ingresar el nombre'}</p>
                    </div>

                    <ImageUploader id="create-icon-upload" label="Icono" onFileChange={setIconFile} />
                    <ImageUploader id="create-banner-upload" label="Banner" onFileChange={setBannerFile} />

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Visibilidad</label>
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

                    {/* Category Selection */}
                    <CategorySelector
                        selectedCategories={selectedCategories}
                        primaryCategoryId={primaryCategoryId}
                        onCategoriesChange={setSelectedCategories}
                        onPrimaryCategoryChange={setPrimaryCategoryId}
                        disabled={loading}
                    />

                    <DialogFooter className="pt-4">
                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                                {loading ? 'Creando...' : 'Crear modpack'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateModpackDialog;
