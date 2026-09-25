import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { HCaptchaWrapper, HCaptcha_HEADER } from '@/components/ui/hcaptcha';
import { toast } from 'sonner';
import { Modpack } from '@/types/modpacks';
import {
    LucidePackage,
    LucideUploadCloud,
    LucideCheck,
    LucideArrowRight,
    LucideArrowLeft,
    LucideInfo,
    LucideLock,
    LucideEye,
    LucideImage,
    LucideTag,
    LucideGlobe,
    LucideCrown,
    LucideX,
    LucideSparkles,
    LucideLink,
    LucideShieldCheck,
    LucideLayers,
    LucideKeyRound,
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from '@/consts';
import { CategorySelector } from '@/components/CategorySelector';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

export interface CreateModpackDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (created?: Modpack) => void;
    creatorId?: string;
}

// Steps configuration
const STEPS = [
    { id: 1, title: 'Detalles', icon: LucideInfo, desc: 'Nombre y descripción' },
    { id: 2, title: 'Multimedia', icon: LucideImage, desc: 'Icono y portada' },
    { id: 3, title: 'Categorías', icon: LucideTag, desc: 'Temática del pack' },
    { id: 4, title: 'Acceso', icon: LucideShieldCheck, desc: 'Visibilidad y clave' },
];

interface ImageUploadBoxProps {
    id: string;
    label: string;
    description: string;
    file: File | null;
    aspectRatio: 'square' | 'banner';
    onFileChange: (file: File | null) => void;
}

const ImageUploadBox: React.FC<ImageUploadBoxProps> = ({
    id,
    label,
    description,
    file,
    aspectRatio,
    onFileChange,
}) => {
    const [preview, setPreview] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && droppedFile.type.startsWith('image/')) {
            onFileChange(droppedFile);
        } else {
            toast.error('Por favor sube un archivo de imagen válido (PNG o JPG)');
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 block">
                        {label}
                    </label>
                    <p className="text-[11px] text-neutral-400">{description}</p>
                </div>
                {file && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onFileChange(null)}
                        className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2"
                    >
                        <LucideX className="h-3 w-3 mr-1" /> Quitar
                    </Button>
                )}
            </div>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={cn(
                    'relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-4 group',
                    aspectRatio === 'square' ? 'h-40 sm:h-44' : 'h-36 sm:h-40',
                    isDragging
                        ? 'border-primary bg-primary/10 scale-[1.01]'
                        : preview
                        ? 'border-white/[0.12] bg-black/40 hover:border-white/[0.25]'
                        : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.15]'
                )}
            >
                {preview ? (
                    <>
                        <img
                            src={preview}
                            alt={label}
                            className={cn(
                                'absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
                                aspectRatio === 'square' ? 'object-contain p-2' : 'object-cover'
                            )}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                            <span className="text-xs font-medium text-white px-3 py-1.5 rounded-lg bg-white/20 border border-white/20">
                                Cambiar imagen
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-center gap-2 text-neutral-400 group-hover:text-neutral-200">
                        <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-400 group-hover:text-primary group-hover:border-primary/30 group-hover:bg-primary/10 transition-all">
                            <LucideUploadCloud className="h-5 w-5" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-neutral-300 block">
                                Haz clic o arrastra tu archivo aquí
                            </span>
                            <span className="text-[11px] text-neutral-400">
                                PNG o JPG (Máx. 2MB)
                            </span>
                        </div>
                    </div>
                )}

                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        onFileChange(selected);
                    }}
                    className="hidden"
                />
            </div>
        </div>
    );
};

export const CreateModpackDialog: React.FC<CreateModpackDialogProps> = ({
    isOpen,
    onClose,
    onSuccess,
    creatorId,
}) => {
    const { sessionTokens } = useAuthentication();

    // Step state
    const [currentStep, setCurrentStep] = useState(1);

    // Form state
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);

    // Media
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);

    // Categories
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');

    // Access
    const [acquisitionMethod, setAcquisitionMethod] = useState<'free' | 'password'>('free');
    const [password, setPassword] = useState('');

    // Captcha
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);

    // Auto-generate slug
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
        setPassword('');
        setCurrentStep(1);
        setCaptchaToken(null);
    };

    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                if (!name.trim()) {
                    toast.error('El nombre del modpack es obligatorio');
                    return false;
                }
                if (!shortDescription.trim()) {
                    toast.error('Ingresa una breve descripción para tu modpack');
                    return false;
                }
                return true;
            case 2:
                return true;
            case 3:
                return true;
            case 4:
                if (acquisitionMethod === 'password' && !password.trim()) {
                    toast.error('Debes definir una contraseña de acceso');
                    return false;
                }
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
        }
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        if (!validateStep(4)) return;
        if (!creatorId) {
            toast.error('No se detectó el identificador del creador o publisher');
            return;
        }
        if (!captchaToken) {
            toast.error('Completa el captcha de seguridad para continuar');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('slug', slug.trim());
            formData.append('shortDescription', shortDescription.trim());
            formData.append('description', description.trim());
            formData.append('visibility', visibility);
            formData.append('categories', JSON.stringify(selectedCategories));
            formData.append('primaryCategoryId', primaryCategoryId);

            formData.append('acquisitionMethod', acquisitionMethod);
            if (acquisitionMethod === 'password' && password) {
                formData.append('password', password.trim());
            }

            if (iconFile) formData.append('icon', iconFile);
            if (bannerFile) formData.append('banner', bannerFile);

            const res = await fetch(`${API_ENDPOINT}/creators/${creatorId}/modpacks`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${sessionTokens?.accessToken}`,
                    [HCaptcha_HEADER]: captchaToken,
                },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.detail || err?.message || `Error del servidor (${res.status})`);
            }

            const created = await res.json();
            toast.success('¡Modpack creado exitosamente!');
            resetForm();
            onClose();
            onSuccess?.(created);
        } catch (error: any) {
            console.error('Error creating modpack:', error);
            toast.error('No se pudo crear el modpack', { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#0c0c10]/95 border border-white/[0.08] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] rounded-3xl flex flex-col max-h-[90vh] overflow-hidden text-neutral-100 ring-1 ring-white/[0.05]">
                {/* ── Top Header / Branding ── */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm shadow-primary/20">
                            <LucidePackage className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold tracking-tight text-white">Nuevo Modpack</h2>
                            <p className="text-xs text-neutral-400 mt-0.5">
                                Publica un nuevo paquete de mods para tu comunidad
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-50"
                        title="Cerrar"
                    >
                        <LucideX className="h-4 w-4" />
                    </button>
                </div>

                {/* ── Google TV-ish Segmented Step Pills ── */}
                <div className="px-6 pt-5 pb-3 border-b border-white/[0.04]">
                    <div className="grid grid-cols-4 gap-2 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                        {STEPS.map((step) => {
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            const StepIcon = step.icon;

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => {
                                        if (isCompleted && !loading) {
                                            setCurrentStep(step.id);
                                        }
                                    }}
                                    disabled={!isCompleted && !isActive}
                                    className={cn(
                                        'relative flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300',
                                        isActive
                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                                            : isCompleted
                                            ? 'text-neutral-300 hover:text-white hover:bg-white/[0.04] cursor-pointer'
                                            : 'text-neutral-500 cursor-not-allowed opacity-60'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                                            isActive
                                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                                : isCompleted
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-white/[0.08] text-neutral-400'
                                        )}
                                    >
                                        {isCompleted ? <LucideCheck className="h-3 w-3 text-emerald-400" /> : step.id}
                                    </div>
                                    <span className="truncate hidden sm:inline">{step.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Content Area with Smooth Motion Transitions ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        {/* STEP 1: Details */}
                        {currentStep === 1 && (
                            <motion.div
                                key="step-1"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-5"
                            >
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Nombre del Modpack <span className="text-red-400">*</span>
                                    </label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Fantasía Medieval, Tech Odyssey"
                                        className="bg-white/[0.03] border-white/[0.08] focus:border-primary text-white placeholder:text-neutral-500 h-12 text-sm rounded-xl px-4"
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                                            Identificador (Slug)
                                        </label>
                                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                                            <LucideLink className="h-3 w-3" /> URL amigable
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <Input
                                            value={slug}
                                            readOnly
                                            className="bg-white/[0.02] border-white/[0.05] text-neutral-400 h-10 text-xs rounded-xl px-4 cursor-not-allowed font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Descripción Corta <span className="text-red-400">*</span>
                                    </label>
                                    <Input
                                        value={shortDescription}
                                        onChange={(e) => setShortDescription(e.target.value)}
                                        placeholder="Una breve síntesis de qué trata tu modpack..."
                                        className="bg-white/[0.03] border-white/[0.08] focus:border-primary text-white placeholder:text-neutral-500 h-12 text-sm rounded-xl px-4"
                                    />
                                    <p className="text-[11px] text-neutral-400">
                                        Aparece en las tarjetas y resultados de búsqueda del lanzador.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Descripción Completa (Opcional)
                                    </label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={4}
                                        placeholder="Detalles sobre mods principales, misiones, guía de inicio o requisitos..."
                                        className="bg-white/[0.03] border-white/[0.08] focus:border-primary text-white placeholder:text-neutral-500 text-sm rounded-xl p-4 resize-none"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: Multimedia */}
                        {currentStep === 2 && (
                            <motion.div
                                key="step-2"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-6"
                            >
                                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3">
                                    <LucideSparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                    <p className="text-xs text-neutral-300 leading-relaxed">
                                        Los modpacks con un icono representativo y banner panorámico obtienen mayor visibilidad y descargas por parte de la comunidad.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <ImageUploadBox
                                        id="icon-upload"
                                        label="Icono del Modpack"
                                        description="Formato cuadrado (1:1), visible en listas y biblioteca"
                                        file={iconFile}
                                        aspectRatio="square"
                                        onFileChange={setIconFile}
                                    />

                                    <ImageUploadBox
                                        id="banner-upload"
                                        label="Banner de Cabecera"
                                        description="Formato panorámico (16:9), cabecera de la ficha"
                                        file={bannerFile}
                                        aspectRatio="banner"
                                        onFileChange={setBannerFile}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: Categories */}
                        {currentStep === 3 && (
                            <motion.div
                                key="step-3"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                                        Categorías del Modpack
                                    </label>
                                    <p className="text-xs text-neutral-400">
                                        Selecciona las categorías que mejor definan la experiencia de juego. Puedes marcar una como principal.
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] min-h-[300px]">
                                    <CategorySelector
                                        selectedCategories={selectedCategories}
                                        primaryCategoryId={primaryCategoryId}
                                        onCategoriesChange={setSelectedCategories}
                                        onPrimaryCategoryChange={setPrimaryCategoryId}
                                        disabled={loading}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 4: Access & Visibility */}
                        {currentStep === 4 && (
                            <motion.div
                                key="step-4"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.22 }}
                                className="space-y-6"
                            >
                                {/* Visibility Cards */}
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Nivel de Visibilidad
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            {
                                                id: 'public',
                                                label: 'Público',
                                                desc: 'Visible para todos los jugadores en la tienda',
                                                icon: LucideGlobe,
                                            },
                                            {
                                                id: 'private',
                                                label: 'Privado',
                                                desc: 'Solo accesible para ti y tu equipo de desarrollo',
                                                icon: LucideLock,
                                            },
                                            {
                                                id: 'patreon',
                                                label: 'Patreon / Subs',
                                                desc: 'Exclusivo para tus patrocinadores y miembros VIP',
                                                icon: LucideCrown,
                                            },
                                        ].map((opt) => {
                                            const isSelected = visibility === opt.id;
                                            const OptIcon = opt.icon;

                                            return (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setVisibility(opt.id as any)}
                                                    className={cn(
                                                        'p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3',
                                                        isSelected
                                                            ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-primary/40'
                                                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <div
                                                            className={cn(
                                                                'w-8 h-8 rounded-xl flex items-center justify-center',
                                                                isSelected ? 'bg-primary/20 text-primary' : 'bg-white/[0.04] text-neutral-400'
                                                            )}
                                                        >
                                                            <OptIcon className="h-4 w-4" />
                                                        </div>
                                                        {isSelected && (
                                                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                                                <LucideCheck className="h-3 w-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">{opt.label}</div>
                                                        <div className="text-[11px] text-neutral-400 mt-0.5 leading-snug">{opt.desc}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Access Method */}
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
                                        Método de Acceso a la Descarga
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setAcquisitionMethod('free')}
                                            className={cn(
                                                'p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer',
                                                acquisitionMethod === 'free'
                                                    ? 'bg-primary/10 border-primary/40 text-white'
                                                    : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                                            )}
                                        >
                                            <div className="text-xs font-bold text-white">Gratuito</div>
                                            <div className="text-[11px] text-neutral-400 mt-0.5">Cualquier usuario puede instalarlo</div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setAcquisitionMethod('password')}
                                            className={cn(
                                                'p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer',
                                                acquisitionMethod === 'password'
                                                    ? 'bg-primary/10 border-primary/40 text-white'
                                                    : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                                            )}
                                        >
                                            <div className="text-xs font-bold text-white">Con Contraseña</div>
                                            <div className="text-[11px] text-neutral-400 mt-0.5">Requiere clave para desbloquear</div>
                                        </button>
                                    </div>

                                    {acquisitionMethod === 'password' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2"
                                        >
                                            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                                                <LucideKeyRound className="h-3.5 w-3.5 text-primary" /> Clave de Acceso
                                            </label>
                                            <Input
                                                type="text"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Ej: evento-secreto-2026"
                                                className="bg-white/[0.03] border-white/[0.08] focus:border-primary text-white h-11 text-sm rounded-xl px-4"
                                            />
                                        </motion.div>
                                    )}
                                </div>

                                {/* Captcha */}
                                <div className="pt-2 flex justify-center">
                                    <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                                        <HCaptchaWrapper
                                            onVerify={setCaptchaToken}
                                            onExpire={() => setCaptchaToken(null)}
                                            onError={() => setCaptchaToken(null)}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Footer Actions ── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={currentStep === 1 ? onClose : handleBack}
                        disabled={loading}
                        className="text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-xl text-xs gap-1.5"
                    >
                        <LucideArrowLeft className="h-3.5 w-3.5" />
                        {currentStep === 1 ? 'Cancelar' : 'Atrás'}
                    </Button>

                    <Button
                        type="button"
                        onClick={currentStep === STEPS.length ? handleSubmit : handleNext}
                        disabled={loading || (currentStep === STEPS.length && !captchaToken)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs gap-1.5 shadow-md shadow-primary/25 min-w-[120px]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <LucideSparkles className="h-3.5 w-3.5 animate-spin" /> Creando...
                            </span>
                        ) : currentStep === STEPS.length ? (
                            <>
                                <LucideCheck className="h-3.5 w-3.5" />
                                Finalizar y Crear
                            </>
                        ) : (
                            <>
                                Siguiente
                                <LucideArrowRight className="h-3.5 w-3.5" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateModpackDialog;
