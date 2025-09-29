/// <reference types="vite/client" />

declare global {
    interface JSX {
        intrinsicElements: {
            'modpack-store': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
        };
    }
}