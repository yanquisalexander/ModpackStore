import { useEffect, useRef, useState } from "react";

/**
 * Progreso suavizado sin tropezones para barras de instalación/descarga.
 *
 * Diseño (corrige el tween exponencial anterior):
 * - Saltos grandes (|target - display| > snapThreshold): snap directo.
 *   El backend ya throttlea a pasos regulares; animar un salto del 20%
 *   centésima a centésima era lo que mantenía el rAF vivo y saturaba React.
 * - Saltos pequeños: avance a velocidad constante (pct por segundo) con
 *   rAF y `dt` real, monótono creciente dentro de la misma tarea.
 * - Retroceso (nueva tarea/etapa): snap directo.
 * - target >= 100: snap a 100 inmediato.
 * - Resolución de pintado: décimas (0.1%) en vez de centésimas → ~10x
 *   menos setState/texto por segundo a igual fluidez visual.
 */
export function useSmoothProgress(
    target: number,
    opts?: { speedPctPerSec?: number; snapThreshold?: number }
): number {
    const speed = opts?.speedPctPerSec ?? 30;
    const snapThreshold = opts?.snapThreshold ?? 5;
    const safeTarget = Number.isFinite(target) ? Math.max(0, Math.min(100, target)) : 0;
    const [display, setDisplay] = useState(() => Math.round(safeTarget * 10) / 10);

    const displayRef = useRef(display);
    const targetRef = useRef(safeTarget);
    const rafRef = useRef<number>(0);
    const lastTickRef = useRef<number>(0);
    targetRef.current = safeTarget;

    useEffect(() => {
        // Nueva tarea (retroceso): snap directo, sin animar.
        if (safeTarget < displayRef.current - 0.05) {
            cancelAnimationFrame(rafRef.current);
            const snapped = Math.round(safeTarget * 10) / 10;
            displayRef.current = snapped;
            setDisplay((prev) => (prev === snapped ? prev : snapped));
            return;
        }
        // Completo: snap a 100 inmediato.
        if (safeTarget >= 100) {
            cancelAnimationFrame(rafRef.current);
            if (displayRef.current !== 100) {
                displayRef.current = 100;
                setDisplay(100);
            }
            return;
        }
        // Salto grande: snap directo (el backend ya regula la cadencia;
        // animarlo era la causa de los tropezones).
        if (safeTarget - displayRef.current > snapThreshold) {
            cancelAnimationFrame(rafRef.current);
            const snapped = Math.round(safeTarget * 10) / 10;
            displayRef.current = snapped;
            setDisplay((prev) => (prev === snapped ? prev : snapped));
            return;
        }

        lastTickRef.current = performance.now();
        const tick = (now: number) => {
            const t = targetRef.current;
            const d = displayRef.current;
            // El objetivo se movió mucho mientras animábamos: re-evaluar
            // (el efecto se re-ejecutará por cambio de safeTarget).
            if (t - d > snapThreshold || t < d - 0.05) {
                return;
            }
            const dt = Math.min(0.1, Math.max(0, (now - lastTickRef.current) / 1000));
            lastTickRef.current = now;
            const step = speed * dt;
            const diff = t - d;
            if (Math.abs(diff) <= Math.max(step, 0.05)) {
                const snapped = Math.round(t * 10) / 10;
                displayRef.current = snapped;
                setDisplay((prev) => (prev === snapped ? prev : snapped));
                return;
            }
            const next = d + Math.sign(diff) * step;
            const rounded = Math.round(next * 10) / 10;
            displayRef.current = next;
            setDisplay((prev) => (prev === rounded ? prev : rounded));
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [safeTarget, speed, snapThreshold]);

    return display;
}
