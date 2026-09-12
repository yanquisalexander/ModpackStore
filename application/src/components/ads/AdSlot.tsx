import React, { useEffect, useRef, useState, useMemo } from "react";
import { useAd, AdData } from "@/hooks/useAd";
import { useNavigate } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LucideExternalLink, LucideSparkles, LucideArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { externalAds, ExternalAdConfig } from "./externalAdsConfig";
import { ExternalAdRenderer } from "./ExternalAdRenderer";

interface AdSlotProps {
    placement: "explore_banner" | "modpack_sidebar" | "server_sponsor";
    className?: string;
    rotationInterval?: number;
}

type PoolItem =
    | { kind: "internal"; ad: AdData }
    | { kind: "external"; config: ExternalAdConfig };

function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export const AdSlot: React.FC<AdSlotProps> = ({
    placement,
    className = "",
    rotationInterval = 300_000,
}) => {
    const { ads, loading, isAdFree, trackImpression, trackClick } = useAd(placement);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasTrackedImpressionRef = useRef<boolean>(false);
    const impressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [rotationIndex, setRotationIndex] = useState(0);
    const navigate = useNavigate();

    const pool = useMemo<PoolItem[]>(() => {
        const internal: PoolItem[] = ads.map((a) => ({ kind: "internal", ad: a }));
        const external: PoolItem[] = externalAds
            .filter((e) => e.placement === placement)
            .map((e) => ({ kind: "external", config: e }));

        if (internal.length === 0) return shuffleArray(external);
        if (external.length === 0) return shuffleArray(internal);

        const totalSlots = internal.length + external.length;
        const externalTarget = Math.max(1, Math.round(totalSlots * 0.3));
        const internalTarget = totalSlots - externalTarget;

        const pickedInternal = shuffleArray(internal).slice(0, internalTarget);
        const pickedExternal = shuffleArray(external).slice(0, externalTarget);

        return shuffleArray([...pickedInternal, ...pickedExternal]);
    }, [ads, placement]);

    const currentItem = pool.length > 0 ? pool[rotationIndex % pool.length] : null;
    const currentInternalAd = currentItem?.kind === "internal" ? currentItem.ad : null;
    const currentExternalConfig = currentItem?.kind === "external" ? currentItem.config : null;
    const isExternal = currentItem?.kind === "external";

    // Reset impression tracker on rotation change
    useEffect(() => {
        hasTrackedImpressionRef.current = false;
    }, [rotationIndex]);

    // Rotation timer
    useEffect(() => {
        if (pool.length <= 1) return;

        rotationTimerRef.current = setInterval(() => {
            setRotationIndex((prev) => (prev + 1) % pool.length);
        }, rotationInterval);

        return () => {
            if (rotationTimerRef.current) {
                clearInterval(rotationTimerRef.current);
                rotationTimerRef.current = null;
            }
        };
    }, [pool.length, rotationInterval]);

    // Viewability measurement via IntersectionObserver (visible >= 50% for >= 1s)
    useEffect(() => {
        if (!currentInternalAd || hasTrackedImpressionRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    if (!impressionTimerRef.current && !hasTrackedImpressionRef.current) {
                        impressionTimerRef.current = setTimeout(() => {
                            if (!hasTrackedImpressionRef.current && currentInternalAd) {
                                hasTrackedImpressionRef.current = true;
                                trackImpression(currentInternalAd.id);
                            }
                        }, 1000);
                    }
                } else {
                    if (impressionTimerRef.current) {
                        clearTimeout(impressionTimerRef.current);
                        impressionTimerRef.current = null;
                    }
                }
            },
            { threshold: [0.5] }
        );

        const currentElement = containerRef.current;
        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) observer.unobserve(currentElement);
            if (impressionTimerRef.current) clearTimeout(impressionTimerRef.current);
        };
    }, [currentInternalAd, trackImpression]);

    // Cleanup all timers on unmount
    useEffect(() => {
        return () => {
            if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
            if (impressionTimerRef.current) clearTimeout(impressionTimerRef.current);
        };
    }, []);

    if (isAdFree || loading || pool.length === 0) {
        return null;
    }

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!currentInternalAd) return;

        trackClick(currentInternalAd.id);

        if (currentInternalAd.targetModpackId) {
            navigate(`/modpack/${currentInternalAd.targetModpackId}`);
        } else if (currentInternalAd.targetUrl) {
            try {
                await openUrl(currentInternalAd.targetUrl);
            } catch (err) {
                console.error("[AdSlot] Failed to open external URL:", err);
            }
        }
    };

    // ── Render external ad ──
    if (isExternal && currentExternalConfig) {
        const variant = placement === "modpack_sidebar" ? "sidebar" : "banner";
        return (
            <div ref={containerRef} data-slot="ad-slot" className={`overflow-hidden ${className}`}>
                <ExternalAdRenderer config={currentExternalConfig} variant={variant} />
            </div>
        );
    }

    // ── Render internal ad: Explore Horizontal Banner ──
    if (currentInternalAd && placement === "explore_banner") {
        return (
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className={`relative group rounded-2xl overflow-hidden border border-white/[0.08] bg-[#121215] hover:border-white/[0.18] transition-all duration-300 shadow-xl ${className}`}
                onClick={handleClick}
                role="button"
                tabIndex={0}
            >
                {/* Background image / overlay */}
                <div className="absolute inset-0 z-0">
                    <img
                        src={currentInternalAd.mediaUrl}
                        alt={currentInternalAd.title}
                        className="w-full h-full object-cover object-center opacity-35 group-hover:opacity-45 group-hover:scale-[1.02] transition-all duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e11] via-[#0e0e11]/85 to-transparent" />
                </div>

                {/* Content */}
                <div className="relative z-10 p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="space-y-1.5 max-w-2xl">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#bcfe47]/15 text-[#bcfe47] border border-[#bcfe47]/20">
                                <LucideSparkles className="w-3 h-3" />
                                {currentInternalAd.badgeText || "Destacado"}
                            </span>
                            {currentInternalAd.creator && (
                                <span className="text-xs text-neutral-400">
                                    por {currentInternalAd.creator.name}
                                </span>
                            )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-[#bcfe47] transition-colors">
                            {currentInternalAd.title}
                        </h3>

                        {currentInternalAd.subtitle && (
                            <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 leading-relaxed">
                                {currentInternalAd.subtitle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-[#bcfe47] text-white hover:text-black font-semibold text-sm transition-all duration-200 border border-white/[0.1] hover:border-[#bcfe47] shadow-lg group-hover:translate-x-0.5">
                            <span>{currentInternalAd.ctaText || "Ver más"}</span>
                            {currentInternalAd.targetUrl ? (
                                <LucideExternalLink className="w-4 h-4" />
                            ) : (
                                <LucideArrowRight className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    // ── Render internal ad: Sidebar / Detail Box ──
    if (currentInternalAd) {
        return (
            <motion.div
                ref={containerRef}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative rounded-xl overflow-hidden border border-white/[0.08] bg-[#141418] hover:border-white/[0.18] transition-all p-4 space-y-3 cursor-pointer group shadow-lg ${className}`}
                onClick={handleClick}
                role="button"
                tabIndex={0}
            >
                <div className="relative w-full h-28 rounded-lg overflow-hidden bg-black/40">
                    <img
                        src={currentInternalAd.mediaUrl}
                        alt={currentInternalAd.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-black/70 text-neutral-200 backdrop-blur-sm border border-white/10">
                            {currentInternalAd.badgeText || "Sponsor"}
                        </span>
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-[#bcfe47] transition-colors">
                        {currentInternalAd.title}
                    </h4>
                    {currentInternalAd.subtitle && (
                        <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                            {currentInternalAd.subtitle}
                        </p>
                    )}
                </div>

                <div className="pt-1 flex items-center justify-between text-xs text-[#bcfe47] font-medium">
                    <span>{currentInternalAd.ctaText || "Descubrir"}</span>
                    <LucideArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
            </motion.div>
        );
    }

    return null;
};
