import { useEffect, useState, useRef } from "react"
import { useGlobalContext } from "../stores/GlobalContext"
import { LucideLoader, LucideSearch, LucideShoppingBag, LucideSparkles, LucideZap, LucideGamepad2, LucideWand2, LucideCpu } from "lucide-react"
import { getModpacks, searchModpacks } from "@/services/getModpacks"
import { CategoryHorizontalSection } from "../components/CategoryHorizontalSection"
import { clearActivity, setActivity } from "tauri-plugin-drpc"
import { Activity, ActivityType, Assets, Timestamps } from "tauri-plugin-drpc/activity"
import { useDebounce } from 'use-debounce'
import { ModpackCard } from "@/components/ModpackCard"
import { trackEvent } from "@aptabase/web"
import { trackSectionView } from "@/lib/analytics"
import { motion, AnimatePresence } from "motion/react"
import { FeaturedSlideshow } from "@/components/FeaturedSlideshow"
import { JavaStatusBanner } from "@/components/JavaStatusBanner"
import { RecommendedModpacks } from "@/components/modpack/RecommendedModpacks"
import { RecentActivity } from "@/components/home/RecentActivity"
import { useOnboarding } from "@/hooks/useOnboarding"
import { useAuthentication } from "@/stores/AuthContext"

// --- SUBCOMPONENTES ESTÉTICOS RECUPERADOS ---

const Greeting = ({ username }: { username: string | null }) => {
    const NOW = new Date()
    const GREETING_TEMPLATES: Record<string, string> = {
        MAÑANA: "¡Buenos días, {username}!",
        TARDE: "¡Buenas tardes, {username}!",
        NOCHE: "¡Buenas noches, {username}!",
        MADRUGADA: "¿Madrugando, {username}?"
    }

    const EMOJI_MAP: Record<string, string> = {
        MAÑANA: "☀️",
        TARDE: "🧉",
        NOCHE: "🌙",
        MADRUGADA: "☕"
    }

    const hour = NOW.getHours()
    const timeKey = hour < 12 ? "MAÑANA" : hour < 18 ? "TARDE" : hour < 24 ? "NOCHE" : "MADRUGADA"
    const MESSAGE_TO_DISPLAY = GREETING_TEMPLATES[timeKey].replace("{username}", username || "Jugador");
    const emoji = EMOJI_MAP[timeKey];
    const [saludo, nombre] = MESSAGE_TO_DISPLAY.split(',');

    return (
        <div className="flex flex-col items-center md:items-start">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-none">
                    {saludo},
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#bcfe47] to-[#05cc2a] ml-1">
                        {nombre?.trim() || username}
                    </span>
                    <motion.span
                        className="text-2xl md:text-3xl inline-block select-none ml-2"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, repeatDelay: 5, duration: 2 }}
                    >
                        {emoji}
                    </motion.span>
                </h1>
            </motion.div>
            <p className="text-neutral-400 text-sm mt-2 font-medium">
                ¿Qué aventura toca hoy?
            </p>
        </div>
    )
}

const QuickFilterChip = ({ label, icon: Icon, onClick }: any) => (
    <button
        onClick={onClick}
        className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/50 border border-neutral-700/50 hover:bg-neutral-700 hover:border-neutral-500 transition-all text-xs font-medium text-neutral-300 hover:text-white hover:shadow-lg hover:shadow-green-900/20 active:scale-95"
    >
        {Icon && <Icon size={12} className="text-[#bcfe47] group-hover:text-green-400 transition-colors" />}
        {label}
    </button>
)

// --- COMPONENTE PRINCIPAL ---

export const ExploreSection = () => {
    const { titleBarState, setTitleBarState } = useGlobalContext()
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const [modpackCategories, setModpackCategories] = useState<any[]>([])
    const [featuredSlides, setFeaturedSlides] = useState<any[]>([])
    const [searchResults, setSearchResults] = useState<any[]>([])

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)

    const [search, setSearch] = useState("")
    const [debouncedSearch] = useDebounce(search, 300)
    const { onboardingStatus } = useOnboarding()
    const { session } = useAuthentication()
    const [isSearchFocused, setIsSearchFocused] = useState(false)

    const hasCompletedOnboarding = onboardingStatus?.first_run_at !== null

    // Scroll Fix
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }, [debouncedSearch === ""])

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            title: "Modpack Store",
            icon: LucideShoppingBag,
            canGoBack: false,
            customIconClassName: "bg-green-500/20 text-green-400",
            opaque: true,
        })
        trackSectionView('explore')

        const activity = new Activity()
            .setActivity(ActivityType.Playing)
            .setState("Explorando Modpacks")
            .setTimestamps(new Timestamps(Date.now()))
            .setAssets(new Assets().setLargeImage("exploring").setSmallImage("exploring"))
        setActivity(activity)

        getModpacks()
            .then(({ categories, featured }) => {
                setModpackCategories(categories)
                setFeaturedSlides(featured)
            })
            .catch(console.error)
            .finally(() => setInitialLoading(false))

        return () => { clearActivity().catch(console.error) }
    }, [])

    useEffect(() => {
        if (debouncedSearch.trim() === "") {
            setSearchResults([])
            return
        }
        setLoading(true)
        searchModpacks(debouncedSearch)
            .then(setSearchResults)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [debouncedSearch])

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0, scale: 0.95 },
        visible: {
            y: 0,
            opacity: 1,
            scale: 1,
            transition: { type: "spring" as const, stiffness: 100, damping: 15 }
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-[#121212]">

            {/* Glow Ambiental (Fondo) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-500/5 blur-[120px] rounded-full pointer-events-none z-0" />

            {/* Contenedor Principal */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth z-10">

                {/* CORRECCIÓN: Envolvemos TODO el contenido en el estado de carga.
                    Así, el Slideshow y el Greeting no aparecen hasta que todo esté listo.
                */}
                {initialLoading ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-dvh gap-4">
                        <LucideLoader className="w-12 h-12 animate-spin text-green-500" />
                        <p className="text-neutral-400 font-medium animate-pulse">Cargando la tienda...</p>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* HERO SECTION (Ahora se carga junto con el resto) */}
                        <div className="relative w-full">
                            <FeaturedSlideshow slides={featuredSlides} />
                        </div>

                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={containerVariants}
                            className="relative px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-20 mb-10"
                        >
                            {hasCompletedOnboarding && <div className="mb-6"><JavaStatusBanner /></div>}

                            {/* HEADER CARD */}
                            <div className="bg-neutral-900/60 backdrop-blur-xl backdrop-saturate-150 border border-white/10 rounded-2xl p-6 shadow-2xl mb-12 ring-1 ring-black/5">
                                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                                    <Greeting username={session?.username!} />

                                    <div className="w-full md:w-auto md:min-w-[450px]">
                                        {/* Barra de búsqueda */}
                                        <motion.div className={`relative group transition-all duration-300 ${isSearchFocused ? 'scale-[1.01]' : ''}`}>
                                            <div className={`absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl opacity-0 transition duration-500 blur-md ${isSearchFocused ? 'opacity-30' : 'group-hover:opacity-10'}`}></div>

                                            <div className="relative flex items-center bg-[#0a0a0a] rounded-xl border border-white/10 overflow-hidden shadow-inner">
                                                <LucideSearch className={`ml-4 w-5 h-5 transition-colors duration-300 ${isSearchFocused ? 'text-green-400' : 'text-neutral-500'}`} />
                                                <input
                                                    type="text"
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    onFocus={() => setIsSearchFocused(true)}
                                                    onBlur={() => setIsSearchFocused(false)}
                                                    placeholder="Buscar modpacks, mods..."
                                                    className="w-full h-14 pl-3 pr-4 bg-transparent text-white placeholder-neutral-500 focus:outline-none text-base font-medium"
                                                />
                                                {loading && (
                                                    <div className="pr-4">
                                                        <LucideLoader className="w-5 h-5 animate-spin text-green-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>

                                        {/* Chips Decorativos */}
                                        <div className="flex gap-2 mt-4 justify-center md:justify-start overflow-x-auto pb-1 hide-scrollbar">
                                            <QuickFilterChip label="Popular" icon={LucideSparkles} onClick={() => { }} />
                                            <QuickFilterChip label="Nuevos" icon={LucideZap} onClick={() => { }} />
                                            <QuickFilterChip label="Tech" icon={LucideCpu} onClick={() => setSearch("Tech")} />
                                            <QuickFilterChip label="Magic" icon={LucideWand2} onClick={() => setSearch("Magic")} />
                                            <QuickFilterChip label="RPG" icon={LucideGamepad2} onClick={() => setSearch("RPG")} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ZONA DE CONTENIDO DINÁMICO */}
                            <AnimatePresence initial={false} mode="wait">
                                {debouncedSearch.trim() !== "" ? (
                                    // --- RESULTADOS DE BÚSQUEDA ---
                                    <motion.div
                                        key="search-results"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ duration: 0.3 }}
                                        className="min-h-[50vh]"
                                    >
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="p-2 bg-green-500/10 rounded-lg">
                                                <LucideSearch className="w-5 h-5 text-green-400" />
                                            </div>
                                            <h2 className="text-xl font-semibold text-white">
                                                Resultados para <span className="text-green-400">"{debouncedSearch}"</span>
                                            </h2>
                                        </div>

                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center py-32 opacity-70">
                                                <LucideLoader className="w-12 h-12 text-green-500 animate-spin mb-4" />
                                                <p className="text-neutral-400 animate-pulse">Consultando la biblioteca...</p>
                                            </div>
                                        ) : (
                                            <motion.div
                                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                                                variants={containerVariants}
                                                initial="hidden"
                                                animate="visible"
                                            >
                                                {searchResults.length > 0 ? (
                                                    searchResults.map((modpack: any, index) => (
                                                        <motion.div
                                                            key={modpack.id}
                                                            variants={itemVariants}
                                                            custom={index}
                                                        >
                                                            <ModpackCard
                                                                modpack={modpack}
                                                                to={`/modpack/${modpack.id}`}
                                                            />
                                                        </motion.div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full py-24 text-center">
                                                        <div className="bg-neutral-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                                            <LucideSearch className="w-10 h-10 text-neutral-500" />
                                                        </div>
                                                        <p className="text-neutral-300 text-lg font-medium">No encontramos nada parecido.</p>
                                                        <p className="text-neutral-500 text-sm mt-1">Intenta buscar términos más generales.</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ) : (
                                    // --- HOME / CATEGORÍAS ---
                                    <motion.div
                                        key="categories"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="space-y-8"
                                    >
                                        {session && (
                                            <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                                <RecommendedModpacks
                                                    userId={session.id}
                                                    limit={5}
                                                    showFallbackLabel={true}
                                                />
                                            </motion.div>
                                        )}

                                        <motion.div variants={itemVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                            <RecentActivity />
                                        </motion.div>

                                        {modpackCategories.map((category: any, index) => (
                                            <motion.div
                                                key={category.id}
                                                variants={itemVariants}
                                                initial="hidden"
                                                whileInView="visible"
                                                viewport={{ once: true, margin: "-100px" }}
                                                custom={index}
                                            >
                                                <CategoryHorizontalSection
                                                    id={category.id}
                                                    title={category.name}
                                                    shortDescription={category.shortDescription}
                                                    modpacks={category.modpacks}
                                                    href={`/category/${category.id}`}
                                                />
                                            </motion.div>
                                        ))}

                                        {/* Footer */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true }}
                                            className="pt-20 flex flex-col items-center justify-center text-center group"
                                        >
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                <img
                                                    src="/images/minecraft_pj.webp"
                                                    draggable="false"
                                                    className="relative h-32 w-auto object-contain opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500 drop-shadow-2xl"
                                                    alt="Character"
                                                />
                                            </div>
                                            <p className="mt-6 text-neutral-500 text-sm font-medium tracking-wide">
                                                EXPLORA • CREA • JUEGA
                                            </p>
                                            <p className="text-neutral-700 text-xs mt-2">
                                                Modpack Store &copy; {new Date().getFullYear()}
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}