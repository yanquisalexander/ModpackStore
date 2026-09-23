import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getModpacks } from "@/services/getModpacks";
import { Link } from "react-router-dom";
import { LucideChevronLeft, LucideChevronRight, LucideGamepad2, LucideStar, LucideExternalLink, LucideSparkles } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { API_ENDPOINT } from "@/consts";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export const FeaturedSlideshow: React.FC<{
    className?: string;
    heightClass?: string;
    compact?: boolean;
    slides?: any[];
}> = ({
    className = "",
    heightClass = "h-60 md:h-96 lg:h-96",
    compact = false,
    slides: propSlides = [],
}) => {
        const [slides, setSlides] = useState<any[]>(propSlides);
        const [activeIndex, setActiveIndex] = useState(0);
        const [isAutoPlaying, setIsAutoPlaying] = useState(true);
        const timerRef = useRef<number | null>(null);
        const containerRef = useRef<HTMLDivElement>(null);
        const interval = 6000; // 6s

        useEffect(() => {
            setSlides(propSlides);
        }, [propSlides]);

        useEffect(() => {
            let mounted = true;
            if (propSlides.length === 0) {
                // Fallback to old behavior if no slides provided
                getModpacks()
                    .then(({ featured }) => {
                        // Use featured directly
                        console.log('FeaturedSlideshow: Featured modpacks found:', featured.length);
                        console.log('FeaturedSlideshow: Featured modpacks:', featured.map(m => ({ id: m.id, name: m.name, featured: m.featured })));

                        if (mounted && featured.length > 0) {
                            setSlides(featured);
                        }
                    })
                    .catch((e) => {
                        console.error("Failed to load modpacks for featured slideshow", e);
                    });
            }

            return () => {
                mounted = false;
            };
        }, [propSlides.length]);

        useEffect(() => {
            if (isAutoPlaying && slides.length > 1) {
                startTimer();
            } else {
                stopTimer();
            }
            return stopTimer;
        }, [slides, activeIndex, isAutoPlaying]);

        // Track impression on active slide if it's sponsored (> 1 second view)
        useEffect(() => {
            const current = slides[activeIndex];
            if (current?.campaignId) {
                const timer = setTimeout(() => {
                    fetchWithAuth(`${API_ENDPOINT}/ads/track/impression`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ campaignId: current.campaignId }),
                    }).catch(() => {});
                }, 1000);
                return () => clearTimeout(timer);
            }
        }, [activeIndex, slides]);

        const startTimer = () => {
            stopTimer();
            timerRef.current = window.setInterval(() => {
                setActiveIndex((i) => (i + 1) % slides.length);
            }, interval);
        };

        const stopTimer = () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };

        const goToSlide = (index: number) => {
            setActiveIndex(index);
            stopTimer();
            if (isAutoPlaying) startTimer();
        };

        const goToPrev = () => {
            const newIndex = activeIndex === 0 ? slides.length - 1 : activeIndex - 1;
            goToSlide(newIndex);
        };

        const goToNext = () => {
            const newIndex = (activeIndex + 1) % slides.length;
            goToSlide(newIndex);
        };

        if (!slides || slides.length === 0) {
            return null;
        }

        const currentSlide = slides[activeIndex];

        return (
            <div
                ref={containerRef}
                className={`relative w-full  ${heightClass} ${className}`} // <-- overflow-hidden REMOVED HERE
                onMouseEnter={() => setIsAutoPlaying(false)}
                onMouseLeave={() => setIsAutoPlaying(true)}
            >
                <div className="absolute inset-0 overflow-hidden">
                    {/* Main slide */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide.id}
                            initial={{ x: 300, opacity: 0, scale: 1.1 }}
                            animate={{ x: 0, opacity: 1, scale: 1 }}
                            exit={{ x: -300, opacity: 0, scale: 0.9 }}
                            transition={{
                                duration: 0.8,
                                ease: [0.25, 0.46, 0.45, 0.94],
                                scale: { duration: 1.2 }
                            }}
                            className="absolute w-full h-full"
                        >
                            <img
                                draggable={false}
                                src={currentSlide.bannerUrl || currentSlide.iconUrl || '/images/modpack-fallback.webp'}
                                alt="Slide background"
                                className={`absolute inset-0 h-full object-cover z-10 ${compact ? 'w-[55%] right-0 left-auto object-right' : 'w-full object-cover'}`}
                                style={compact ? {
                                    maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 100%)',
                                    WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 100%)',
                                } : {
                                    maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
                                    WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
                                }}
                            />

                            {/* Gradient overlay for compact mode */}
                            {compact && (
                                <div
                                    className="absolute inset-0 z-20 pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.2) 65%, transparent 80%)',
                                    }}
                                />
                            )}

                            {/* CONTENT BLOCK */}
                            {compact ? (
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                    className="absolute z-30 left-6 md:left-10 top-1/2 -translate-y-1/2 w-[55%] flex flex-col items-start gap-2"
                                >
                                    <motion.div
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.5 }}
                                    >
                                        <h3 className="text-base md:text-lg font-bold mb-1 [text-shadow:0_3px_10px_rgba(0,0,0,0.8)]">
                                            {currentSlide.name}
                                        </h3>
                                        <p className="text-xs md:text-sm text-white/80 max-w-sm line-clamp-2 [text-shadow:0_2px_6px_rgba(0,0,0,0.7)]">
                                            {currentSlide.shortDescription || currentSlide.description}
                                        </p>
                                    </motion.div>
                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.5, delay: 0.7 }}
                                    >
                                        {currentSlide.targetUrl ? (
                                            <button
                                                onClick={async () => {
                                                    if (currentSlide.campaignId) {
                                                        fetchWithAuth(`${API_ENDPOINT}/ads/track/click`, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ campaignId: currentSlide.campaignId })
                                                        }).catch(() => {});
                                                    }
                                                    await openUrl(currentSlide.targetUrl);
                                                }}
                                                className="group inline-flex items-center gap-2 bg-[#bcfe47] hover:bg-[#a5e833] text-black px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                            >
                                                <LucideExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                {currentSlide.ctaText || "Descubrir"}
                                            </button>
                                        ) : (
                                            <Link
                                                draggable={false}
                                                to={`/modpack/${currentSlide.targetModpackId || currentSlide.id}`}
                                                onClick={() => {
                                                    if (currentSlide.campaignId) {
                                                        fetchWithAuth(`${API_ENDPOINT}/ads/track/click`, {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ campaignId: currentSlide.campaignId })
                                                        }).catch(() => {});
                                                    }
                                                }}
                                                className="group inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                            >
                                                <LucideGamepad2 className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                                {currentSlide.ctaText || "Ver modpack"}
                                            </Link>
                                        )}
                                    </motion.div>
                                </motion.div>
                            ) : (
                            <>
                            <motion.div
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="absolute left-1/2 -translate-x-1/2 bottom-2 w-full max-w-2xl text-white text-center z-30 px-4"
                            >
                                <motion.h3
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.5 }}
                                    className="text-xl md:text-3xl font-bold mb-2 [text-shadow:0_3px_10px_rgba(0,0,0,0.8)]"
                                >
                                    {currentSlide.name}
                                </motion.h3>

                                <motion.p
                                    initial={{ y: 30, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.6 }}
                                    className="text-sm md:text-base text-white/80 max-w-lg mx-auto mb-4 [text-shadow:0_2px_6px_rgba(0,0,0,0.7)]"
                                >
                                    {currentSlide.shortDescription || currentSlide.description}
                                </motion.p>

                            </motion.div>
                            <motion.div
                                initial={{ y: 30, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.5, delay: 0.7 }}
                                className="absolute bottom-6 right-4 z-30"
                            >
                                {currentSlide.targetUrl ? (
                                    <button
                                        onClick={async () => {
                                            if (currentSlide.campaignId) {
                                                fetchWithAuth(`${API_ENDPOINT}/ads/track/click`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ campaignId: currentSlide.campaignId })
                                                }).catch(() => {});
                                            }
                                            await openUrl(currentSlide.targetUrl);
                                        }}
                                        className="group inline-flex items-center gap-2 bg-[#bcfe47] hover:bg-[#a5e833] text-black px-6 py-3 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                    >
                                        <LucideExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        {currentSlide.ctaText || "Descubrir"}
                                    </button>
                                ) : (
                                    <Link
                                        draggable={false}
                                        to={`/modpack/${currentSlide.targetModpackId || currentSlide.id}`}
                                        onClick={() => {
                                            if (currentSlide.campaignId) {
                                                fetchWithAuth(`${API_ENDPOINT}/ads/track/click`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ campaignId: currentSlide.campaignId })
                                                }).catch(() => {});
                                            }
                                        }}
                                        className="group inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                                    >
                                        <LucideGamepad2 className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                        {currentSlide.ctaText || "Ver modpack"}
                                    </Link>
                                )}
                            </motion.div>
                            </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Featured / Sponsored badge */}
                {!compact && (
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="absolute top-6 left-6 z-40"
                >
                    {currentSlide.isSponsored ? (
                        <span className="inline-flex items-center gap-1.5 bg-[#bcfe47]/20 backdrop-blur-md text-[#bcfe47] px-3.5 py-1.5 rounded-full text-xs font-semibold border border-[#bcfe47]/30 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                            <LucideSparkles className="w-3.5 h-3.5" />
                            {currentSlide.badgeText || "Patrocinado"}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-2 bg-black/30 backdrop-blur-md text-white/95 px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
                            <LucideStar className="w-3.5 h-3.5" />
                            Destacado
                        </span>
                    )}
                </motion.div>
                )}

                {/* Navigation buttons */}
                {slides.length > 1 && !compact && (
                    <>
                        <motion.button
                            onClick={goToPrev}
                            aria-label="Anterior"
                            whileHover={{ scale: 1.1, x: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 z-30 bg-black/20 backdrop-blur-md hover:bg-black/40 p-3 rounded-full text-white border border-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <LucideChevronLeft className="w-5 h-5" />
                        </motion.button>

                        <motion.button
                            onClick={goToNext}
                            aria-label="Siguiente"
                            whileHover={{ scale: 1.1, x: 2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 z-30 bg-black/20 backdrop-blur-md hover:bg-black/40 p-3 rounded-full text-white border border-white/10 hover:border-white/20 transition-all duration-300"
                        >
                            <LucideChevronRight className="w-5 h-5" />
                        </motion.button>
                    </>
                )}

                {/* Progress indicators */}
                {slides.length > 1 && !compact && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-30 flex items-center gap-3 px-4">
                        {slides.map((_, i) => (
                            <motion.button
                                key={i}
                                onClick={() => goToSlide(i)}
                                aria-label={`Ir a slide ${i + 1}`}
                                className={`relative overflow-hidden rounded-full transition-all duration-300 ${i === activeIndex
                                    ? "w-8 h-3 bg-white"
                                    : "w-3 h-3 bg-white/40 hover:bg-white/60"
                                    }`}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {i === activeIndex && isAutoPlaying && (
                                    <motion.div
                                        className="absolute top-0 left-0 h-full bg-white/50"
                                        initial={{ width: "0%" }}
                                        animate={{ width: "100%" }}
                                        transition={{
                                            duration: interval / 1000,
                                            ease: "linear",
                                        }}
                                    />
                                )}
                            </motion.button>
                        ))}
                    </div>
                )}

            </div>
        );
    };

export default FeaturedSlideshow;