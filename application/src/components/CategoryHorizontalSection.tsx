import { useState, useRef, useEffect, FC } from "react";
// Asegúrate de tener estas importaciones si aún no las tienes
import { ModpackCard } from "./ModpackCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

// --- COMPONENTE AUXILIAR PARA LOS CONTROLES DE SCROLL ---
// Esta versión refina el comportamiento visual del gradiente y la flecha.

type ScrollControlProps = {
    direction: 'left' | 'right';
    onClick: () => void;
    isVisible: boolean; // Esta prop controla todo
};

const ScrollControl: FC<ScrollControlProps> = ({ direction, onClick, isVisible }) => {
    const isLeft = direction === 'left';

    const gradientClass = isLeft
        ? 'bg-gradient-to-r from-ms-primary to-transparent'
        : 'bg-gradient-to-l from-ms-primary to-transparent';

    const buttonPositionClass = isLeft ? 'left-4' : 'right-4';

    return (
        <>
            {/* GRADIENTE:
              - Siempre está en el DOM para que la transición de opacidad funcione.
              - Su visibilidad (`opacity`) se anima suavemente gracias a `transition-opacity`.
            */}
            <div
                style={{ opacity: isVisible ? 1 : 0 }}
                className={`pointer-events-none absolute top-0 bottom-0 ${isLeft ? 'left-0' : 'right-0'} w-40 transition-opacity duration-300 z-10 ${gradientClass}`}
            />

            {/* FLECHA (BOTÓN):
              - Solo se renderiza en el DOM cuando `isVisible` es true.
              - Esto hace que aparezca y desaparezca junto con el gradiente.
            */}
            {isVisible && (
                <button
                    onClick={onClick}
                    className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-opacity bg-gray-800/80 hover:bg-gray-700 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg z-20 ${buttonPositionClass}`}
                    aria-label={`Scroll ${direction}`}
                >
                    {isLeft ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
                </button>
            )}
        </>
    );
};


// --- COMPONENTE PRINCIPAL (SIN CAMBIOS, YA ERA CORRECTO) ---
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
    href?: string;
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    // ESTA FUNCIÓN ES EL "CEREBRO" DE LA LÓGICA
    const updateArrowVisibility = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        const scrollEndBuffer = 10; // Margen de seguridad

        // Condición para la flecha izquierda: ¿Nos hemos movido del inicio?
        setShowLeftArrow(scrollLeft > 0);

        // Condición para la flecha derecha: ¿Aún no hemos llegado al final?
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - scrollEndBuffer);
    };

    // Se asegura de que la visibilidad sea correcta al cargar y al cambiar tamaño
    useEffect(() => {
        updateArrowVisibility(); // Llamada inicial
        window.addEventListener('resize', updateArrowVisibility);
        return () => window.removeEventListener('resize', updateArrowVisibility);
    }, [modpacks]); // Se re-ejecuta si los modpacks cambian

    const scroll = (offset: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    };

    return (
        <div className="mb-12 z-10">
            {/* ... (código del encabezado sin cambios) ... */}
            <div className="flex justify-between items-center mb-4 px-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold text-white">{title}</h2>
                    {shortDescription && (
                        <p className="text-gray-400 text-sm">{shortDescription}</p>
                    )}
                </div>
                <a
                    href={`/category/${id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                >
                    Ver todo
                </a>
            </div>

            <div className="relative">
                {/* Contenedor que escucha el evento onScroll */}
                <div
                    ref={scrollContainerRef}
                    onScroll={updateArrowVisibility} // <-- ¡AQUÍ ESTÁ LA CLAVE!
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 px-4 scroll-p-4" // <-- ¡Añade scroll-p-4 aquí!
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

                {/* Los controles reciben la prop "isVisible" y actúan en consecuencia */}
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