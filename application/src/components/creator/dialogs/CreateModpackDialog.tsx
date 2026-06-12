import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Modpack } from '@/types/modpacks';
import { UploadCloud, Check, ChevronRight, ChevronLeft, Info, DollarSign, Lock, Eye } from 'lucide-react';
import { useAuthentication } from "@/stores/AuthContext";
import { API_ENDPOINT } from "@/consts";
import { CategorySelector } from '@/components/CategorySelector';
import { cn } from '@/lib/utils'; // Asegúrate de tener esta utilidad, o usa classnames

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (created?: Modpack) => void;
    creatorId?: string;
}

// --- Componente de Carga de Imágenes (Mantenido igual) ---
interface ImageUploaderProps {
    label: string;
    onFileChange: (file: File | null) => void;
    id: string;
    description?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, onFileChange, id, description }) => {
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
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 transition-all hover:border-zinc-600">
            <div className="flex justify-between items-start mb-3">
                <label className="text-sm font-medium text-zinc-200">{label}</label>
                {description && <span className="text-xs text-zinc-500">{description}</span>}
            </div>
            <div className="flex items-center gap-4">
                <div className="w-24 h-24 bg-zinc-900 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center overflow-hidden shrink-0 group hover:border-zinc-500 transition-colors">
                    {preview ? (
                        <img src={preview} alt={`${label} preview`} className="w-full h-full object-cover" />
                    ) : (
                        <UploadCloud className="text-zinc-600 group-hover:text-zinc-400 transition-colors" size={28} />
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor={id} className="cursor-pointer inline-flex items-center justify-center bg-white text-black hover:bg-zinc-200 text-sm font-medium py-2 px-4 rounded-md transition-colors w-fit">
                        Subir imagen
                    </label>
                    <span className="text-xs text-zinc-500">Max 2MB. JPG o PNG.</span>
                </div>
                <input id={id} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
        </div>
    );
};

// --- Definición de Pasos ---
const STEPS = [
    { id: 1, title: "Detalles", icon: Info },
    { id: 2, title: "Multimedia", icon: Eye },
    { id: 3, title: "Categorías", icon: Check }, // Icono genérico o de lista
    { id: 4, title: "Configuración", icon: Lock },
];

const CreateModpackDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, creatorId }) => {
    const { sessionTokens } = useAuthentication();

    // Control de Pasos
    const [currentStep, setCurrentStep] = useState(1);

    // Estado del Formulario
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);

    // Archivos
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    // Categorías
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');

    // Pricing
    const [acquisitionMethod, setAcquisitionMethod] = useState<'free' | 'paid' | 'password'>('free');
    const [price, setPrice] = useState('');
    const [password, setPassword] = useState('');

    // Auto-generar slug
    useEffect(() => {
        const generatedSlug = name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-');
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
        setAcquisitionMethod('free');
        setPrice('');
        setPassword('');
        setCurrentStep(1);
    };

    // --- Lógica de Navegación y Validación ---
    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1: // Detalles
                if (!name.trim()) { toast.error("El nombre es obligatorio"); return false; }
                if (!shortDescription.trim()) { toast.error("La descripción corta es obligatoria"); return false; }
                return true;
            case 2: // Multimedia
                // Opcional, pero podrías requerir icono si quisieras
                return true;
            case 3: // Categorías (opcional por ahora)
                return true;
            case 4: // Configuración (Pricing)
                if (acquisitionMethod === 'paid') {
                    const p = parseFloat(price);
                    if (!price || isNaN(p) || p <= 0) { toast.error("Precio inválido"); return false; }
                }
                if (acquisitionMethod === 'password' && !password.trim()) { toast.error("Contraseña obligatoria"); return false; }
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
        }
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    // --- Envío del Formulario ---
    const handleSubmit = async () => {
        if (!validateStep(4)) return; // Validar último paso antes de enviar
        if (!creatorId) { toast.error('Error interno: No creator ID'); return; }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('slug', slug);
            formData.append('shortDescription', shortDescription);
            formData.append('description', description);
            formData.append('visibility', visibility);
            formData.append('categories', JSON.stringify(selectedCategories));
            formData.append('primaryCategoryId', primaryCategoryId);

            formData.append('acquisitionMethod', acquisitionMethod);
            if (acquisitionMethod === 'paid' && price) formData.append('price', parseFloat(price).toFixed(2));
            if (acquisitionMethod === 'password' && password) formData.append('password', password);

            if (iconFile) formData.append('icon', iconFile);
            if (bannerFile) formData.append('banner', bannerFile);

            const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/modpacks`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.detail || `Error ${res.status}`);
            }

            const created = await res.json();
            toast.success('¡Modpack creado con éxito!');
            resetForm();
            onClose();
            onSuccess?.(created);
        } catch (error: any) {
            console.error(error);
            toast.error('Error al crear el modpack', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    // Renderizado condicional del contenido según el paso
    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid gap-4">
                            <div>
                                <label className="text-sm font-medium text-zinc-200 mb-1.5 block">Nombre del Modpack</label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: Aventura Épica"
                                    className="bg-zinc-800 border-zinc-700 focus:border-emerald-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-200 mb-1.5 block flex justify-between">
                                    <span>Slug</span>
                                    <span className="text-xs text-zinc-500 font-normal">URL amigable</span>
                                </label>
                                <Input
                                    value={slug}
                                    readOnly
                                    className="bg-zinc-900/50 border-zinc-800 text-zinc-500 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-200 mb-1.5 block">Descripción Corta</label>
                                <Input
                                    value={shortDescription}
                                    onChange={(e) => setShortDescription(e.target.value)}
                                    placeholder="Una breve frase que describa tu modpack..."
                                    className="bg-zinc-800 border-zinc-700"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-200 mb-1.5 block">Descripción Completa (Opcional)</label>
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={4}
                                    className="bg-zinc-800 border-zinc-700 resize-none"
                                    placeholder="Detalles sobre mods, historia, etc."
                                />
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mb-4">
                            <p className="text-sm text-blue-200 flex items-center gap-2">
                                <Info size={16} />
                                Las imágenes atractivas aumentan las descargas.
                            </p>
                        </div>
                        <ImageUploader
                            id="icon-upload"
                            label="Icono"
                            description="Se muestra en listas y lanzador (Cuadrado 1:1)"
                            onFileChange={setIconFile}
                        />
                        <ImageUploader
                            id="banner-upload"
                            label="Banner"
                            description="Cabecera de la página del modpack (Panorámico)"
                            onFileChange={setBannerFile}
                        />
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300 h-[400px] flex flex-col">
                        <div className="flex-1 overflow-y-auto pr-1">
                            <CategorySelector
                                selectedCategories={selectedCategories}
                                primaryCategoryId={primaryCategoryId}
                                onCategoriesChange={setSelectedCategories}
                                onPrimaryCategoryChange={setPrimaryCategoryId}
                                disabled={loading}
                            />
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Visibilidad */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-200">Visibilidad</label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { id: 'public', label: 'Público', desc: 'Para todos' },
                                    { id: 'private', label: 'Privado', desc: 'Solo tú' },
                                    { id: 'patreon', label: 'Patreon', desc: 'Solo subs' }
                                ].map((opt) => (
                                    <div
                                        key={opt.id}
                                        onClick={() => setVisibility(opt.id as any)}
                                        className={cn(
                                            "cursor-pointer rounded-lg border p-3 transition-all hover:bg-zinc-800",
                                            visibility === opt.id
                                                ? "bg-zinc-800 border-emerald-500 ring-1 ring-emerald-500"
                                                : "bg-zinc-900 border-zinc-700"
                                        )}
                                    >
                                        <div className="font-medium text-sm text-white">{opt.label}</div>
                                        <div className="text-xs text-zinc-500">{opt.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-200">Método de Acceso</label>
                            <Select value={acquisitionMethod} onValueChange={(v: any) => setAcquisitionMethod(v)}>
                                <SelectTrigger className="w-full bg-zinc-800 border-zinc-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-800 border-zinc-700">
                                    <SelectItem value="free">Gratuito</SelectItem>
                                    <SelectItem value="paid">De pago (USD)</SelectItem>
                                    <SelectItem value="password">Con Contraseña</SelectItem>
                                </SelectContent>
                            </Select>

                            {acquisitionMethod === 'paid' && (
                                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 space-y-2 animate-in slide-in-from-top-2">
                                    <label className="text-sm text-zinc-300">Precio (USD)</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={price}
                                            onChange={(e) => setPrice(e.target.value)}
                                            className="pl-9 bg-zinc-900 border-zinc-700"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-xs text-amber-500/80">⚠️ No podrás cambiar a gratuito después.</p>
                                </div>
                            )}

                            {acquisitionMethod === 'password' && (
                                <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 space-y-2 animate-in slide-in-from-top-2">
                                    <label className="text-sm text-zinc-300">Establecer Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                        <Input
                                            type="text" // Visible para que el usuario sepa qué pone
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-9 bg-zinc-900 border-zinc-700"
                                            placeholder="secreto123"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800 text-white p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header con Stepper */}
                <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold mb-6">Crear nuevo modpack</DialogTitle>

                    {/* Visual Stepper */}
                    <div className="flex items-center justify-between relative">
                        {/* Línea de fondo */}
                        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-zinc-800 -z-10" />

                        {STEPS.map((step, index) => {
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            const Icon = step.icon;

                            return (
                                <div key={step.id} className="flex flex-col items-center bg-zinc-900 px-2">
                                    <div
                                        className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                                            isActive ? "border-emerald-500 bg-zinc-900 text-emerald-500 scale-110" :
                                                isCompleted ? "border-emerald-500 bg-emerald-500 text-black" :
                                                    "border-zinc-700 bg-zinc-900 text-zinc-600"
                                        )}
                                    >
                                        {isCompleted ? <Check size={16} /> : <Icon size={14} />}
                                    </div>
                                    <span className={cn(
                                        "text-xs mt-2 font-medium transition-colors",
                                        isActive ? "text-white" :
                                            isCompleted ? "text-emerald-500" : "text-zinc-600"
                                    )}>
                                        {step.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 flex-1 overflow-y-auto">
                    {renderStepContent()}
                </div>

                {/* Footer Fijo */}
                <DialogFooter className="p-4 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                    <div className="flex justify-between w-full">
                        <Button
                            variant="ghost"
                            onClick={currentStep === 1 ? onClose : handleBack}
                            className="text-zinc-400 hover:text-white"
                        >
                            {currentStep === 1 ? 'Cancelar' : 'Atrás'}
                        </Button>

                        <Button
                            onClick={currentStep === STEPS.length ? handleSubmit : handleNext}
                            disabled={loading}
                            className={cn(
                                "gap-2 min-w-[120px]",
                                currentStep === STEPS.length ? "bg-emerald-600 hover:bg-emerald-700" : "bg-white text-black hover:bg-zinc-200"
                            )}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">Creando...</span>
                            ) : currentStep === STEPS.length ? (
                                <>Finalizar <Check size={16} /></>
                            ) : (
                                <>Siguiente <ChevronRight size={16} /></>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateModpackDialog;