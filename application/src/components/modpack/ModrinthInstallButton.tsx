import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LucideDownload, LucideExternalLink, LucideLoader, LucideTriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ModpackVersionPublic } from "@/services/getModpackVersions";
import { cn } from "@/lib/utils";

interface Props {
    modpackName: string;
    externalUrl?: string | null;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    versions: ModpackVersionPublic[];
    selectedVersionId: string;
    className?: string;
}

export const ModrinthInstallButton = ({
    modpackName,
    externalUrl,
    iconUrl,
    bannerUrl,
    versions,
    selectedVersionId,
    className,
}: Props) => {
    const navigate = useNavigate();
    const [instanceName, setInstanceName] = useState(modpackName);
    const [isInstalling, setIsInstalling] = useState(false);

    const selected =
        selectedVersionId === "latest"
            ? versions[0] ?? null
            : versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;

    const mrpackUrl = (selected as any)?.mrpackUrl as string | null | undefined;
    const loader = (selected?.loaderType ?? "").toLowerCase();
    const knownLoaders = ["forge", "fabric", "quilt", "neoforge", "vanilla", "unknown"];
    const unknownLoader = loader !== "" && !knownLoaders.includes(loader);

    const handleInstall = async () => {
        if (!selected) {
            toast.error("No hay versión disponible para instalar");
            return;
        }
        if (!mrpackUrl) {
            toast.error("Esta versión no tiene .mrpack descargable", {
                description: "Abre la página de Modrinth para descargarlo manualmente.",
            });
            return;
        }
        const name = instanceName.trim() || modpackName;
        setIsInstalling(true);
        try {
            await invoke<string>("create_instance_from_mrpack_url", {
                mrpackUrl,
                instanceName: name,
                iconUrl: iconUrl ?? null,
                bannerUrl: bannerUrl ?? null,
            });
            toast.success("Creando instancia...", {
                description: `Tu instancia "${name}" se está importando desde Modrinth. Revisa el progreso en el Task Manager.`,
            });
            navigate("/my-instances");
        } catch (err) {
            console.error("Error installing from Modrinth:", err);
            toast.error("No se pudo instalar", {
                description: typeof err === "string" ? err : "Error desconocido al descargar el .mrpack.",
            });
        } finally {
            setIsInstalling(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="Nombre de la instancia"
                    className="h-12 max-w-xs bg-white/5 border-white/10"
                />
                <Button
                    onClick={handleInstall}
                    disabled={isInstalling || !mrpackUrl}
                    className="h-12 px-8 bg-[#1bd96a] hover:bg-[#1bd96a]/90 text-black font-bold flex items-center gap-2"
                >
                    {isInstalling ? (
                        <LucideLoader className="animate-spin" size={18} />
                    ) : (
                        <LucideDownload size={18} />
                    )}
                    {isInstalling ? "Descargando..." : "Instalar desde Modrinth"}
                </Button>
                {externalUrl && (
                    <Button
                        variant="outline"
                        onClick={() => openUrl(externalUrl).catch(console.error)}
                        className="h-12 border-white/10 hover:bg-white/5"
                    >
                        <LucideExternalLink size={16} className="mr-2" />
                        Ver en Modrinth
                    </Button>
                )}
            </div>
            {unknownLoader && (
                <p className="flex items-center gap-2 text-xs text-amber-400/90">
                    <LucideTriangleAlert size={14} />
                    Este modpack usa un loader no reconocido ({loader}) — la instalación puede fallar.
                </p>
            )}
            {!mrpackUrl && (
                <p className="text-xs text-neutral-500">
                    Esta versión no expone un .mrpack directo. Usa “Ver en Modrinth”.
                </p>
            )}
        </div>
    );
};
