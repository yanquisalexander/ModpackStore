import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, UploadCloud, FileArchive, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createModpackVersion, getModpack, ApiError, uploadModpackVersionFile } from "@/services/userModpacks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Modpack } from "@/types/modpacks";

export const NewModpackVersionPage = () => {
    const params = useParams<{ modpackId: string }>();
    const [, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modpack, setModpack] = useState<Modpack | null>(null);
    
    // Form fields
    const [version, setVersion] = useState("");
    const [mcVersion, setMcVersion] = useState("");
    const [forgeVersion, setForgeVersion] = useState("");
    const [changelog, setChangelog] = useState("");
    const [modsZip, setModsZip] = useState<File | null>(null);
    const [configsZip, setConfigsZip] = useState<File | null>(null);
    const [resourcesZip, setResourcesZip] = useState<File | null>(null);
    
    // Refs for file inputs
    const modsInput = useRef<HTMLInputElement>(null);
    const configsInput = useRef<HTMLInputElement>(null);
    const resourcesInput = useRef<HTMLInputElement>(null);
    
    // Error states
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Drag & drop handlers
    const handleDrop = (e: React.DragEvent, setter: (f: File) => void) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setter(e.dataTransfer.files[0]);
        }
    };
    
    // Fetch modpack details on component mount
    useEffect(() => {
        const fetchModpack = async () => {
            if (!params.modpackId) return;
            
            setIsLoading(true);
            try {
                const data = await getModpack(params.modpackId);
                setModpack(data);
            } catch (error) {
                console.error("Error fetching modpack:", error);
                toast.error("Error", {
                    description: "No se pudo cargar la información del modpack."
                });
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchModpack();
    }, [params.modpackId]);
    
    // Form validation
    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        
        if (!version.trim()) newErrors.version = "La versión es obligatoria";
        if (!mcVersion.trim()) newErrors.mcVersion = "La versión de Minecraft es obligatoria";
        if (!changelog.trim()) newErrors.changelog = "El changelog es obligatorio";
        if (!modsZip) newErrors.modsZip = "El archivo de mods es obligatorio";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) return;
        
        setIsSubmitting(true);
        try {
            // First create the version in the database
            const versionData = {
                version,
                mcVersion,
                forgeVersion: forgeVersion || null,
                changelog
            };
            
            const createdVersion = await createModpackVersion(params.modpackId!, versionData);
            
            // Upload the mods file (required)
            if (modsZip) {
                await uploadModpackVersionFile(createdVersion.id, modsZip, 'mods');
            }
            
            // Upload optional files if provided
            if (configsZip) {
                await uploadModpackVersionFile(createdVersion.id, configsZip, 'configs');
            }
            
            if (resourcesZip) {
                await uploadModpackVersionFile(createdVersion.id, resourcesZip, 'resources');
            }
            
            toast.success("Versión creada", {
                description: `La versión ${version} ha sido creada y los archivos subidos exitosamente.`
            });
            
            // Redirect back to versions page
            setLocation(`/creators/modpacks/${params.modpackId}/versions`);
        } catch (error) {
            console.error("Error creating version:", error);
            if (error instanceof ApiError) {
                if (error.field) {
                    setErrors({
                        ...errors,
                        [error.field]: error.message
                    });
                } else {
                    toast.error("Error", { description: error.message });
                }
            } else {
                toast.error("Error", { 
                    description: "Ocurrió un error al crear la versión o subir los archivos. Inténtalo de nuevo."
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-8">
            <button className="flex items-center gap-2 text-neutral-400 hover:text-white mb-8" onClick={() => setLocation(-1)}>
                <ChevronLeft size={18} /> Volver
            </button>
            
            {isLoading ? (
                <div className="flex justify-center items-center py-12">
                    <div className="animate-spin mr-2">
                        <UploadCloud size={24} />
                    </div>
                    <span>Cargando información del modpack...</span>
                </div>
            ) : (
                <>
                    <h1 className="text-2xl font-bold mb-2">
                        Subir nueva versión {modpack && `para ${modpack.name}`}
                    </h1>
                    <p className="text-gray-500 mb-6">Completa el formulario para crear una nueva versión del modpack</p>
                    
                    <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                        {/* Version fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="version">Versión</Label>
                                <Input
                                    id="version"
                                    value={version}
                                    onChange={e => setVersion(e.target.value)}
                                    placeholder="1.0.0"
                                    className={errors.version ? "border-red-500" : ""}
                                />
                                {errors.version && (
                                    <p className="text-red-500 text-xs mt-1">{errors.version}</p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="mcVersion">Versión de Minecraft</Label>
                                <Input
                                    id="mcVersion"
                                    value={mcVersion}
                                    onChange={e => setMcVersion(e.target.value)}
                                    placeholder="1.19.2"
                                    className={errors.mcVersion ? "border-red-500" : ""}
                                />
                                {errors.mcVersion && (
                                    <p className="text-red-500 text-xs mt-1">{errors.mcVersion}</p>
                                )}
                            </div>
                        </div>
                        
                        <div>
                            <Label htmlFor="forgeVersion">Versión de Forge (opcional)</Label>
                            <Input
                                id="forgeVersion"
                                value={forgeVersion}
                                onChange={e => setForgeVersion(e.target.value)}
                                placeholder="43.2.0"
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="changelog" className={errors.changelog ? "text-red-500" : ""}>Changelog</Label>
                            <textarea 
                                id="changelog"
                                value={changelog} 
                                onChange={e => setChangelog(e.target.value)} 
                                className={`w-full rounded border px-3 py-2 min-h-[120px] ${errors.changelog ? "border-red-500" : ""}`} 
                                placeholder="¿Qué hay de nuevo en esta versión?" 
                            />
                            {errors.changelog && (
                                <p className="text-red-500 text-xs mt-1">{errors.changelog}</p>
                            )}
                        </div>
                        
                        <div className="border-t pt-4 mt-2">
                            <h3 className="text-lg font-medium mb-3">Archivos del modpack</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Sube los archivos necesarios para esta versión del modpack. El archivo de mods es obligatorio.
                            </p>
                        </div>
                        
                        <div>
                            <Label htmlFor="modsZip" className={errors.modsZip ? "text-red-500" : ""}>Mods (.zip)</Label>
                            <div
                                className={`border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 ${errors.modsZip ? "border-red-500" : ""}`}
                                onClick={() => modsInput.current?.click()}
                                onDrop={e => handleDrop(e, f => setModsZip(f))}
                                onDragOver={e => e.preventDefault()}
                            >
                                <FileArchive size={32} className="mb-2" />
                                {modsZip ? modsZip.name : "Arrastra aquí el ZIP de mods o haz click para seleccionar"}
                                <input ref={modsInput} type="file" accept=".zip" className="hidden" onChange={e => setModsZip(e.target.files?.[0] || null)} />
                            </div>
                            {errors.modsZip && (
                                <p className="text-red-500 text-xs mt-1">{errors.modsZip}</p>
                            )}
                        </div>
                        
                        <div>
                            <Label htmlFor="configsZip">Configs (.zip) - Opcional</Label>
                            <div
                                className="border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                onClick={() => configsInput.current?.click()}
                                onDrop={e => handleDrop(e, f => setConfigsZip(f))}
                                onDragOver={e => e.preventDefault()}
                            >
                                <FileArchive size={32} className="mb-2" />
                                {configsZip ? configsZip.name : "Arrastra aquí el ZIP de configs o haz click para seleccionar"}
                                <input ref={configsInput} type="file" accept=".zip" className="hidden" onChange={e => setConfigsZip(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                        
                        <div>
                            <Label htmlFor="resourcesZip">Resources (.zip) - Opcional</Label>
                            <div
                                className="border-dashed border-2 rounded p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                onClick={() => resourcesInput.current?.click()}
                                onDrop={e => handleDrop(e, f => setResourcesZip(f))}
                                onDragOver={e => e.preventDefault()}
                            >
                                <FileArchive size={32} className="mb-2" />
                                {resourcesZip ? resourcesZip.name : "Arrastra aquí el ZIP de resources o haz click para seleccionar"}
                                <input ref={resourcesInput} type="file" accept=".zip" className="hidden" onChange={e => setResourcesZip(e.target.files?.[0] || null)} />
                            </div>
                        </div>
                        
                        <Button 
                            type="submit" 
                            className="mt-6 flex items-center gap-2"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin mr-2">
                                        <UploadCloud size={18} />
                                    </div>
                                    Subiendo...
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={18} /> Subir versión
                                </>
                            )}
                        </Button>
                    </form>
                </>
            )}
        </div>
    );
};
