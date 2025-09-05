import { ArmadilloLoading } from "@/components/ArmadilloLoading";
import { CreateInstanceDialog } from "@/components/CreateInstanceDialog";
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


export const MyInstancesSection = ({ offlineMode }: { offlineMode?: boolean }) => {
    const { setTitleBarState } = useGlobalContext()
    const { hasInternetAccess } = useConnection()
    const { instances: instancesOnContext } = useInstances()
    const { instancesBootstraping } = useTasksContext()

    const [instances, setInstances] = useState<TauriCommandReturns['get_instance_by_id'][]>([])
    const [isLoading, setIsLoading] = useState(true)
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


    return (
        <div className="mx-auto max-w-7xl px-8 py-10 overflow-y-auto h-full">
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
                    {instances.map((instance) => (
                        <InstanceCard
                            key={instance.instanceId}
                            instance={instance}
                            isBootstrapping={isBootstrapping(instance.instanceId)}
                            onInstanceRemoved={fetchInstances}
                            running={isRunning(instance.instanceId)}
                        />
                    ))}
                    {
                        (!offlineMode || hasInternetAccess) && (
                            <CreateInstanceDialog
                                instanceNames={instances.map((i) => i.instanceName)}
                                onInstanceCreated={fetchInstances} />
                        )
                    }
                </div>
            )}
        </div >
    )
}