import { useEffect, useRef } from "react";
import { SkinViewer, IdleAnimation, WaveAnimation } from "skinview3d";

interface SkinPreview3DProps {
    url: string;
    model?: "classic" | "slim";
    autoRotate?: boolean;
    autoRotateSpeed?: number;
    animation?: "idle" | "wave" | "none";
    /** Rotación estática inicial en radianes (se combina con autoRotate). */
    rotation?: { x?: number; y?: number; z?: number };
    className?: string;
}

export function SkinPreview3D({
    url,
    model = "classic",
    autoRotate = true,
    autoRotateSpeed = 1.0,
    animation = "idle",
    rotation,
    className,
}: SkinPreview3DProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewerRef = useRef<SkinViewer | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const viewer = new SkinViewer({
            canvas,
            width: rect.width,
            height: rect.height,
            enableControls: false,
            renderPaused: false,
        });

        viewerRef.current = viewer;
        viewer.autoRotate = autoRotate;
        viewer.autoRotateSpeed = autoRotateSpeed;
        viewer.animation =
            animation === "none" ? null : animation === "wave" ? new WaveAnimation() : new IdleAnimation();
        if (rotation) {
            viewer.playerObject.rotation.set(
                rotation.x ?? 0,
                rotation.y ?? 0,
                rotation.z ?? 0,
            );
        }
        viewer.adjustCameraDistance();

        viewer.loadSkin(url, { model: model === "slim" ? "slim" : "default" }).catch(() => {});

        return () => {
            viewer.dispose();
            viewerRef.current = null;
        };
    }, [url, model, autoRotate, autoRotateSpeed, animation, rotation?.x, rotation?.y, rotation?.z]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ imageRendering: "pixelated" }}
        />
    );
}
