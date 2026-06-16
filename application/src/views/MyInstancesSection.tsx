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
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LucidePackageOpen, LucidePlus, LucideImport, LucideInfo } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner";
import { useActionLimit } from "@/hooks/useUserFlags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "motion/react";
import GlassGamingButtons from "@/icons/GlassGamingButtons";

export const MyInstancesSection = ({ offlineMode }: { offlineMode?: boolean }) => {
    const { setTitleBarState } = useGlobalContext()
    const { hasInternetAccess } = useConnection()
    const { instances: instancesOnContext } = useInstances()
    const { instancesBootstraping } = useTasksContext()

    const [instances, setInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDragging, setIsDragging] = useState(false)
    const [droppedFilePath, setDroppedFilePath] = useState<string | undefined>(undefined)

    const { allowed, limit: instancesLimit, remaining } = useActionLimit('max_instances_allowed', instances.length)

    function getWarningThreshold(limit: number) {
        if (limit <= 3) return 1
        if (limit <= 6) return 2
        return Math.ceil(limit * 0.2)
    }

    const instancesCount = instances.length

    const limitState = useMemo(() => {
        if (instancesLimit == null) return 'unlimited'

        if (instancesCount > instancesLimit) return 'over_limit'

        if (remaining === 0) return 'limit_reached'

        const warningThreshold = getWarningThreshold(instancesLimit)

        if (remaining <= warningThreshold) return 'near_limit'

        return 'ok'
    }, [instancesCount, instancesLimit, remaining])


    const fetchInstances = useCallback(async () => {
        setIsLoading(true)
        try {
            await sleep(500)
            const allInstances = await invoke('get_all_instances') as TauriCommandReturns['get_instance_by_id'][]
            setInstances(allInstances.filter(inst => inst?.instanceType !== 'server'))
        } catch (error) {
            console.error(error)
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
            icon: GlassGamingButtons,
            canGoBack: true,
            customIconClassName: "bg-teal-500/20 text-teal-400",
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

    useEffect(() => {
        const unlisten = getCurrentWindow().onDragDropEvent((event) => {
            if (event.payload.type === 'enter') {
                setIsDragging(true)
            } else if (event.payload.type === 'over') {
                setIsDragging(true)
            } else if (event.payload.type === 'drop') {
                setIsDragging(false)

                const paths = event.payload.paths
                const mrpackPaths = paths.filter(p => p.toLowerCase().endsWith('.mrpack'))

                if (mrpackPaths.length === 0) {
                    toast.error('Por favor, arrastra un archivo .mrpack válido')
                    return
                }

                if (mrpackPaths.length > 1) {
                    toast.error('Solo puedes importar un archivo .mrpack a la vez')
                    return
                }

                if (!allowed) {
                    toast.error('Has alcanzado el límite de instancias permitidas', {
                        description: 'Elimina alguna o mejora tu suscripción para continuar.'
                    })
                    return
                }

                setDroppedFilePath(mrpackPaths[0])
            } else if (event.payload.type === 'leave') {
                setIsDragging(false)
            }
        })

        return () => { unlisten.then(fn => fn()) }
    }, [allowed])

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 100 } }
    }

    return (
        <div
            className="relative min-h-full bg-[#0e0e10] overflow-hidden"
        >
            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

            {/* Drag & Drop Overlay */}
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-8 pointer-events-none"
                    >
                        <div className="w-full h-full border-2 border-dashed border-teal-500/40 rounded-2xl flex flex-col items-center justify-center gap-4 bg-teal-500/5">
                            <div className="p-4 rounded-full bg-teal-500/20">
                                <LucideImport className="h-12 w-12 text-teal-400" />
                            </div>
                            <h2 className="text-2xl font-semibold text-teal-200">Suelta tu .mrpack aquí</h2>
                            <p className="text-teal-400/60 text-sm">Importaremos tu modpack automáticamente</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-10 md:px-10 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <GlassGamingButtons className="w-6 h-6 text-teal-400" />
                        <h1 className="text-xl font-semibold bg-gradient-to-b from-teal-200 to-teal-500 bg-clip-text text-transparent">
                            Mis Instancias
                        </h1>
                    </div>
                    <p className="text-sm text-neutral-500 max-w-xl leading-relaxed">
                        Aquí vive tu colección de Minecraft. Juega, gestiona y crea nuevas aventuras.
                    </p>
                </header>

                {!isLoading && ['near_limit', 'limit_reached', 'over_limit'].includes(limitState) && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-200 text-sm">
                            <LucideInfo className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                            <AlertDescription className="w-full">
                                {limitState === 'near_limit' && (
                                    <span>
                                        Te quedan <strong>{remaining}</strong>{' '}
                                        {remaining === 1 ? 'espacio disponible' : 'espacios disponibles'}.
                                        Si sueles probar muchos modpacks, podrías beneficiarte de{' '}
                                        <strong>Modpack Store+</strong>.
                                    </span>
                                )}

                                {limitState === 'limit_reached' && (
                                    <span>
                                        Has alcanzado el límite de <strong>{instancesLimit} instancias</strong>.
                                        Puedes eliminar alguna existente o mejorar tu plan para crear más.
                                    </span>
                                )}

                                {limitState === 'over_limit' && (
                                    <span>
                                        Tienes <strong>{instancesCount} instancias</strong>, superando el
                                        límite de <strong>{instancesLimit}</strong> de tu plan.
                                        No perderás acceso a tus instancias actuales, pero no podrás crear
                                        nuevas hasta reducirlas o mejorar tu suscripción de Modpack Store+.
                                    </span>
                                )}
                            </AlertDescription>
                        </Alert>
                    </motion.div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <ArmadilloLoading className="w-16" />
                        <p className="text-neutral-600 font-minecraft-ten tracking-widest text-sm uppercase">Cargando instancias...</p>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
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

                        {(!offlineMode || hasInternetAccess) && (
                            <>
                                <motion.div variants={itemVariants} className="h-full min-h-[180px]">
                                    <CreateInstanceDialog
                                        instanceNames={instances.map((i) => i.instanceName)}
                                        onInstanceCreated={fetchInstances}
                                        disabled={!allowed}
                                    />
                                </motion.div>
                                <motion.div variants={itemVariants} className="h-full min-h-[180px]">
                                    <ImportMrpackDialog
                                        onInstanceCreated={fetchInstances}
                                        disabled={!allowed}
                                        defaultPath={droppedFilePath}
                                        onDefaultPathConsumed={() => setDroppedFilePath(undefined)}
                                    />
                                </motion.div>
                            </>
                        )}
                    </motion.div>
                )}

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
