import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { InstanceCard } from "@/components/InstanceCard";
import { trackSectionView } from "@/lib/analytics";
import { sleep } from "@/lib/utils";
import { useGlobalContext } from "@/stores/GlobalContext";
import { useInstances } from "@/stores/InstancesContext";
import { useTasksContext } from "@/stores/TasksContext";
import { TauriCommandReturns } from "@/types/TauriCommandReturns";
import { invoke } from "@tauri-apps/api/core";
import { LucideServer, LucidePlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react";

export const ServersSection = () => {
    const { setTitleBarState } = useGlobalContext()
    const { instances: instancesOnContext } = useInstances()
    const { instancesBootstraping } = useTasksContext()

    const [instances, setInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchInstances = useCallback(async () => {
        setIsLoading(true)
        try {
            await sleep(1000)
            const allInstances = await invoke('get_all_instances') as TauriCommandReturns['get_instance_by_id'][]
            setInstances(allInstances.filter(inst => inst?.instanceType === 'server'))
        } catch (error) {
            console.error(error)
            setInstances([])
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInstances()

        setTitleBarState({
            title: "Servidores",
            icon: LucideServer,
            canGoBack: true,
            customIconClassName: "bg-purple-500/20 text-purple-400",
            opaque: false,
        });

        trackSectionView("servers")
    }, [fetchInstances, setTitleBarState])

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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
    }

    return (
        <div className="relative min-h-dvh bg-[#0a0a0a] text-white overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12 h-full overflow-y-auto custom-scrollbar">
                <header className="mb-12 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <LucideServer className="w-6 h-6 text-purple-400" />
                        </div>
                        <h1 className="tracking-tight inline font-semibold text-3xl bg-gradient-to-b from-purple-200 to-purple-500 bg-clip-text text-transparent">
                            Mis Servidores
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                        Gestiona tus propios servidores de Minecraft. Inicia, configura y administra tus mundos.
                    </p>
                </header>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <ArmadilloLoading className="w-16" />
                        <p className="text-neutral-200 font-minecraft-ten tracking-widest text-normal uppercase ">Cargando servidores...</p>
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {instances.map((instance) => (
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

                        {/* Botón para crear servidor (Placeholder) */}
                        <motion.div
                            variants={itemVariants}
                            className="bg-purple-500/5 border border-dashed border-purple-500/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-purple-500/10 transition-colors cursor-not-allowed group"
                        >
                            <div className="p-4 rounded-full bg-purple-500/10 group-hover:scale-110 transition-transform">
                                <LucidePlus className="w-8 h-8 text-purple-400" />
                            </div>
                            <span className="text-purple-300 font-medium">Crear Servidor</span>
                            <span className="text-[10px] text-purple-500 uppercase tracking-widest bg-purple-500/10 px-2 py-0.5 rounded">Próximamente</span>
                        </motion.div>
                    </motion.div>
                )}

                {!isLoading && instances.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="mt-8 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <LucideServer className="w-12 h-12 text-neutral-600 mb-4" />
                        <p className="text-neutral-500 mb-2">Aún no tienes servidores configurados.</p>
                        <p className="text-purple-400 text-sm">
                            Pronto podrás crear tus propios servidores locales aquí.
                        </p>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
