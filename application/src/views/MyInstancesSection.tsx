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
import { LucidePackageOpen, LucidePlus, LucideImport } from "lucide-react";
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner";
import type { MrpackManifest, MrpackCompatibility } from "@/types/mrpack";
import { useActionLimit } from "@/hooks/useUserFlags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "motion/react";

export const MyInstancesSection = ({ offlineMode }: { offlineMode?: boolean }) => {
    const { setTitleBarState } = useGlobalContext()
    const { hasInternetAccess } = useConnection()
    const { instances: instancesOnContext } = useInstances()
    const { instancesBootstraping } = useTasksContext()

    const [instances, setInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDragging, setIsDragging] = useState(false)

    const { allowed, limit, remaining } = useActionLimit('max_instances_allowed', instances.length)

    const fetchInstances = useCallback(async () => {
        setIsLoading(true)
        try {
            await sleep(1000) // Simulate a short delay for better UX
            const instances = await invoke('get_all_instances') as any
            setInstances(instances)
        } catch (error) {
            console.error('Error fetching instances:', error)
            setInstances([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInstances()
    }, [])

    useEffect(() => {
        if (offlineMode) return
        setTitleBarState({
            title: "Mis instancias",
            icon: LucidePackageOpen,
            canGoBack: true,
            customIconClassName: "bg-teal-500/20 text-teal-400", // Adjusted to match theme
            opaque: false,
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

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        // Simple check to avoid flickering when dragging over child elements
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
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
        const filePath = (mrpackFile as any).path || ''

        if (!filePath) {
            toast.error('No se pudo obtener la ruta del archivo')
            return
        }

        try {
            const manifestData = await invoke<MrpackManifest>('validate_mrpack_file', { mrpackPath: filePath })
            const compatibilityData = await invoke<MrpackCompatibility>('check_mrpack_compatibility', { manifest: manifestData })

            if (!compatibilityData.is_compatible) {
                toast.error('Modpack no compatible', { description: compatibilityData.errors.join('\n') })
                return
            }

            const instanceName = manifestData.name
            toast.promise(
                invoke<string>('create_instance_from_mrpack', { mrpackPath: filePath, instanceName: instanceName }),
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
            toast.error('Error al leer el archivo .mrpack', { description: String(error) })
        }
    }, [])

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
    }

    return (
        <div
            className="relative min-h-dvh bg-[#0a0a0a] text-white overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Background Glows (Teal Theme) */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Drag & Drop Overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-8 pointer-events-none"
                    >
                        <div className="w-full h-full border-4 border-dashed border-teal-500/50 rounded-3xl flex flex-col items-center justify-center gap-6 bg-teal-500/5 animate-pulse">
                            <div className="p-6 rounded-full bg-teal-500/20">
                                <LucideImport className="h-16 w-16 text-teal-400" />
                            </div>
                            <h2 className="text-3xl font-bold text-teal-200">Suelta tu .mrpack aquí</h2>
                            <p className="text-teal-400/70">Importaremos tu modpack automáticamente</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <header className="mb-12 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                            <LucidePackageOpen className="w-6 h-6 text-teal-400" />
                        </div>
                        <h1 className="tracking-tight inline font-semibold text-3xl bg-gradient-to-b from-teal-200 to-teal-500 bg-clip-text text-transparent">
                            Mis Instancias
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                        Aquí vive tu colección de Minecraft. Juega, gestiona y crea nuevas aventuras.
                    </p>
                </header>

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <ArmadilloLoading className="w-16" />
                        <p className="text-neutral-200 font-minecraft-ten tracking-widest text-normal uppercase ">Cargando instancias...</p>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {/* Lista de Instancias */}
                        {instances.filter(instance => instance != null).map((instance) => (
                            <motion.div key={instance.instanceId} variants={itemVariants}>
                                <InstanceCard
                                    instance={instance}
                                    isBootstrapping={isBootstrapping(instance.instanceId)}
                                    onInstanceUpdated={handleInstanceUpdated}
                                    onInstanceDeleted={fetchInstances}
                                    running={isRunning(instance.instanceId)}
                                />
                            </motion.div>
                        ))}

                        {/* Botones de Acción (Siempre al final, con estilo de tarjeta) */}
                        {(!offlineMode || hasInternetAccess) && (
                            <>
                                <motion.div variants={itemVariants} className="h-full min-h-[180px]">
                                    <CreateInstanceDialog
                                        instanceNames={instances.map((i) => i.instanceName)}
                                        onInstanceCreated={fetchInstances}
                                    />
                                </motion.div>
                                <motion.div variants={itemVariants} className="h-full min-h-[180px]">
                                    <ImportMrpackDialog onInstanceCreated={fetchInstances} />
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                )}

                {/* Empty State (Si no hay instancias y no está cargando) */}
                {!isLoading && instances.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="mt-8 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <p className="text-neutral-500 mb-2">Aún no tienes instancias creadas.</p>
                        <p className="text-teal-400 text-sm flex items-center gap-2">
                            <LucidePlus className="w-4 h-4" /> Comienza creando una arriba
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    )
}