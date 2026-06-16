import { useState, useRef, useEffect } from "react";
import { ModpackCard } from "./ModpackCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ScrollControlProps = {
    direction: 'left' | 'right';
    onClick: () => void;
    isVisible: boolean;
};

const ScrollControl = ({ direction, onClick, isVisible }: ScrollControlProps) => {
    const isLeft = direction === 'left';

    const gradientClass = isLeft
        ? 'bg-gradient-to-r from-ms-primary to-transparent'
        : 'bg-gradient-to-l from-ms-primary to-transparent';

    const buttonPositionClass = isLeft ? 'left-4' : 'right-4';

    return (
        <>
            <div
                style={{ opacity: isVisible ? 1 : 0 }}
                className={`pointer-events-none absolute top-0 bottom-0 ${isLeft ? 'left-0' : 'right-0'} w-40 transition-opacity duration-300 z-10 ${gradientClass}`}
            />
            {isVisible && (
                <button
                    onClick={onClick}
                    className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-opacity bg-neutral-800/80 hover:bg-neutral-700 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg z-20 ${buttonPositionClass}`}
                    aria-label={`Scroll ${direction}`}
                >
                    {isLeft ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                </button>
            )}
        </>
    );
};

export const CategoryHorizontalSection = ({
    id,
    title,
    shortDescription,
    modpacks = [],
}: {
    id: string;
    title: string;
    shortDescription?: string;
    modpacks: any[];
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    const updateArrowVisibility = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        const scrollEndBuffer = 10;

        setShowLeftArrow(scrollLeft > 0);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - scrollEndBuffer);
    };

    useEffect(() => {
        updateArrowVisibility();
        window.addEventListener('resize', updateArrowVisibility);
        return () => window.removeEventListener('resize', updateArrowVisibility);
    }, [modpacks]);

    const scroll = (offset: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    };

    return (
        <div className="mb-10 z-10">
            <div className="flex justify-between items-end mb-4 px-4">
                <div className="flex flex-col">
                    <h3 className="text-base font-semibold text-white/90">{title}</h3>
                    {shortDescription && (
                        <p className="text-neutral-600 text-xs mt-0.5">{shortDescription}</p>
                    )}
                </div>
                <a
                    href={`/category/${id}`}
                    className="text-neutral-500 hover:text-[#bcfe47] text-xs font-medium transition-colors"
                >
                    Ver todo
                </a>
            </div>

            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    onScroll={updateArrowVisibility}
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 px-4 scroll-p-4"
                >
                    {modpacks.length > 0 &&
                        modpacks.map((modpack) => (
                            <div
                                key={modpack.id}
                                className="snap-start flex-shrink-0 md:w-60 lg:w-72"
                            >
                                <ModpackCard modpack={modpack} to={`/modpack/${modpack.id}`} />
                            </div>
                        ))}
                </div>

                <ScrollControl
                    direction="left"
                    onClick={() => scroll(-350)}
                    isVisible={showLeftArrow}
                />
                <ScrollControl
                    direction="right"
                    onClick={() => scroll(350)}
                    isVisible={showRightArrow}
                />
            </div>
        </div>
    );
};