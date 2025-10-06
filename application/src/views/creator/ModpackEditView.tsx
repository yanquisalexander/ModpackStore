import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUploadComponent } from '@/components/ui/file-upload';
import { ArrowLeft, FileText, LucideEye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthentication } from '@/stores/AuthContext';
import { useGlobalContext } from '@/stores/GlobalContext';
import { API_ENDPOINT } from '@/consts';
import { Modpack } from '@/types/modpacks';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ModpackEditViewProps {
    teams: any[];
}

export const ModpackEditView: React.FC<ModpackEditViewProps> = ({ teams }) => {
    const { orgId, modpackId } = useParams<{ orgId: string; modpackId: string }>();
    const navigate = useNavigate();
    const { sessionTokens } = useAuthentication();
    const { setTitleBarState } = useGlobalContext();

    // Form state
    const [modpack, setModpack] = useState<Modpack | null>(null);
    const [name, setName] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(true);
    const [showDescriptionPreview, setShowDescriptionPreview] = useState(false);

    // File upload state
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [bannerFile, setBannerFile] = useState<File | null>(null);
    const iconUploadRef = useRef<any>(null);
    const bannerUploadRef = useRef<any>(null);

    // Fetch modpack data
    useEffect(() => {
        const fetchModpack = async () => {
            if (!orgId || !modpackId || !sessionTokens?.accessToken) return;

            try {
                const response = await fetch(`${API_ENDPOINT}/creators/publishers/${orgId}/modpacks/${modpackId}`, {
                    headers: {
                        'Authorization': `Bearer ${sessionTokens.accessToken}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch modpack');
                }

                const modpackData = await response.json();
                setModpack(modpackData);
                setName(modpackData.name || '');
                setShortDescription(modpackData.shortDescription || '');
                setDescription(modpackData.description || '');
                setVisibility(modpackData.visibility || 'public');
            } catch (error) {
                console.error('Error fetching modpack:', error);
                toast.error('Error al cargar el modpack');
                navigate(`/creators/org/${orgId}/modpacks`);
            } finally {
                setFetchLoading(false);
            }
        };

        fetchModpack();
    }, [orgId, modpackId, sessionTokens?.accessToken, navigate]);

    // Update title bar
    useEffect(() => {
        if (modpack) {
            setTitleBarState({
                title: `${modpack.name} - Panel de Publisher`,
                canGoBack: { history: true },
                opaque: true,
                icon: FileText,
                customIconClassName: "text-blue-500",
            });
        }

        return () => {
            // Reset title bar when component unmounts
            setTitleBarState({
                title: "Creators Dashboard",
                canGoBack: true,
                opaque: true,
            });
        };
    }, [modpack, setTitleBarState]);

    const handleBack = () => {
        navigate(`/creators/org/${orgId}/modpacks`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modpack) return;

        setLoading(true);
        try {
            const formData = new FormData();

            // Add text fields
            formData.append('name', name);
            formData.append('shortDescription', shortDescription);
            formData.append('description', description);
            formData.append('visibility', visibility);

            // Add files if selected
            if (iconFile) {
                formData.append('icon', iconFile);
            }
            if (bannerFile) {
                formData.append('banner', bannerFile);
            }

            const response = await fetch(`${API_ENDPOINT}/creators/publishers/${orgId}/modpacks/${modpackId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => null);
                const message = error?.errors?.[0]?.detail || error?.detail || `Error ${response.status}`;
                toast.error('Error al actualizar modpack', { description: message });
                return;
            }

            toast.success('Modpack actualizado correctamente');
            navigate(`/creators/org/${orgId}/modpacks`);
        } catch (error) {
            console.error('Error updating modpack:', error);
            toast.error('Ocurrió un error inesperado al actualizar el modpack');
        } finally {
            setLoading(false);
        }
    };

    if (fetchLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando modpack...</p>
                </div>
            </div>
        );
    }

    if (!modpack) {
        return (
            <div className="text-center py-8">
                <p className="text-gray-600">Modpack no encontrado</p>
                <Button onClick={handleBack} className="mt-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a modpacks
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header with back button */}
            <div className="flex items-center gap-4 mb-6">
                <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Editar Modpack</h1>
                    <p className="text-gray-600">Modifica los detalles de "{modpack.name}"</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Información Básica</CardTitle>
                        <CardDescription>
                            Detalles principales del modpack
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">Nombre</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="Nombre del modpack"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1">Descripción Corta</label>
                            <Input
                                value={shortDescription}
                                onChange={(e) => setShortDescription(e.target.value)}
                                placeholder="Descripción breve del modpack"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium">Descripción (Markdown)</label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowDescriptionPreview(!showDescriptionPreview)}
                                >
                                    <LucideEye className="h-4 w-4 mr-2" />
                                    {showDescriptionPreview ? 'Editar' : 'Vista Previa'}
                                </Button>
                            </div>
                            {showDescriptionPreview ? (
                                <ScrollArea className="h-48 border rounded-md p-4 bg-muted/50">
                                    <div className="prose prose-sm dark:prose-invert max-w-none">
                                        <MarkdownRenderer 
                                            content={description || ""}
                                            className="text-sm"
                                        />
                                    </div>
                                </ScrollArea>
                            ) : (
                                <Textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={6}
                                    placeholder="Descripción detallada del modpack en formato Markdown&#10;&#10;Ejemplo:&#10;# Mi Modpack Épico&#10;Este es un modpack **increíble** con muchas aventuras.&#10;&#10;[youtube: https://youtube.com/watch?v=dQw4w9WgXcQ]&#10;&#10;## Características:&#10;- Mods de aventura&#10;- Nuevas dimensiones&#10;- ¡Y mucho más!"
                                    className="font-mono text-sm"
                                />
                            )}
                            {!showDescriptionPreview && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    💡 Soporta Markdown y componentes personalizados como <code>[youtube: URL]</code>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium block mb-1">Visibilidad</label>
                            <Select value={visibility} onValueChange={(value: any) => setVisibility(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="public">Público</SelectItem>
                                    <SelectItem value="private">Privado</SelectItem>
                                    <SelectItem value="patreon">Solo Patreon</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Image Upload Cards */}
                <FileUploadComponent
                    title="Icono del Modpack"
                    description="Imagen que representa tu modpack (recomendado: 512x512px)"
                    currentFileUrl={modpack.iconUrl}
                    accept="image/*"
                    maxSize={5 * 1024 * 1024} // 5MB
                    onFileSelect={setIconFile}
                />

                <FileUploadComponent
                    title="Banner del Modpack"
                    description="Imagen de portada para tu modpack (recomendado: 1920x1080px)"
                    currentFileUrl={modpack.bannerUrl}
                    accept="image/*"
                    maxSize={10 * 1024 * 1024} // 10MB
                    onFileSelect={setBannerFile}
                />

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleBack}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </div>
            </form>
        </div>
    );
};