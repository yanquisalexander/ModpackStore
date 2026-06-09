import { useEffect, useState, useRef } from "react"
import { useGlobalContext } from "../stores/GlobalContext"
import {
    LucideLoader, LucideSearch, LucideShoppingBag,
    LucideSparkles, LucideZap, LucideGamepad2,
    LucideWand2, LucideCpu, LucideChevronRight
} from "lucide-react"
import { getModpacks, searchModpacks } from "@/services/getModpacks"
import { CategoryHorizontalSection } from "../components/CategoryHorizontalSection"
import { clearActivity, setActivity } from "tauri-plugin-drpc"
import { Activity, ActivityType, Assets, Timestamps } from "tauri-plugin-drpc/activity"
import { useDebounce } from 'use-debounce'
import { ModpackCard } from "@/components/ModpackCard"
import { trackSectionView } from "@/lib/analytics"
import { motion, AnimatePresence } from "motion/react"
import { FeaturedSlideshow } from "@/components/FeaturedSlideshow"
import { JavaStatusBanner } from "@/components/JavaStatusBanner"
import { RecommendedModpacks } from "@/components/modpack/RecommendedModpacks"
import { RecentActivity } from "@/components/home/RecentActivity"
import { useOnboarding } from "@/hooks/useOnboarding"
import { useAuthentication } from "@/stores/AuthContext"

// ─── GREETING ────────────────────────────────────────────────────────────────

const getTimeContext = () => {
    const h = new Date().getHours()
    if (h < 5) return { key: "MADRUGADA", emoji: "☕", saludo: "¿Madrugando" }
    if (h < 12) return { key: "MAÑANA", emoji: "☀️", saludo: "Buenos días" }
    if (h < 18) return { key: "TARDE", emoji: "🧉", saludo: "Buenas tardes" }
    return { key: "NOCHE", emoji: "🌙", saludo: "Buenas noches" }
}

const Greeting = ({ username }: { username: string | null }) => {
    const { saludo, emoji } = getTimeContext()
    const name = username || "Jugador"

    return (
        <div className="flex items-center justify-between w-full">
            <div>
                <motion.h1
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45 }}
                    className="text-xl font-bold text-white leading-tight tracking-tight"
                >
                    {saludo},{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#bcfe47] to-[#05cc2a]">
                        {name}
                    </span>
                    {" "}
                    <motion.span
                        className="inline-block select-none"
                        animate={{ rotate: [0, 12, -10, 0] }}
                        transition={{ repeat: Infinity, repeatDelay: 6, duration: 1.8 }}
                    >
                        {emoji}
                    </motion.span>
                </motion.h1>
                <p className="text-neutral-500 text-sm mt-1">¿Qué aventura toca hoy?</p>
            </div>

            {/* Avatar inicial */}
            <div className="
                w-10 h-10 rounded-full flex-shrink-0
                flex items-center justify-center
                bg-[#bcfe47]/10 border border-[#bcfe47]/25
                font-bold text-[#bcfe47] text-sm
            ">
                {name[0].toUpperCase()}
            </div>
        </div>
    )
}

// ─── FILTER CHIP ─────────────────────────────────────────────────────────────

const FilterChip = ({
    label,
    icon: Icon,
    onClick,
    active = false,
}: {
    label: string
    icon?: React.ElementType
    onClick?: () => void
    active?: boolean
}) => (
    <button
        onClick={onClick}
        className={`
            group flex items-center gap-1.5 px-3 py-1.5
            rounded-full text-xs font-medium
            border transition-all duration-200 active:scale-95
            ${active
                ? "bg-[#bcfe47]/10 border-[#bcfe47]/30 text-[#bcfe47]"
                : "bg-white/[0.04] border-white/[0.07] text-neutral-400 hover:bg-[#bcfe47]/[0.06] hover:border-[#bcfe47]/20 hover:text-[#bcfe47]"
            }
        `}
    >
        {Icon && <Icon size={11} />}
        {label}
    </button>
)

// ─── SECTION HEADER ───────────────────────────────────────────────────────────

const SectionHeader = ({
    title,
    subtitle,
    href,
}: {
    title: string
    subtitle?: string
    href?: string
}) => (
    <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-2.5">
            <h2 className="font-bold text-[15px] text-white tracking-tight">{title}</h2>
            {subtitle && <span className="text-[11px] text-neutral-600">{subtitle}</span>}
        </div>
        {href && (
            <a
                href={href}
                className="flex items-center gap-0.5 text-xs text-neutral-500 hover:text-[#bcfe47] transition-colors"
            >
                Ver todo <LucideChevronRight size={12} />
            </a>
        )}
    </div>
)

// ─── EMPTY STATE ──────────────────────────────────────────────────────────────

const EmptySearch = ({ query }: { query: string }) => (
    <div className="flex flex-col items-center justify-center py-28 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
            <LucideSearch className="w-7 h-7 text-neutral-600" />
        </div>
        <p className="text-neutral-300 font-semibold text-base">Sin resultados para "{query}"</p>
        <p className="text-neutral-600 text-sm mt-1.5">Intenta con términos más generales</p>
    </div>
)

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export const ExploreSection = () => {
    const { titleBarState, setTitleBarState } = useGlobalContext()
    const scrollRef = useRef<HTMLDivElement>(null)

    const [modpackCategories, setModpackCategories] = useState<any[]>([])
    const [featuredSlides, setFeaturedSlides] = useState<any[]>([])
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [debouncedSearch] = useDebounce(search, 300)
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [activeChip, setActiveChip] = useState<string | null>(null)

    const { onboardingStatus } = useOnboarding()
    const { session } = useAuthentication()
    const hasCompletedOnboarding = onboardingStatus?.first_run_at !== null

    // Scroll to top on search clear
    useEffect(() => {
        if (debouncedSearch === "") {
            scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        }
    }, [debouncedSearch === ""])

    // Init
    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            title: "Modpack Store",
            icon: LucideShoppingBag,
            canGoBack: false,
            customIconClassName: "bg-green-500/20 text-green-400",
            opaque: true,
        })
        trackSectionView("explore")

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

    // Search
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

    const handleChip = (label: string, query?: string) => {
        const val = query ?? label
        setActiveChip(label === activeChip ? null : label)
        setSearch(label === activeChip ? "" : val)
    }

    // Animation presets
    const fadeUp = {
        hidden: { opacity: 0, y: 18 },
        visible: (i = 0) => ({
            opacity: 1, y: 0,
            transition: { type: "spring", stiffness: 90, damping: 18, delay: i * 0.07 }
        })
    }

    const stagger = {
        visible: { transition: { staggerChildren: 0.08 } }
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#0e0e10]">

            {/* Ambient glow — purely decorative */}
            <div className="
                pointer-events-none absolute top-0 left-1/2 -translate-x-1/2
                w-[700px] h-[350px] rounded-full
                bg-[#bcfe47]/[0.06] blur-[100px]
                z-0
            " />

            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative z-10">

                {initialLoading ? (
                    /* ── Loading ── */
                    <div className="flex flex-col items-center justify-center h-full min-h-dvh gap-4">
                        <LucideLoader className="w-10 h-10 animate-spin text-[#bcfe47]/60" />
                        <p className="text-neutral-500 text-sm animate-pulse">Cargando la tienda...</p>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

                        {/* ── Hero Slideshow ── */}
                        <div className="relative w-full">
                            <FeaturedSlideshow slides={featuredSlides} />
                        </div>

                        {/* ── Main Content ── */}
                        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-16 pb-16 space-y-8">

                            {/* Java Banner */}
                            {hasCompletedOnboarding && (
                                <motion.div variants={fadeUp} initial="hidden" animate="visible">
                                    <JavaStatusBanner />
                                </motion.div>
                            )}

                            {/* ── Header Card ── */}
                            <motion.div
                                variants={fadeUp}
                                initial="hidden"
                                animate="visible"
                                className="
                                    rounded-[22px] p-5
                                    bg-black/40 backdrop-blur-xl backdrop-saturate-150
                                    border border-white/[0.07]
                                    shadow-2xl
                                    space-y-4
                                "
                            >
                                {/* Greeting */}
                                <Greeting username={session?.username ?? null} />

                                {/* Search */}
                                <div className={`
                                    relative transition-all duration-300
                                    ${isSearchFocused ? "scale-[1.01]" : ""}
                                `}>
                                    {/* Glow ring on focus */}
                                    <div className={`
                                        absolute -inset-px rounded-[14px] pointer-events-none
                                        bg-gradient-to-r from-[#bcfe47]/40 to-[#05cc2a]/40
                                        transition-opacity duration-300
                                        ${isSearchFocused ? "opacity-100 blur-[3px]" : "opacity-0"}
                                    `} />

                                    <div className="relative flex items-center bg-black/50 rounded-[14px] border border-white/[0.08] overflow-hidden">
                                        <LucideSearch className={`
                                            ml-4 w-[18px] h-[18px] flex-shrink-0
                                            transition-colors duration-200
                                            ${isSearchFocused ? "text-[#bcfe47]" : "text-neutral-600"}
                                        `} />
                                        <input
                                            type="text"
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            onFocus={() => setIsSearchFocused(true)}
                                            onBlur={() => setIsSearchFocused(false)}
                                            placeholder="Buscar modpacks, mods..."
                                            className="
                                                w-full h-12 pl-3 pr-4 bg-transparent
                                                text-white placeholder-neutral-600
                                                text-[14px] font-medium
                                                focus:outline-none
                                            "
                                        />
                                        <AnimatePresence>
                                            {loading && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="pr-4"
                                                >
                                                    <LucideLoader className="w-4 h-4 animate-spin text-[#bcfe47]/60" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Filter chips */}
                                <div className="flex gap-2 flex-wrap">
                                    <FilterChip label="Popular" icon={LucideSparkles} active={activeChip === "Popular"} onClick={() => handleChip("Popular")} />
                                    <FilterChip label="Nuevos" icon={LucideZap} active={activeChip === "Nuevos"} onClick={() => handleChip("Nuevos")} />
                                    <FilterChip label="Tech" icon={LucideCpu} active={activeChip === "Tech"} onClick={() => handleChip("Tech")} />
                                    <FilterChip label="Magic" icon={LucideWand2} active={activeChip === "Magic"} onClick={() => handleChip("Magic")} />
                                    <FilterChip label="RPG" icon={LucideGamepad2} active={activeChip === "RPG"} onClick={() => handleChip("RPG")} />
                                </div>
                            </motion.div>

                            {/* ── Dynamic Content Zone ── */}
                            <AnimatePresence mode="wait" initial={false}>
                                {debouncedSearch.trim() !== "" ? (

                                    /* ── Search Results ── */
                                    <motion.div
                                        key="search"
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -16 }}
                                        transition={{ duration: 0.25 }}
                                    >
                                        <SectionHeader
                                            title={`Resultados para "${debouncedSearch}"`}
                                            subtitle={searchResults.length > 0 ? `${searchResults.length} encontrados` : undefined}
                                        />

                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center py-28 gap-3">
                                                <LucideLoader className="w-10 h-10 text-[#bcfe47]/50 animate-spin" />
                                                <p className="text-neutral-600 text-sm animate-pulse">Consultando la biblioteca...</p>
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            <motion.div
                                                variants={stagger}
                                                initial="hidden"
                                                animate="visible"
                                                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                                            >
                                                {searchResults.map((modpack, i) => (
                                                    <motion.div key={modpack.id} variants={fadeUp} custom={i}>
                                                        <ModpackCard modpack={modpack} to={`/modpack/${modpack.id}`} />
                                                    </motion.div>
                                                ))}
                                            </motion.div>
                                        ) : (
                                            <EmptySearch query={debouncedSearch} />
                                        )}
                                    </motion.div>

                                ) : (

                                    /* ── Home Feed ── */
                                    <motion.div
                                        key="home"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="space-y-10"
                                    >
                                        {/* Recommended */}
                                        {session && (
                                            <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                                <SectionHeader title="Recomendados para ti" subtitle="basado en tu historial" />
                                                <RecommendedModpacks
                                                    userId={session.id}
                                                    limit={5}
                                                    showFallbackLabel={true}
                                                />
                                            </motion.div>
                                        )}

                                        {/* Recent Activity */}
                                        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                                            <SectionHeader title="Actividad reciente" />
                                            <RecentActivity />
                                        </motion.div>

                                        {/* Categories */}
                                        {modpackCategories.map((category, i) => (
                                            <motion.div
                                                key={category.id}
                                                variants={fadeUp}
                                                custom={i}
                                                initial="hidden"
                                                whileInView="visible"
                                                viewport={{ once: true, margin: "-80px" }}
                                            >
                                                <SectionHeader
                                                    title={category.name}
                                                    subtitle={category.shortDescription}
                                                    href={`/category/${category.id}`}
                                                />
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
                                            className="pt-16 pb-4 flex flex-col items-center justify-center text-center group"
                                        >
                                            <div className="relative mb-5">
                                                <div className="
                                                    absolute inset-0 bg-[#bcfe47]/15 blur-2xl rounded-full
                                                    opacity-0 group-hover:opacity-100 transition-opacity duration-700
                                                " />
                                                <img
                                                    src="/images/minecraft_pj.webp"
                                                    draggable="false"
                                                    className="
                                                        relative h-28 w-auto object-contain
                                                        opacity-40 grayscale
                                                        group-hover:opacity-90 group-hover:grayscale-0 group-hover:scale-110
                                                        transition-all duration-500 drop-shadow-2xl
                                                    "
                                                    alt="Personaje de Minecraft"
                                                />
                                            </div>
                                            <p className="text-neutral-700 text-[10px] font-semibold tracking-[0.15em] uppercase">
                                                Explora · Crea · Juega
                                            </p>
                                            <p className="text-neutral-800 text-[10px] mt-1.5">
                                                Modpack Store &copy; {new Date().getFullYear()}
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}