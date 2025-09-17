import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { getModpacks } from "@/services/getModpacks";
import { Link } from "react-router-dom";
import { LucideChevronLeft, LucideChevronRight, LucideGamepad2, LucidePlay, LucideStar } from "lucide-react";

export const FeaturedSlideshow: React.FC<{ className?: string; heightClass?: string }> = ({
    className = "",
    heightClass = "h-60 md:h-96 lg:h-96",
}) => {
    const [slides, setSlides] = useState<any[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [isHydrated, setIsHydrated] = useState(false);
    const timerRef = useRef<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const interval = 6000; // 6s

    // Scroll-based parallax effect - use global scroll for simplicity
    const { scrollYProgress } = useScroll();
    const parallaxY = useTransform(scrollYProgress, [0, 1], [0, -50]);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        let mounted = true;
        getModpacks()
            .then((cats: any[]) => {
                const all: any[] = [];
                cats.forEach((c) => {
                    if (Array.isArray(c.modpacks)) all.push(...c.modpacks);
                });
                const featured = all.filter((m) => m.featured === true);
                if (mounted && featured.length > 0) {
                    setSlides(featured);
                }
            })
            .catch((e) => {
                console.error("Failed to load modpacks for featured slideshow", e);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (isAutoPlaying && slides.length > 1) {
            startTimer();
        } else {
            stopTimer();
        }
        return stopTimer;
    }, [slides, activeIndex, isAutoPlaying]);

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
            className={`relative rounded-[40px] w-full ${heightClass} ${className}`}
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
        >
            {/* Background blur layers for depth */}

            <div className="absolute inset-0 rounded-[40px]">
                {/* Corrected: The background blur layer should be from the current slide */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`blur-${currentSlide.id}`}
                        className="absolute inset-0 bg-cover bg-center w-full h-full opacity-30 rounded-[40px] overflow-auto blur-lg"
                        style={{
                            backgroundImage: `url(${currentSlide.bannerUrl || currentSlide.iconUrl || '/images/modpack-fallback.webp'})`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                    />
                </AnimatePresence>
            </div>

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
                    className="absolute w-full h-full rounded-[40px] overflow-hidden"
                    style={{
                        y: parallaxY,
                    }}
                >
                    <img
                        src={currentSlide.bannerUrl || currentSlide.iconUrl || '/images/modpack-fallback.webp'}
                        className="absolute inset-0 w-full h-full object-cover z-10"
                        alt="Slide background"
                    />
                    {/* Gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 z-20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent z-20" />

                    {/* Content */}
                    <motion.div
                        initial={{ y: 60, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="absolute left-6 md:left-12 bottom-12 md:bottom-16 max-w-xl text-white z-30"
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.4 }}
                            className="mb-2"
                        >
                            <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 px-3 py-1 rounded-full text-xs font-medium border border-white/10">
                                <LucideStar className="w-3 h-3" />
                                Destacado
                            </span>
                        </motion.div>

                        <motion.h3
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                            className="text-2xl md:text-4xl lg:text-5xl font-bold leading-tight mb-3"
                        >
                            {currentSlide.name}
                        </motion.h3>

                        <motion.p
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.6 }}
                            className="text-sm md:text-base text-white/90 line-clamp-3 mb-6 max-w-md"
                        >
                            {currentSlide.shortDescription || currentSlide.description}
                        </motion.p>

                        <motion.div
                            initial={{ y: 30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.7 }}
                            className="flex gap-3"
                        >
                            <Link
                                to={`/modpack/${currentSlide.id}`}
                                className="group inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
                            >
                                <LucideGamepad2 className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                Ver modpack
                            </Link>
                        </motion.div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            {slides.length > 1 && (
                <>
                    <motion.button
                        onClick={goToPrev}
                        aria-label="Anterior"
                        whileHover={{ scale: 1.1, x: -2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/20 backdrop-blur-md hover:bg-black/40 p-3 rounded-full text-white border border-white/10 hover:border-white/20 transition-all duration-300"
                    >
                        <LucideChevronLeft className="w-5 h-5" />
                    </motion.button>

                    <motion.button
                        onClick={goToNext}
                        aria-label="Siguiente"
                        whileHover={{ scale: 1.1, x: 2 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/20 backdrop-blur-md hover:bg-black/40 p-3 rounded-full text-white border border-white/10 hover:border-white/20 transition-all duration-300"
                    >
                        <LucideChevronRight className="w-5 h-5" />
                    </motion.button>
                </>
            )}

            {/* Progress indicators */}
            {slides.length > 1 && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-30 flex items-center gap-3">
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
                            {i === activeIndex && (
                                <motion.div
                                    className="absolute inset-0 bg-white rounded-full"
                                    initial={{ x: "-100%" }}
                                    animate={{ x: isAutoPlaying ? "100%" : "0%" }}
                                    transition={{
                                        duration: isAutoPlaying ? interval / 1000 : 0,
                                        ease: "linear",
                                        repeat: isAutoPlaying ? Infinity : 0,
                                    }}
                                />
                            )}
                        </motion.button>
                    ))}
                </div>
            )}

            {/* Auto-play indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isAutoPlaying ? 0 : 1 }}
                className="absolute top-4 right-4 z-30 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-white/80 text-xs"
            >
                Pausado
            </motion.div>
        </div>
    );
};

export default FeaturedSlideshow;
