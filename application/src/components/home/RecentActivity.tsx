import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucidePlay } from "lucide-react"
import { Link } from "react-router-dom"
import { Skeleton } from "@/components/ui/skeleton"

interface RecentInstance {
    instance_id: string
    last_played_at: number
    play_count: number
    name?: string
    iconUrl?: string
}

export const RecentActivity = () => {
    const [recent, setRecent] = useState<RecentInstance[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const recentData = await invoke<RecentInstance[]>("get_recent_instances", { limit: 5 })

            const results = await Promise.all(recentData.map(async (item) => {
                try {
                    const instance = await invoke<any>("get_instance_by_id", { instanceId: item.instance_id })
                    if (!instance) return null
                    return {
                        ...item,
                        name: instance?.instanceName || "Instancia desconocida",
                        iconUrl: instance?.iconUrl
                    }
                } catch {
                    return null
                }
            }))
            const recentWithDetails = results.filter(Boolean) as RecentInstance[]

            setRecent(recentWithDetails)
        } catch (error) {
            console.error("Error fetching play history:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const formatDate = (timestamp: number) => {
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(timestamp * 1000))
    }

    if (loading) {
        return (
            <div className="flex flex-wrap gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 w-24">
                        <Skeleton className="w-16 h-16 rounded-2xl bg-neutral-800" />
                        <div className="text-center min-w-0 w-full space-y-1.5">
                            <Skeleton className="h-3 w-3/4 mx-auto bg-neutral-800" />
                            <Skeleton className="h-2 w-1/2 mx-auto bg-neutral-800" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (recent.length === 0) return null

    return (
        <div className="flex flex-wrap gap-3">
            {recent.map((item) => (
                <Link
                    key={item.instance_id}
                    to={`/prelaunch/${item.instance_id}`}
                    className="group flex flex-col items-center gap-2 w-24 transition-opacity hover:opacity-80"
                >
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-neutral-800 ring-1 ring-white/[0.06] flex-shrink-0">
                        {item.iconUrl ? (
                            <img src={item.iconUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                <LucidePlay size={24} />
                            </div>
                        )}
                    </div>
                    <div className="text-center min-w-0 w-full">
                        <p className="text-[11px] font-medium text-neutral-400 truncate leading-tight">
                            {item.name}
                        </p>
                        <p className="text-[9px] text-neutral-600 mt-0.5">
                            {formatDate(item.last_played_at)}
                        </p>
                    </div>
                </Link>
            ))}
        </div>
    )
}
