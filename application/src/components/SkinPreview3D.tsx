import { useEffect, useRef } from "react";
import { SkinViewer, IdleAnimation } from "skinview3d";

interface SkinPreview3DProps {
    url: string;
    model?: "classic" | "slim";
    className?: string;
}

export function SkinPreview3D({ url, model = "classic", className }: SkinPreview3DProps) {
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
        viewer.autoRotate = true;
        viewer.autoRotateSpeed = 1.0;
        viewer.animation = new IdleAnimation();
        viewer.adjustCameraDistance();

        viewer.loadSkin(url, { model: model === "slim" ? "slim" : "default" }).catch(() => {});

        return () => {
            viewer.dispose();
            viewerRef.current = null;
        };
    }, [url, model]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{ imageRendering: "pixelated" }}
        />
    );
}
