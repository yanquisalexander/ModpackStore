import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { invoke } from "@tauri-apps/api/core"
import { useDebounce } from "use-debounce"
import { useLocation } from "react-router-dom"

// Context / Hooks
import { useGlobalContext } from "@/stores/GlobalContext"
import { useSearchBar } from "@/stores/SearchBarContext"
import { useAuthentication } from "@/stores/AuthContext"
import { useOnboarding } from "@/hooks/useOnboarding"
import { useConnection } from "@/utils/ConnectionContext"
import { useWhitelistMode } from "@/hooks/useWhitelistMode"

// Services
import { getModpacks, searchModpacks } from "@/services/getModpacks"
import { getUserAcquisitions, AcquisitionItem } from "@/services/getUserAcquisitions"

// Types
import { MinecraftInstance } from "@/types/TauriCommandReturns"

// Components
import { TitleBarSearch } from "@/components/appbar/TitleBarSearch"
import { FeaturedSlideshow } from "@/components/FeaturedSlideshow"
import { JavaStatusBanner } from "@/components/JavaStatusBanner"
import { RecommendedModpacks } from "@/components/modpack/RecommendedModpacks"
import { CategoryHorizontalSection } from "@/components/CategoryHorizontalSection"
import { ModpackCard } from "@/components/ModpackCard"
import { AdSlot } from "@/components/ads/AdSlot"
import { Button } from "@/components/ui/button"

// Icons
import {
    LucideGamepad2, LucideSearch, LucideWifiOff,
    LucideLibrary, LucideCheck, LucideDownloadCloud,
    LucideLoader, LucidePackageOpen, LucideShoppingBag,
    LucideUnplug, LucidePlay
} from "lucide-react"
import { cn } from "@/lib/utils"
import { trackSectionView } from "@/lib/analytics"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = "discover" | "library"
type LibraryFilter = "all" | "installed" | "not-installed"

interface ModpackWithInstallStatus extends AcquisitionItem {
    isInstalled: boolean
}

interface RecentInstance {
    instance_id: string
    last_played_at: number
    play_count: number
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const EmptySearch = ({ query }: { query: string }) => (
    <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
            <LucideSearch className="w-7 h-7 text-neutral-600" />
        </div>
        <p className="text-neutral-300 font-semibold text-base">Sin resultados para "{query}"</p>
        <p className="text-neutral-600 text-sm mt-1.5">Intenta con términos más generales</p>
    </div>
)

const OfflineBanner = () => (
    <div className="px-6 pt-6 pb-2">
        <Alert className="border-amber-500/20 bg-amber-500/5">
            <LucideWifiOff className="size-4 !text-amber-400" />
            <AlertTitle className="text-amber-200">Sin conexión</AlertTitle>
            <AlertDescription className="text-amber-200/60">
                Podrás jugar tus instancias locales, pero no descargar ni actualizar modpacks.
            </AlertDescription>
        </Alert>
    </div>
)

// ─── Discover Tab ────────────────────────────────────────────────────────────

const DiscoverTab = ({ isOffline }: { isOffline: boolean }) => {
    const scrollRef = useRef<HTMLDivElement>(null)
    const { query: search, setQuery: setSearch } = useSearchBar()
    const [debouncedSearch] = useDebounce(search, 300)
    const { session } = useAuthentication()
    const { onboardingStatus } = useOnboarding()
    const hasCompletedOnboarding = onboardingStatus?.first_run_at !== null

    // ── Instancias recientes — local, arrancan primero ──────────────────────
    const [recentInstances, setRecentInstances] = useState<MinecraftInstance[]>([])
    const [recentLoading, setRecentLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const [allInstances, recentRaw] = await Promise.all([
                    invoke<MinecraftInstance[]>("get_all_instances"),
                    invoke<RecentInstance[]>("get_recent_instances", { limit: 5 }).catch(() => [] as RecentInstance[]),
                ])
                if (cancelled) return
                const sorted = recentRaw
                    .map(r => allInstances.find(i => i.instanceId === r.instance_id))
                    .filter((i): i is MinecraftInstance => i != null)
                setRecentInstances(sorted)
            } catch {
                // silencioso — si falla simplemente no mostramos nada
            } finally {
                if (!cancelled) setRecentLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [])

    // ── Tienda — red, carga en paralelo con skeleton ─────────────────────────
    const [modpackCategories, setModpackCategories] = useState<any[]>([])
    const [featuredSlides, setFeaturedSlides] = useState<any[]>([])
    const [storeLoading, setStoreLoading] = useState(!isOffline)
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [barrelRolling, setBarrelRolling] = useState(false)

    // Easter egg
    const lastCheckedRef = useRef("")
    useEffect(() => {
        const q = search.trim().toLowerCase()
        if (q === "do a barrel roll" && lastCheckedRef.current !== q) {
            lastCheckedRef.current = q
            setBarrelRolling(true)
            setTimeout(() => { setBarrelRolling(false); setSearch("") }, 1000)
        } else if (q !== "do a barrel roll") {
            lastCheckedRef.current = q
        }
    }, [search, setSearch])

    useEffect(() => {
        if (debouncedSearch === "") scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    }, [debouncedSearch])

    useEffect(() => {
        if (isOffline) { setStoreLoading(false); return }
        getModpacks()
            .then(({ categories, featured }) => {
                setModpackCategories(categories)
                setFeaturedSlides(featured)
            })
            .catch(console.error)
            .finally(() => setStoreLoading(false))
    }, [isOffline])

    useEffect(() => {
        if (debouncedSearch.trim() === "") { setSearchResults([]); return }
        setSearchLoading(true)
        searchModpacks(debouncedSearch)
            .then(setSearchResults)
            .catch(console.error)
            .finally(() => setSearchLoading(false))
    }, [debouncedSearch])

    const fadeUp = {
        hidden: { opacity: 0, y: 18 },
        visible: (i = 0) => ({
            opacity: 1, y: 0,
            transition: { type: "spring", stiffness: 90, damping: 18, delay: i * 0.07 }
        })
    }
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
    }
    const itemVariants = {
        hidden: { y: 16, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 90, damping: 18 } }
    }

    return (
        <div
            ref={scrollRef}
            className={cn(
                "flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative",
                barrelRolling && "barrel-roll"
            )}
        >
            <AnimatePresence mode="wait" initial={false}>

                {/* ── Vista de búsqueda ── */}
                {debouncedSearch.trim() !== "" ? (
                    <motion.div
                        key="search"
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.22 }}
                        className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16 pt-6"
                    >
                        {searchLoading ? (
                            <div className="flex flex-col items-center justify-center py-28 gap-3">
                                <LucideLoader className="w-10 h-10 text-[#bcfe47]/50 animate-spin" />
                                <p className="text-neutral-600 text-sm animate-pulse">Buscando modpacks...</p>
                            </div>
                        ) : searchResults.length > 0 ? (
                            <>
                                <p className="text-xs text-neutral-600 mb-4">{searchResults.length} resultados</p>
                                <motion.div
                                    variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                                    initial="hidden" animate="visible"
                                    className="grid grid-cols-3 xl:grid-cols-4 gap-5"
                                >
                                    {searchResults.map((modpack, i) => (
                                        <motion.div key={modpack.id} variants={fadeUp} custom={i}>
                                            <ModpackCard modpack={modpack} to={`/modpack/${modpack.id}`} />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </>
                        ) : (
                            <EmptySearch query={debouncedSearch} />
                        )}
                    </motion.div>

                ) : (

                    /* ── Vista principal ── */
                    <motion.div
                        key="home"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
                    >
                        {/* ── Continuar jugando — aparece PRIMERO, datos locales ── */}
                        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-6">
                            {recentLoading ? (
                                <section className="mb-8">
                                    <div className="h-4 w-36 rounded-md bg-white/[0.04] animate-pulse mb-4" />
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="h-[180px] rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                                        ))}
                                    </div>
                                </section>
                            ) : recentInstances.length > 0 && (
                                <section className="mb-8">
                                    <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                                        Continuar jugando
                                    </h2>
                                    <motion.div
                                        variants={containerVariants} initial="hidden" animate="visible"
                                        className="flex flex-wrap gap-2"
                                    >
                                        {recentInstances.map(instance => (
                                            <motion.button
                                                key={instance.instanceId}
                                                variants={itemVariants}
                                                onClick={() => window.dispatchEvent(new CustomEvent("navigate-to-instance", { detail: instance.instanceId }))}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-150 group"
                                            >
                                                <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-white/[0.06]">
                                                    <img
                                                        src={instance.iconUrl || "/images/modpack-fallback.webp"}
                                                        alt={instance.instanceName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <span className="text-sm text-neutral-300 group-hover:text-white transition-colors truncate max-w-[140px]">
                                                    {instance.instanceName}
                                                </span>
                                                <LucidePlay className="w-3 h-3 text-neutral-600 group-hover:text-[#bcfe47] transition-colors shrink-0" />
                                            </motion.button>
                                        ))}
                                    </motion.div>
                                </section>
                            )}
                        </div>

                        {/* ── Offline wall (debajo de instancias recientes) ── */}
                        {isOffline ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
                                <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                    <LucideUnplug className="w-9 h-9 text-neutral-600" />
                                </div>
                                <div>
                                    <p className="text-neutral-300 font-semibold text-base">Tienda no disponible</p>
                                    <p className="text-neutral-600 text-sm mt-1.5 max-w-xs">
                                        Conectate para explorar y descargar modpacks
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Featured — ahora dentro del contenedor, con rounded y altura reducida */}
                                <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                                    {storeLoading ? (
                                        <div className="w-full h-[200px] rounded-2xl bg-white/[0.02] animate-pulse mb-8 border border-white/[0.04]" />
                                    ) : featuredSlides.length > 0 && (
                                        <div className="mb-8 rounded-2xl overflow-hidden">
                                            <FeaturedSlideshow
                                                slides={featuredSlides}
                                                heightClass="h-[200px]"
                                                compact
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16 space-y-8">
                                    {hasCompletedOnboarding && (
                                        <motion.div variants={fadeUp} initial="hidden" animate="visible">
                                            <JavaStatusBanner />
                                        </motion.div>
                                    )}

                                    {session && (
                                        <RecommendedModpacks userId={session.id} limit={5} showFallbackLabel={true} />
                                    )}

                                    {/* Categorías — skeleton mientras carga la tienda */}
                                    {storeLoading ? (
                                        <div className="space-y-8">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="space-y-3">
                                                    <div className="h-4 w-40 rounded-md bg-white/[0.04] animate-pulse" />
                                                    <div className="flex gap-4">
                                                        {[...Array(4)].map((_, j) => (
                                                            <div key={j} className="h-[200px] w-[160px] shrink-0 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        modpackCategories
                                            .filter(c => c.modpacks?.length > 0)
                                            .map((category, i) => (
                                                <div key={category.id} className="space-y-8">
                                                    <motion.div
                                                        variants={fadeUp} custom={i} initial="hidden"
                                                        whileInView="visible" viewport={{ once: true, margin: "-80px" }}
                                                    >
                                                        <CategoryHorizontalSection
                                                            id={category.id}
                                                            title={category.name}
                                                            shortDescription={category.shortDescription}
                                                            modpacks={category.modpacks}
                                                        />
                                                    </motion.div>
                                                    {i === 0 && <AdSlot placement="explore_banner" className="my-4" />}
                                                </div>
                                            ))
                                    )}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Library Tab ─────────────────────────────────────────────────────────────

const LibraryTab = ({ isOffline }: { isOffline: boolean }) => {
    const { sessionTokens } = useAuthentication()

    const [acquisitions, setAcquisitions] = useState<ModpackWithInstallStatus[]>([])
    const [acquisitionsLoading, setAcquisitionsLoading] = useState(!isOffline)
    const [acquisitionsError, setAcquisitionsError] = useState<string | null>(null)
    const [filter, setFilter] = useState<LibraryFilter>("all")

    // ── 2. Adquisiciones — red, arrancan en paralelo pero se muestran después ─
    const fetchAcquisitions = useCallback(async () => {
        if (isOffline || !sessionTokens?.accessToken) {
            setAcquisitionsLoading(false)
            return
        }
        setAcquisitionsLoading(true)
        setAcquisitionsError(null)
        try {
            const [response, allInstances] = await Promise.all([
                getUserAcquisitions(sessionTokens.accessToken),
                invoke<MinecraftInstance[]>("get_all_instances"),
            ])
            const installedIds = new Set(
                allInstances.filter(i => i.modpackId != null).map(i => i.modpackId)
            )
            setAcquisitions(
                response.data.map(item => ({
                    ...item,
                    isInstalled: installedIds.has(item.modpack.id),
                }))
            )
        } catch (err) {
            console.error("Error fetching acquisitions:", err)
            setAcquisitionsError("No pudimos sincronizar tu biblioteca.")
        } finally {
            setAcquisitionsLoading(false)
        }
    }, [sessionTokens?.accessToken, isOffline])

    useEffect(() => { fetchAcquisitions() }, [fetchAcquisitions])

    const filteredAcquisitions = acquisitions.filter(a => {
        if (filter === "installed") return a.isInstalled
        if (filter === "not-installed") return !a.isInstalled
        return true
    })

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.07 } }
    }
    const itemVariants = {
        hidden: { y: 16, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 90, damping: 18 } }
    }

    // Sin loading global — la página siempre renderiza algo

    return (
        <div className="overflow-y-auto custom-scrollbar flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 pb-16">

                {/* ── Adquisiciones ────────────────────────────── */}
                {isOffline ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                            <LucideLibrary className="w-7 h-7 text-neutral-600" />
                        </div>
                        <div>
                            <p className="text-neutral-400 font-medium">Tus adquisiciones no están disponibles</p>
                            <p className="text-neutral-600 text-sm mt-1">Conectate para ver los modpacks que tienes</p>
                        </div>
                    </div>
                ) : (
                    <section>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest">
                                    Mis modpacks
                                </h2>
                                <p className="text-xs text-neutral-600 mt-0.5">
                                    Modpacks que has adquirido o desbloqueado
                                </p>
                            </div>

                            {/* Filtros — siempre visibles aunque esté cargando */}
                            <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm shrink-0">
                                {([
                                    { id: "all" as const, label: "Todos", count: acquisitions.length },
                                    { id: "installed" as const, label: "Instalados", count: acquisitions.filter(a => a.isInstalled).length },
                                    { id: "not-installed" as const, label: "Sin instalar", count: acquisitions.filter(a => !a.isInstalled).length },
                                ] as const).map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilter(tab.id)}
                                        className={cn(
                                            "px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2",
                                            filter === tab.id
                                                ? "bg-violet-600 text-white shadow-lg shadow-violet-900/20"
                                                : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {tab.label}
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-md text-[10px]",
                                            filter === tab.id ? "bg-white/20 text-white" : "bg-white/5 text-neutral-500"
                                        )}>
                                            {acquisitionsLoading ? "·" : tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {acquisitionsLoading ? (
                            // Skeleton de modpack cards mientras llega la red
                            <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="h-[260px] rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
                                ))}
                            </div>
                        ) : acquisitionsError ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                                    <LucideDownloadCloud className="h-8 w-8 text-red-400" />
                                </div>
                                <p className="text-white font-medium mb-1">Algo salió mal</p>
                                <p className="text-neutral-500 text-sm mb-4">{acquisitionsError}</p>
                                <Button onClick={fetchAcquisitions} variant="outline" className="border-white/10 hover:bg-white/5 text-white">
                                    Reintentar
                                </Button>
                            </div>
                        ) : filteredAcquisitions.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                                className="py-16 p-6 rounded-2xl bg-gradient-to-br from-violet-900/10 to-blue-900/10 border border-white/[0.04] text-center max-w-sm mx-auto"
                            >
                                <LucidePackageOpen className="w-10 h-10 text-violet-400/50 mx-auto mb-3" />
                                <h3 className="text-base font-semibold text-white/80 mb-1">
                                    {filter === "all" ? "Biblioteca vacía" :
                                        filter === "installed" ? "Nada instalado aún" :
                                            "Todo está instalado"}
                                </h3>
                                <p className="text-xs text-neutral-600">
                                    {filter === "all" ? "Aún no tienes modpacks. ¡Visita la tienda!" :
                                        filter === "installed" ? "Instala un modpack desde tu biblioteca." :
                                            "Todo tu contenido está listo para jugar."}
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                variants={containerVariants} initial="hidden" animate="visible"
                                className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                            >
                                {filteredAcquisitions.map(item => {
                                    const modpackForCard = {
                                        ...item.modpack,
                                        publisher: { publisherName: item.modpack.creatorName || "Desconocido" },
                                    }
                                    return (
                                        <motion.div key={item.acquisition.id} variants={itemVariants} className="relative group">
                                            <ModpackCard
                                                modpack={modpackForCard}
                                                to={`/modpack/${item.modpack.id}`}
                                                className="h-full hover:ring-2 hover:ring-violet-500/50 transition-all duration-300"
                                            />
                                            {item.isInstalled && (
                                                <div className="absolute top-3 right-3 z-20">
                                                    <div className="flex items-center gap-1.5 bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 text-white px-2.5 py-1 rounded-full shadow-lg shadow-emerald-900/20">
                                                        <LucideCheck className="h-3 w-3 stroke-[3]" />
                                                        <span className="text-[10px] font-bold uppercase tracking-wide">Instalado</span>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )
                                })}
                            </motion.div>
                        )}
                    </section>
                )}
            </div>
        </div>
    )
}

// ─── PlayPage ────────────────────────────────────────────────────────────────

export const PlayPage = ({ defaultTab }: { defaultTab?: Tab }) => {
    const { setTitleBarState } = useGlobalContext()
    const { isConnected } = useConnection()
    const { isWhitelistMode } = useWhitelistMode()
    const isOffline = isConnected === false
    const location = useLocation()

    // Leer tab desde props, location.state (redirect de /library), o default
    const initialTab: Tab = defaultTab ?? (location.state?.tab as Tab) ?? "discover"
    const [activeTab, setActiveTab] = useState<Tab>(initialTab)

    useEffect(() => {
        setTitleBarState({
            title: "Modpack Store",
            icon: LucideGamepad2,
            canGoBack: false,
            customIconClassName: "bg-[#bcfe47]/15 text-[#bcfe47]",
            opaque: true,
            // Search solo visible en tab Descubrir
            rightSlot: activeTab === "discover" && !isOffline ? <TitleBarSearch /> : undefined,
        })
        if (activeTab === "discover") trackSectionView("explore")
        if (activeTab === "library") trackSectionView("library")
    }, [activeTab, isOffline])

    // Whitelist mode override: si está en whitelist mode, Descubrir muestra la whitelist
    // (se mantiene compatibilidad, pero la PlayPage es siempre el shell)

    const tabs = [
        {
            id: "discover" as const,
            label: "Descubrir",
            icon: LucideShoppingBag,
            disabled: false,
        },
        {
            id: "library" as const,
            label: "Biblioteca",
            icon: LucideLibrary,
            disabled: false,
        },
    ]

    return (
        <div className="flex flex-col h-full w-full bg-[#0e0e10] overflow-hidden">

            {/* Offline Banner */}
            {isOffline && <OfflineBanner />}

            {/* ── Tab Bar ─────────────────────────────────── */}
            <div className="flex-shrink-0 px-5 pt-4 pb-0">
                <div className="flex items-end gap-1 relative">
                    {tabs.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                disabled={tab.disabled}
                                className={cn(
                                    "relative flex items-center gap-2 px-5 py-2.5 rounded-t-xl text-sm font-medium transition-all duration-200",
                                    "border border-b-0",
                                    isActive
                                        ? "bg-[#18181b] border-white/10 text-white z-10"
                                        : "bg-transparent border-transparent text-neutral-500 hover:text-neutral-300 hover:bg-white/5",
                                    tab.disabled && "opacity-40 cursor-not-allowed"
                                )}
                            >
                                <Icon className={cn("w-4 h-4 transition-colors", isActive ? "text-[#bcfe47]" : "")} />
                                {tab.label}

                                {/* Active indicator line */}
                                {isActive && (
                                    <motion.span
                                        layoutId="tab-indicator"
                                        className="absolute bottom-0 left-4 right-4 h-[2px] bg-[#bcfe47] rounded-full"
                                    />
                                )}
                            </button>
                        )
                    })}

                    {/* Bottom border line under entire tab bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]" />
                </div>
            </div>

            {/* ── Tab Content ─────────────────────────────── */}
            <div className="flex flex-col flex-1 overflow-hidden bg-[#0e0e10]">
                <AnimatePresence mode="wait" initial={false}>
                    {activeTab === "discover" && (
                        <motion.div
                            key="discover"
                            className="flex flex-col flex-1 overflow-hidden"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                            <DiscoverTab isOffline={isOffline} />
                        </motion.div>
                    )}
                    {activeTab === "library" && (
                        <motion.div
                            key="library"
                            className="flex flex-col flex-1 overflow-hidden"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                            <LibraryTab isOffline={isOffline} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
