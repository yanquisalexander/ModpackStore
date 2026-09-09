import React, { useEffect, useRef, useState } from "react";
import { useAd } from "@/hooks/useAd";
import { useNavigate } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { LucideExternalLink, LucideSparkles, LucideArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdSlotProps {
    placement: "explore_banner" | "modpack_sidebar" | "server_sponsor";
    className?: string;
}

export const AdSlot: React.FC<AdSlotProps> = ({ placement, className = "" }) => {
    const { ad, loading, isAdFree, trackImpression, trackClick } = useAd(placement);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasTrackedImpressionRef = useRef<boolean>(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();

    // Reset impression tracker if ad changes
    useEffect(() => {
        hasTrackedImpressionRef.current = false;
    }, [ad?.id]);

    // Viewability measurement via IntersectionObserver (visible >= 50% for >= 1s)
    useEffect(() => {
        if (!ad || hasTrackedImpressionRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    if (!timerRef.current && !hasTrackedImpressionRef.current) {
                        timerRef.current = setTimeout(() => {
                            if (!hasTrackedImpressionRef.current && ad) {
                                hasTrackedImpressionRef.current = true;
                                trackImpression(ad.id);
                            }
                        }, 1000);
                    }
                } else {
                    if (timerRef.current) {
                        clearTimeout(timerRef.current);
                        timerRef.current = null;
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
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [ad, trackImpression]);

    // Don't render anything if user is ad-free or ad is not loaded
    if (isAdFree || loading || !ad) {
        return null;
    }

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        trackClick(ad.id);

        if (ad.targetModpackId) {
            navigate(`/modpack/${ad.targetModpackId}`);
        } else if (ad.targetUrl) {
            try {
                await openUrl(ad.targetUrl);
            } catch (err) {
                console.error("[AdSlot] Failed to open external URL:", err);
            }
        }
    };

    // ── Variant: Explore Horizontal Banner ──
    if (placement === "explore_banner") {
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
                        src={ad.mediaUrl}
                        alt={ad.title}
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
                                {ad.badgeText || "Destacado"}
                            </span>
                            {ad.creator && (
                                <span className="text-xs text-neutral-400">
                                    por {ad.creator.name}
                                </span>
                            )}
                        </div>

                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-[#bcfe47] transition-colors">
                            {ad.title}
                        </h3>

                        {ad.subtitle && (
                            <p className="text-xs sm:text-sm text-neutral-300 line-clamp-2 leading-relaxed">
                                {ad.subtitle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-[#bcfe47] text-white hover:text-black font-semibold text-sm transition-all duration-200 border border-white/[0.1] hover:border-[#bcfe47] shadow-lg group-hover:translate-x-0.5">
                            <span>{ad.ctaText || "Ver más"}</span>
                            {ad.targetUrl ? (
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

    // ── Variant: Modpack Sidebar / Detail Box ──
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
                    src={ad.mediaUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 left-2">
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-black/70 text-neutral-200 backdrop-blur-sm border border-white/10">
                        {ad.badgeText || "Sponsor"}
                    </span>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-semibold text-white group-hover:text-[#bcfe47] transition-colors">
                    {ad.title}
                </h4>
                {ad.subtitle && (
                    <p className="text-xs text-neutral-400 line-clamp-2 mt-1">
                        {ad.subtitle}
                    </p>
                )}
            </div>

            <div className="pt-1 flex items-center justify-between text-xs text-[#bcfe47] font-medium">
                <span>{ad.ctaText || "Descubrir"}</span>
                <LucideArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
        </motion.div>
    );
};
