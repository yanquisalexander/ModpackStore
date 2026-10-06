import { useEffect, useRef, useState } from "react";

/**
 * Suaviza un porcentaje objetivo (0-100) para pintarlo fluido con
 * resolución de centésimas (0,01 %).
 *
 * - Interpola con rAF: `display += (target - display) * 0.15` por frame.
 * - Solo hace setState cuando cambia la centésima redondeada, así React no
 *   re-renderiza a 60 fps sino al ritmo que el número visible cambia.
 * - Monótono: si el objetivo retrocede (nueva tarea), salta directo.
 * - Si el objetivo llega a 100, salta a 100,00 inmediato (nunca se queda
 *   en 99,9x al terminar).
 *
 * Pensado para barras de progreso de instalaciones/descargas donde el
 * backend emite valores gruesos o en ráfagas.
 */
export function useSmoothProgress(target: number, factor = 0.15): number {
    const safeTarget = Number.isFinite(target) ? Math.max(0, Math.min(100, target)) : 0;
    const [display, setDisplay] = useState(() => Math.round(safeTarget * 100) / 100);

    const displayRef = useRef(display);
    const targetRef = useRef(safeTarget);
    const rafRef = useRef<number>(0);
    targetRef.current = safeTarget;

    useEffect(() => {
        // Nueva tarea (el objetivo retrocedió): snap directo, sin animar.
        if (safeTarget < displayRef.current - 0.005) {
            cancelAnimationFrame(rafRef.current);
            const snapped = Math.round(safeTarget * 100) / 100;
            displayRef.current = snapped;
            setDisplay(snapped);
            return;
        }
        // Objetivo completo: snap a 100,00 inmediato.
        if (safeTarget >= 100) {
            cancelAnimationFrame(rafRef.current);
            if (displayRef.current !== 100) {
                displayRef.current = 100;
                setDisplay(100);
            }
            return;
        }

        const tick = () => {
            const t = targetRef.current;
            const d = displayRef.current;
            const diff = t - d;

            if (Math.abs(diff) < 0.005) {
                if (d !== t) {
                    const snapped = Math.round(t * 100) / 100;
                    displayRef.current = snapped;
                    setDisplay((prev) => (prev === snapped ? prev : snapped));
                }
                return;
            }

            const next = d + diff * factor;
            const rounded = Math.round(next * 100) / 100;
            displayRef.current = next;
            // Solo re-render si cambió la centésima visible.
            setDisplay((prev) => (Math.round(prev * 100) === Math.round(rounded * 100) ? prev : rounded));
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [safeTarget, factor]);

    return display;
}
