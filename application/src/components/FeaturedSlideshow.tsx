import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { getModpacks } from "@/services/getModpacks";
import { Link } from "react-router-dom";
import { LucideChevronLeft, LucideChevronRight } from "lucide-react";

export const FeaturedSlideshow: React.FC<{ className?: string; heightClass?: string }> = ({
    className = "",
    heightClass = "h-60 md:h-80 lg:h-96",
}) => {
    const [slides, setSlides] = useState<any[]>([]);
    const [index, setIndex] = useState(0);
    const timerRef = useRef<number | null>(null);
    const interval = 5000; // 5s

    useEffect(() => {
        let mounted = true;
        getModpacks()
            .then((cats: any[]) => {
                // getModpacks returns categories, each with modpacks; flatten and filter featured
                const all: any[] = [];
                cats.forEach((c) => {
                    if (Array.isArray(c.modpacks)) all.push(...c.modpacks);
                });
                const featured = all.filter((m) => m.featured === true);
                if (mounted) setSlides(featured);
            })
            .catch((e) => {
                console.error("Failed to load modpacks for featured slideshow", e);
            });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        startTimer();
        return stopTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slides, index]);

    const startTimer = () => {
        stopTimer();
        timerRef.current = window.setInterval(() => {
            setIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
        }, interval);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const prev = () => {
        stopTimer();
        setIndex((i) => (slides.length ? (i - 1 + slides.length) % slides.length : 0));
        startTimer();
    };

    const next = () => {
        stopTimer();
        setIndex((i) => (slides.length ? (i + 1) % slides.length : 0));
        startTimer();
    };

    if (!slides || slides.length === 0) {
        return null; // nothing to show
    }

    return (
        <div
            className={`relative rounded-[40px] overflow-hidden w-full ${heightClass} ${className}`}
            onMouseEnter={stopTimer}
            onMouseLeave={startTimer}
        >
            <div className="absolute inset-0 overflow-hidden rounded-xl">
                <AnimatePresence mode="wait">
                    {slides.map((s, idx) => (
                        idx === index && (
                            <motion.div
                                key={s.id}
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -300, opacity: 0 }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                className={`absolute inset-0 bg-cover bg-center w-full h-full`}
                                style={{
                                    backgroundImage: `url(${s.bannerUrl || s.iconUrl || '/images/modpack-fallback.webp'})`,
                                    zIndex: 10,
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/70" />
                                <div
                                    style={{ maskImage: 'radial-gradient(ellipse at bottom left, black 30%, transparent 70%)' }}
                                    className="w-full h-full bg-black/80 absolute inset-0 select-none pointer-events-none"
                                />
                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="absolute left-6 bottom-8 max-w-xl text-white z-20"
                                >
                                    <motion.h3
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, delay: 0.3 }}
                                        className="text-2xl md:text-3xl font-bold leading-tight"
                                    >
                                        {s.name}
                                    </motion.h3>
                                    <motion.p
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, delay: 0.4 }}
                                        className="mt-2 text-sm md:text-base text-white/80 line-clamp-3"
                                    >
                                        {s.shortDescription || s.description}
                                    </motion.p>
                                    <motion.div
                                        initial={{ y: 30, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ duration: 0.4, delay: 0.5 }}
                                        className="mt-4 flex gap-3"
                                    >

                                        <Link to={`/modpack/${s.id}`} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md text-sm border border-white/10">
                                            Ver modpack
                                        </Link>
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        )
                    ))}
                </AnimatePresence>
            </div>

            {/* Navigation */}
            <motion.button
                onClick={prev}
                aria-label="Anterior"
                whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.7)" }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white"
            >
                <LucideChevronLeft className="w-5 h-5" />
            </motion.button>

            <motion.button
                onClick={next}
                aria-label="Siguiente"
                whileHover={{ scale: 1.1, backgroundColor: "rgba(0,0,0,0.7)" }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/60 p-2 rounded-full text-white"
            >
                <LucideChevronRight className="w-5 h-5" />
            </motion.button>

            {/* Indicators */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 flex items-center gap-2">
                {slides.map((_, i) => (
                    <motion.button
                        key={i}
                        onClick={() => setIndex(i)}
                        aria-label={`Ir a slide ${i + 1}`}
                        initial={{ scale: 1 }}
                        animate={{ scale: i === index ? 1.2 : 1 }}
                        transition={{ duration: 0.3 }}
                        className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default FeaturedSlideshow;
