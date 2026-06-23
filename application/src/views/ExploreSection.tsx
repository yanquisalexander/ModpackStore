import { useEffect, useState, useRef, useCallback } from "react"
import { useGlobalContext } from "../stores/GlobalContext"
import { useSearchBar } from "../stores/SearchBarContext"
import { TitleBarSearch } from "@/components/appbar/TitleBarSearch"
import {
    LucideLoader, LucideSearch, LucideShoppingBag
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
    const { query: search, setQuery: setSearch } = useSearchBar()
    const [debouncedSearch] = useDebounce(search, 300)

    const [barrelRolling, setBarrelRolling] = useState(false)

    const { onboardingStatus } = useOnboarding()
    const { session } = useAuthentication()
    const hasCompletedOnboarding = onboardingStatus?.first_run_at !== null

    // Easter egg: "do a barrel roll"
    const lastCheckedRef = useRef("")
    useEffect(() => {
        const q = search.trim().toLowerCase()
        if (q === "do a barrel roll" && lastCheckedRef.current !== q) {
            lastCheckedRef.current = q
            setBarrelRolling(true)
            setTimeout(() => {
                setBarrelRolling(false)
                setSearch("")
            }, 1000)
        } else if (q !== "do a barrel roll") {
            lastCheckedRef.current = q
        }
    }, [search])

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
            rightSlot: <TitleBarSearch />,
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

        return () => {
            clearActivity().catch(console.error)
            setTitleBarState(prev => ({
                ...prev,
                rightSlot: undefined,
                centerSlot: undefined,
            }))
        }
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

            <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto custom-scrollbar scroll-smooth relative ${barrelRolling ? "barrel-roll" : ""}`}
            >

                {initialLoading ? (
                    /* ── Loading ── */
                    <div className="flex flex-col items-center justify-center h-full min-h-full gap-4">
                        <LucideLoader className="w-10 h-10 animate-spin text-[#bcfe47]/60" />
                        <p className="text-neutral-500 text-sm animate-pulse">Cargando la tienda...</p>
                    </div>
                ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>

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
                                    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16 pt-6">

                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center py-28 gap-3">
                                                <LucideLoader className="w-10 h-10 text-[#bcfe47]/50 animate-spin" />
                                                <p className="text-neutral-600 text-sm animate-pulse">Consultando la biblioteca...</p>
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            <>
                                                <p className="text-xs text-neutral-600 mb-4">{searchResults.length} resultados</p>
                                                <motion.div
                                                    variants={stagger}
                                                    initial="hidden"
                                                    animate="visible"
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
                                    </div>
                                </motion.div>

                            ) : (

                                /* ── Home Feed ── */
                                <motion.div
                                    key="home"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {/* ── Hero Slideshow (solo si hay destacados) ── */}
                                    {featuredSlides.length > 0 && (
                                        <FeaturedSlideshow slides={featuredSlides} />
                                    )}

                                    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16 space-y-8">

                                        {/* Java Banner */}
                                        {hasCompletedOnboarding && (
                                            <motion.div variants={fadeUp} initial="hidden" animate="visible" className="pt-3">
                                                <JavaStatusBanner />
                                            </motion.div>
                                        )}

                                        {/* Recommended */}
                                        {session && (
                                            <RecommendedModpacks
                                                userId={session.id}
                                                limit={5}
                                                showFallbackLabel={true}
                                            />
                                        )}

                                        {/* Recent Activity */}
                                        <RecentActivity />

                                        {/* Categories (solo con modpacks) */}
                                        {modpackCategories
                                            .filter(c => c.modpacks?.length > 0)
                                            .map((category, i) => (
                                                <motion.div
                                                    key={category.id}
                                                    variants={fadeUp}
                                                    custom={i}
                                                    initial="hidden"
                                                    whileInView="visible"
                                                    viewport={{ once: true, margin: "-80px" }}
                                                >
                                                    <CategoryHorizontalSection
                                                        id={category.id}
                                                        title={category.name}
                                                        shortDescription={category.shortDescription}
                                                        modpacks={category.modpacks}
                                                    />
                                                </motion.div>
                                            ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>
        </div>
    )
}