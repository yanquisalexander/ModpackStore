import { PreLaunchAppearance } from "@/types/PreLaunchAppeareance";

export const getDefaultAppeareance = ({ title, description, logoUrl }: { title?: string; description?: string; logoUrl?: string }): PreLaunchAppearance => {
    return {
        title,
        description,
        logo: {
            url: logoUrl,
            height: "56px",
            position: {
                top: "8rem",
                left: "50%",
                transform: "translateX(-50%)"
            },
            fadeInDuration: "500ms",
            fadeInDelay: "1000ms"
        },

        playButton: {
            text: "Jugar ahora",
            backgroundColor: "#00a63e",
            hoverColor: "#262626",
            textColor: "#ffffff",
            borderColor: "#1e1e1e",
            fadeInDuration: "500ms",
            fadeInDelay: "1500ms"
        },

        background: {
            videoUrl: "/assets/videos/prelaunch-default-1.mp4",
        },

        customBlocks: [],

        // Sin `position` a propósito: si el merge la mezclara con la
        // personalizada, el CSS quedaría sobre-restringido
        // (top+bottom / left+right a la vez) y el navegador ignoraría valores.
        // Sin posición custom, el bloque usa derecha-centro por defecto.
        skinRenderer: {
            enabled: false,
            width: "180px",
            height: "240px",
            autoRotate: true,
            autoRotateSpeed: 1.0,
            animation: "idle",
            fadeInDuration: "500ms",
            fadeInDelay: "1000ms",
        },

        news: {
            position: {
                top: "3rem",
                right: "2rem"
            },
            style: {
                background: "rgba(0,0,0,0.8)",
                color: "#ffffff",
                borderRadius: "0.5rem",
                padding: "1rem",
                width: "20rem",
                fontSize: "0.875rem"
            },
            entries: []
        }
    }
}