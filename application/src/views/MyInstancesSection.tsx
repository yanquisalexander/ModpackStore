import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { CreateInstanceDialog } from "@/components/CreateInstanceDialog";
import { ImportMrpackDialog } from "@/components/ImportMrpackDialog";
import { InstanceCard } from "@/components/InstanceCard";
import { trackSectionView } from "@/lib/analytics";
import { sleep } from "@/lib/utils";
import { useGlobalContext } from "@/stores/GlobalContext";
import { useInstances } from "@/stores/InstancesContext";
import { useTasksContext } from "@/stores/TasksContext";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { useConnection } from "@/utils/ConnectionContext";
import { invoke } from "@tauri-apps/api/core";
import { LucidePackageOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner";
import type { MrpackManifest, MrpackCompatibility } from "@/types/mrpack";


export const MyInstancesSection = ({ offlineMode }: { offlineMode?: boolean }) => {
    const { setTitleBarState } = useGlobalContext()
    const { hasInternetAccess } = useConnection()
    const { instances: instancesOnContext } = useInstances()
    const { instancesBootstraping } = useTasksContext()

    const [instances, setInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDragging, setIsDragging] = useState(false)

    const fetchInstances = useCallback(async () => {
        setIsLoading(true)
        try {
            await sleep(1000) // Simulate a short delay for better UX
            const instances = await invoke('get_all_instances') as any
            setInstances(instances)
        } catch (error) {
            console.error('Error fetching instances:', error)
            // In offline mode, we can still show an empty list or cached data
            setInstances([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInstances()
    }, []) // Sin dependencias para que se ejecute solo al montar

    useEffect(() => {
        if (offlineMode) return // Prevents setting title bar state if in offline mode
        setTitleBarState({
            title: "Mis instancias",
            icon: LucidePackageOpen,
            canGoBack: true,
            customIconClassName: "bg-yellow-500/10",
            opaque: true,
        });

        trackSectionView("my-instances")
    }, [offlineMode, setTitleBarState])

    const isBootstrapping = useCallback((instanceId: string) => {
        return instancesBootstraping.some((id) => id === instanceId)
    }, [instancesBootstraping])

    const isRunning = useCallback((instanceId: string) => {
        return instancesOnContext.some((i) => i.id === instanceId && i.status === "running")
    }, [instancesOnContext])

    const handleInstanceUpdated = useCallback((updatedInstance: TauriCommandReturns['get_instance_by_id']) => {
        setInstances(prevInstances =>
            prevInstances.map(inst =>
                inst?.instanceId === updatedInstance?.instanceId ? updatedInstance : inst
            )
        )
    }, [])

    // Drag and drop handlers for .mrpack files
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = Array.from(e.dataTransfer.files)
        const mrpackFiles = files.filter(file => file.name.toLowerCase().endsWith('.mrpack'))

        if (mrpackFiles.length === 0) {
            toast.error('Por favor, arrastra un archivo .mrpack válido')
            return
        }

        if (mrpackFiles.length > 1) {
            toast.error('Solo puedes importar un archivo .mrpack a la vez')
            return
        }

        const mrpackFile = mrpackFiles[0]

        console.log('Archivo .mrpack detectado:', mrpackFile)
        const filePath = (mrpackFile as any).path || ''

        if (!filePath) {
            toast.error('No se pudo obtener la ruta del archivo')
            return
        }

        try {
            // Validate and read manifest
            const manifestData = await invoke<MrpackManifest>('validate_mrpack_file', {
                mrpackPath: filePath,
            })

            // Check compatibility
            const compatibilityData = await invoke<MrpackCompatibility>(
                'check_mrpack_compatibility',
                { manifest: manifestData }
            )

            if (!compatibilityData.is_compatible) {
                toast.error('Modpack no compatible', {
                    description: compatibilityData.errors.join('\n'),
                })
                return
            }

            // Ask user for confirmation
            const instanceName = manifestData.name

            toast.promise(
                invoke<string>('create_instance_from_mrpack', {
                    mrpackPath: filePath,
                    instanceName: instanceName,
                }),
                {
                    loading: `Importando ${instanceName}...`,
                    success: () => {
                        fetchInstances()
                        return `${instanceName} importado exitosamente`
                    },
                    error: (error) => `Error al importar: ${error}`,
                }
            )
        } catch (error) {
            console.error('Error al procesar archivo .mrpack:', error)
            toast.error('Error al leer el archivo .mrpack', {
                description: String(error),
            })
        }
    }, [])


    return (
        <div
            className="mx-auto max-w-7xl px-8 py-10 overflow-y-auto h-full"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="fixed inset-0 bg-purple-500/20 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
                    <div className="bg-gray-900/90 border-2 border-dashed border-purple-400 rounded-xl p-8 text-center">
                        <LucidePackageOpen className="h-16 w-16 text-purple-400 mx-auto mb-4" />
                        <p className="text-xl font-semibold text-purple-300">
                            Suelta el archivo .mrpack aquí
                        </p>
                    </div>
                </div>
            )}

            <header className="flex flex-col mb-16">
                <h1 className="tracking-tight inline font-semibold text-2xl bg-gradient-to-b from-teal-200 to-teal-500 bg-clip-text text-transparent">
                    Mis instancias
                </h1>
                <p className="text-gray-400 text-base max-w-2xl">
                    Aquí puedes ver y gestionar todas tus instancias de Modpack Store.
                </p>
            </header>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-64">
                    <ArmadilloLoading className="h-14" />
                    <p className="text-neutral-400 font-minecraft-ten tracking-wider text-sm mt-2">Cargando instancias...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {instances.filter(instance => instance != null).map((instance) => (
                        <InstanceCard
                            key={instance.instanceId}
                            instance={instance}
                            isBootstrapping={isBootstrapping(instance.instanceId)}
                            onInstanceUpdated={handleInstanceUpdated}
                            onInstanceDeleted={fetchInstances}
                            running={isRunning(instance.instanceId)}
                        />
                    ))}
                    {
                        (!offlineMode || hasInternetAccess) && (
                            <>
                                <CreateInstanceDialog
                                    instanceNames={instances.map((i) => i.instanceName)}
                                    onInstanceCreated={fetchInstances} />
                                <ImportMrpackDialog onInstanceCreated={fetchInstances} />
                            </>
                        )
                    }
                </div>
            )}
        </div >
    )
}