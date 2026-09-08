import React, { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { toast } from 'sonner';
import { Modpack } from '@/types/modpacks';
import { UploadCloud, X, Search, Check, AlertTriangle, Lock, Tv, Code } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { toml } from '@/lib/toml-lang';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { CategorySelector } from '@/components/CategorySelector';
import { ModpackStatusManager } from '@/components/creator/ModpackStatusManager';
import { resizeImage } from '@/utils/imageResize';
import { createAssetCompletionSource, resolveAssetReferences, clearAssetCache } from '@/lib/asset-completion';
import { autocomplete } from '@codemirror/autocomplete';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    modpack: Modpack | null;
}

const ImageUploader = ({ label, currentImageUrl, onFileChange, id, aspectRatio = "square" }: {
    label: string,
    currentImageUrl: string,
    onFileChange: (file: File | null) => void,
    id: string,
    aspectRatio?: "square" | "video"
}) => {
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => { setPreview(null); }, [currentImageUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreview(URL.createObjectURL(file));
            onFileChange(file);
        }
    };

    const clearImage = (e: React.MouseEvent) => {
        e.preventDefault();
        setPreview(null);
        onFileChange(null);
    };

    const activeImage = preview || currentImageUrl;

    return (
        <div className="group relative">
            <label className="text-sm font-medium text-zinc-300 block mb-2">{label}</label>
            <div className={`
                relative bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-zinc-500 
                rounded-lg flex flex-col items-center justify-center overflow-hidden transition-all cursor-pointer
                ${aspectRatio === 'video' ? 'w-full h-48' : 'size-32'}
            `}>
                {activeImage ? (
                    <>
                        <img src={activeImage} alt="Preview" className="size-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <label htmlFor={id} className="text-xs text-white font-medium cursor-pointer p-2">Cambiar imagen</label>
                        </div>
                        {preview && (
                            <button onClick={clearImage} className="absolute top-2 right-2 bg-red-500/80 p-1 rounded-full text-white hover:bg-red-600 transition-colors z-10">
                                <X size={14} />
                            </button>
                        )}
                    </>
                ) : (
                    <label htmlFor={id} className="flex flex-col items-center gap-2 cursor-pointer w-full h-full justify-center text-zinc-500 hover:text-zinc-300">
                        <UploadCloud size={32} />
                        <span className="text-xs">Click para subir</span>
                    </label>
                )}
                <input id={id} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>
        </div>
    );
};

export const EditModpackDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, modpack }) => {
    const { sessionTokens } = useAuthentication();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("general");

    const [formData, setFormData] = useState({
        name: '',
        shortDescription: '',
        description: '',
        visibility: 'public' as 'public' | 'private' | 'whitelist',
        password: '',
        confirmPassword: '',
        allowServerDownload: false,
    });

    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [primaryCategoryId, setPrimaryCategoryId] = useState<string>('');
    const [modpackStatus, setModpackStatus] = useState<'draft' | 'published' | 'archived' | 'deleted'>('draft');

    const [accessMode, setAccessMode] = useState<'free' | 'password'>('free');
    const [twitchAccessEnabled, setTwitchAccessEnabled] = useState(false);
    const [twitchChannels, setTwitchChannels] = useState<{ id: string; username: string; displayName: string; }[]>([]);

    const [channelSearchQuery, setChannelSearchQuery] = useState('');
    const [isSearchingChannels, setIsSearchingChannels] = useState(false);

    const [prelaunchToml, setPrelaunchToml] = useState('');
    const [isTomlValid, setIsTomlValid] = useState(true);

    // Clear asset cache when dialog opens
    useEffect(() => {
        if (isOpen) {
            clearAssetCache();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!modpack) return;

        setFormData({
            name: modpack.name || '',
            shortDescription: modpack.shortDescription || '',
            description: modpack.description || '',
            visibility: (modpack.visibility as any) || 'public',
            password: '',
            confirmPassword: '',
            allowServerDownload: modpack.allowServerDownload || false,
        });

        const catIds = modpack.categories?.map(c => c.categoryId) || [];
        const primCat = modpack.categories?.find(c => c.isPrimary)?.categoryId || '';
        setSelectedCategories(catIds);
        setPrimaryCategoryId(primCat);
        setModpackStatus(modpack.status as any || 'draft');

        let mode: 'free' | 'password' = 'free';
        if (modpack.password) mode = 'password';
        setAccessMode(mode);

        const raw = modpack.twitchChannels;
        const channels = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
        setTwitchChannels(channels);
        setTwitchAccessEnabled(channels.length > 0);

        try {
            const jsonObj = typeof modpack.prelaunchAppearance === 'string'
                ? JSON.parse(modpack.prelaunchAppearance || '{}')
                : modpack.prelaunchAppearance || {};
            setPrelaunchToml(jsonObj && Object.keys(jsonObj).length > 0 ? stringifyToml(jsonObj) : '');
        } catch {
            setPrelaunchToml('');
        }

        setIconFile(null);
        setBannerFile(null);
    }, [modpack, isOpen]);

    const handleTomlChange = (val: string) => {
        setPrelaunchToml(val);
        try {
            if (val.trim()) parseToml(val);
            setIsTomlValid(true);
        } catch {
            setIsTomlValid(false);
        }
    };

    const formatToml = () => {
        try {
            const parsed = parseToml(prelaunchToml);
            setPrelaunchToml(stringifyToml(parsed));
            setIsTomlValid(true);
        } catch {
            toast.error('TOML inválido, no se puede formatear');
        }
    };

    const searchTwitchChannel = async () => {
        if (!channelSearchQuery || channelSearchQuery.length < 2) return;
        setIsSearchingChannels(true);
        try {
            const res = await fetch(`${API_ENDPOINT}/explore/twitch-channels/search?query=${encodeURIComponent(channelSearchQuery)}`);
            const data = await res.json();
            if (data.channels?.[0]) {
                const channel = data.channels[0];
                if (!twitchChannels.find(c => c.id === channel.id)) {
                    setTwitchChannels(prev => [...prev, channel]);
                    setChannelSearchQuery('');
                    toast.success(`Canal añadido: ${channel.displayName}`);
                } else {
                    toast.error('El canal ya está en la lista');
                }
            } else {
                toast.error('Canal no encontrado');
            }
        } catch {
            toast.error('Error al buscar canal');
        } finally {
            setIsSearchingChannels(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modpack) return;
        if (!modpack.creatorId) { toast.error('Error interno: ID del creador no disponible'); return; }
        setLoading(true);

        try {
            const submission = new FormData();

            submission.append('name', formData.name);
            submission.append('shortDescription', formData.shortDescription);
            submission.append('description', formData.description);
            submission.append('visibility', formData.visibility);
            submission.append('status', modpackStatus);
            submission.append('acquisitionMethod', accessMode);
            submission.append('allowServerDownload', formData.allowServerDownload.toString());

            if (iconFile) submission.append('icon', await resizeImage(iconFile, 512));
            if (bannerFile) submission.append('banner', bannerFile);

            submission.append('categories', JSON.stringify(selectedCategories));
            if (primaryCategoryId) submission.append('primaryCategoryId', primaryCategoryId);

            if (!isTomlValid) throw new Error("TOML de apariencia inválido");
            if (prelaunchToml.trim()) {
                // Resolve @asset:ID references to actual URLs before saving
                const resolvedToml = modpack?.creatorId && sessionTokens?.accessToken
                    ? await resolveAssetReferences(prelaunchToml, modpack.creatorId, sessionTokens.accessToken)
                    : prelaunchToml;
                const parsed = parseToml(resolvedToml);
                submission.append('prelaunchAppearance', JSON.stringify(parsed));
            }

            if (accessMode === 'free') {
                if (twitchAccessEnabled && twitchChannels.length === 0) throw new Error("Añade al menos un canal de Twitch o desactiva la restricción.");
                submission.append('twitchChannels', JSON.stringify(twitchAccessEnabled ? twitchChannels : []));
            }

            if (accessMode === 'password') {
                if (formData.password) {
                    if (formData.password !== formData.confirmPassword) throw new Error("Las contraseñas no coinciden");
                    if (formData.password.length < 4) throw new Error("La contraseña es muy corta");
                    submission.append('password', formData.password);
                } else if (!modpack.password) {
                    throw new Error("Debes establecer una contraseña");
                }
            }

            const res = await fetch(`${API_ENDPOINT}/creators/${modpack.creatorId}/modpacks/${modpack.id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${sessionTokens?.accessToken}` },
                body: submission,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || err.error || "Error al actualizar");
            }

            toast.success('Modpack actualizado correctamente');
            onClose();
            onSuccess?.();

        } catch (error: any) {
            toast.error(error.message || 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl bg-zinc-950 border-zinc-800 text-white flex flex-col max-h-[90vh] p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-zinc-800">
                    <DialogTitle>Editar Modpack</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Gestiona los detalles, apariencia y acceso de "{modpack?.name}".
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 pt-2 bg-zinc-900/50 border-b border-zinc-800">
                            <TabsList className="bg-transparent gap-4 p-0 h-auto">
                                <TabTriggerItem value="general" label="General" />
                                <TabTriggerItem value="appearance" label="Apariencia" />
                                <TabTriggerItem value="access" label="Acceso" />
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">

                            <TabsContent value="general" className="mt-0 space-y-5">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-300">Nombre del Modpack</label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="bg-zinc-900 border-zinc-700 focus:ring-amber-600"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-300">Visibilidad</label>
                                            <Select
                                                value={formData.visibility}
                                                onValueChange={(v: any) => setFormData({ ...formData, visibility: v })}
                                            >
                                                <SelectTrigger className="bg-zinc-900 border-zinc-700">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="public">Público</SelectItem>
                                                    <SelectItem value="private">Privado</SelectItem>
                                                    <SelectItem value="whitelist">Whitelist</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <ModpackStatusManager
                                            currentStatus={modpackStatus}
                                            onStatusChange={setModpackStatus}
                                            disabled={loading}
                                            hasPrimaryCategory={true}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-300">Descripción Corta</label>
                                        <Input
                                            value={formData.shortDescription}
                                            onChange={e => setFormData({ ...formData, shortDescription: e.target.value })}
                                            className="bg-zinc-900 border-zinc-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-300">Descripción Completa</label>
                                        <Textarea
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="bg-zinc-900 border-zinc-700 min-h-[120px]"
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-zinc-800">
                                        <label className="text-sm font-medium text-zinc-300 mb-3 block">Categorías</label>
                                        <CategorySelector
                                            selectedCategories={selectedCategories}
                                            primaryCategoryId={primaryCategoryId}
                                            onCategoriesChange={setSelectedCategories}
                                            onPrimaryCategoryChange={setPrimaryCategoryId}
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="pt-4 border-t border-zinc-800">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-medium text-zinc-200">Descarga de Servidor</h4>
                                                <p className="text-xs text-zinc-500 mt-1">
                                                    Permitir a los usuarios descargar los archivos de servidor de este modpack.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={formData.allowServerDownload}
                                                onCheckedChange={(checked) => setFormData({ ...formData, allowServerDownload: checked })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="appearance" className="mt-0 space-y-6">
                                <div className="flex gap-8 items-start">
                                    <ImageUploader
                                        id="icon-upload"
                                        label="Icono (Cuadrado)"
                                        currentImageUrl={modpack?.iconUrl || ''}
                                        onFileChange={setIconFile}
                                    />
                                    <div className="flex-1">
                                        <ImageUploader
                                            id="banner-upload"
                                            label="Banner Principal (Panorámico)"
                                            currentImageUrl={modpack?.bannerUrl || ''}
                                            onFileChange={setBannerFile}
                                            aspectRatio="video"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-zinc-800">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex flex-col">
                                            <label className="text-sm font-medium text-zinc-300">Configuración Pre-Launch</label>
                                            <span className="text-xs text-zinc-500">Personalización avanzada de la ventana de carga (TOML).</span>
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={formatToml} disabled={!isTomlValid}>
                                            Formatear TOML
                                        </Button>
                                    </div>
                                    <div className={`border rounded-md overflow-hidden ${!isTomlValid ? 'border-red-500' : 'border-zinc-800'}`}>
                                        <CodeMirror
                                            value={prelaunchToml}
                                            onChange={handleTomlChange}
                                            extensions={[
                                                basicSetup,
                                                toml(),
                                                autocomplete({
                                                    override: modpack?.creatorId && sessionTokens?.accessToken
                                                        ? [createAssetCompletionSource(modpack.creatorId, sessionTokens.accessToken)]
                                                        : [],
                                                }),
                                            ]}
                                            theme={oneDark}
                                            className="text-sm"
                                            height="250px"
                                        />
                                    </div>
                                    {!isTomlValid && <p className="text-xs text-red-400 mt-2">Sintaxis TOML inválida.</p>}
                                </div>
                            </TabsContent>

                            <TabsContent value="access" className="mt-0 space-y-6">
                                <div>
                                    <label className="text-sm font-medium text-zinc-300 mb-3 block">Método de Adquisición</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <AccessCard
                                            active={accessMode === 'free'}
                                            onClick={() => setAccessMode('free')}
                                            icon={<Check className="text-green-400" />}
                                            title="Gratuito"
                                            desc="Acceso libre para todos"
                                        />
                                        <AccessCard
                                            active={accessMode === 'password'}
                                            onClick={() => setAccessMode('password')}
                                            icon={<Lock className="text-orange-400" />}
                                            title="Protegido"
                                            desc="Requiere contraseña"
                                        />
                                    </div>
                                </div>

                                {accessMode === 'free' && (
                                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-medium text-zinc-200 flex items-center gap-2">
                                                    <Tv size={16} className="text-purple-400" /> Restricción por Twitch
                                                </h3>
                                                <p className="text-xs text-zinc-500">Requiere suscripción a canales específicos.</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant={twitchAccessEnabled ? "default" : "outline"}
                                                className={twitchAccessEnabled ? "bg-purple-600 hover:bg-purple-700" : ""}
                                                onClick={() => setTwitchAccessEnabled(!twitchAccessEnabled)}
                                            >
                                                {twitchAccessEnabled ? "Activado" : "Desactivado"}
                                            </Button>
                                        </div>

                                        {twitchAccessEnabled && (
                                            <div className="bg-purple-950/20 border border-purple-900/50 rounded-lg p-4 space-y-3">
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <Search className="absolute left-2.5 top-2.5 text-zinc-500" size={14} />
                                                        <Input
                                                            placeholder="Buscar canal de Twitch..."
                                                            className="pl-8 bg-zinc-900 border-zinc-700"
                                                            value={channelSearchQuery}
                                                            onChange={(e) => setChannelSearchQuery(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchTwitchChannel())}
                                                        />
                                                    </div>
                                                    <Button type="button" onClick={searchTwitchChannel} disabled={isSearchingChannels}>
                                                        {isSearchingChannels ? "..." : "Añadir"}
                                                    </Button>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {Array.isArray(twitchChannels) && twitchChannels.map(channel => (
                                                        <div key={channel.id} className="bg-purple-900/40 border border-purple-500/30 px-3 py-1 rounded-full text-xs flex items-center gap-2">
                                                            <span className="text-purple-200">{channel.displayName}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setTwitchChannels(prev => prev.filter(c => c.id !== channel.id))}
                                                                className="text-purple-400 hover:text-white"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!Array.isArray(twitchChannels) || twitchChannels.length === 0) && <span className="text-xs text-zinc-500 italic">No hay canales añadidos.</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {accessMode === 'password' && (
                                    <div className="bg-orange-950/20 border border-orange-900/50 p-4 rounded-lg space-y-3 pt-4 border-t border-zinc-800">
                                        <div className="space-y-2">
                                            <label className="text-xs text-zinc-400">Nueva Contraseña</label>
                                            <Input
                                                type="password"
                                                placeholder="••••••"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                className="bg-zinc-900 border-zinc-700"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-zinc-400">Confirmar Contraseña</label>
                                            <Input
                                                type="password"
                                                placeholder="••••••"
                                                value={formData.confirmPassword}
                                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                className={`bg-zinc-900 border-zinc-700 ${formData.password !== formData.confirmPassword ? 'border-red-500/50' : ''}`}
                                            />
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                        </div>

                        <DialogFooter className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/30">
                            <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="text-zinc-400 hover:text-white">
                                Cancelar
                            </Button>
                            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={loading || !isTomlValid}>
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </Button>
                        </DialogFooter>
                    </Tabs>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const TabTriggerItem = ({ value, label }: { value: string, label: string }) => (
    <TabsTrigger
        value={value}
        className="data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 rounded-full px-4 py-1.5 text-xs transition-all"
    >
        {label}
    </TabsTrigger>
);

const AccessCard = ({ active, onClick, icon, title, desc }: any) => (
    <div
        onClick={onClick}
        className={`
            cursor-pointer border rounded-lg p-4 flex flex-col gap-2 transition-all
            ${active ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-500' : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50'}
        `}
    >
        <div className="flex justify-between items-start">
            {icon}
            {active && <div className="size-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
        </div>
        <div>
            <div className="font-medium text-sm text-zinc-200">{title}</div>
            <div className="text-xs text-zinc-500">{desc}</div>
        </div>
    </div>
);

export default EditModpackDialog;
