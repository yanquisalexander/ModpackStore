import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { LucidePlay, LucideChevronRight } from "lucide-react"
import { Link } from "react-router-dom"

interface RecentInstance {
    instance_id: string
    last_played_at: number
    play_count: number
    // Extended data
    name?: string
    iconUrl?: string
}

export const RecentActivity = () => {
    const [recent, setRecent] = useState<RecentInstance[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = async () => {
        try {
            const recentData = await invoke<RecentInstance[]>("get_recent_instances", { limit: 5 })

            // Fetch instance details for recent
            const recentWithDetails = await Promise.all(recentData.map(async (item) => {
                try {
                    const instance = await invoke<any>("get_instance_by_id", { instanceId: item.instance_id })
                    return {
                        ...item,
                        name: instance?.instanceName || "Instancia desconocida",
                        iconUrl: instance?.iconUrl
                    }
                } catch {
                    return { ...item, name: "Instancia desconocida" }
                }
            }))

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

    if (loading) return null
    if (recent.length === 0) return null

    return (
        <div className="space-y-10">
            {/* RECIENTES */}
            {recent.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <LucidePlay className="w-5 h-5 text-green-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-white">Jugados recientemente</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        {recent.map((item) => (
                            <Link
                                key={item.instance_id}
                                to={`/prelaunch/${item.instance_id}`}
                                className="group relative bg-neutral-900/40 border border-white/5 rounded-xl p-4 hover:bg-neutral-800/60 transition-all hover:border-green-500/30 overflow-hidden"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 flex-shrink-0">
                                        {item.iconUrl ? (
                                            <img src={item.iconUrl} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                                <LucidePlay size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-bold text-white truncate group-hover:text-green-400 transition-colors">
                                            {item.name}
                                        </h3>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">
                                            {item.play_count} sesiones • {formatDate(item.last_played_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute top-1/2 -right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:right-2 transition-all">
                                    <LucideChevronRight className="w-4 h-4 text-green-400" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    )
}
