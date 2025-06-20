import PatreonIcon from "@/icons/PatreonIcon";
import React from "react";
import { open } from "@tauri-apps/plugin-shell";

export const PatreonButton: React.FC = () => {
    const handlePatreonClick = async () => {
        try {
            await open("https://www.patreon.com/AlexitooDEV");
        } catch (error) {
            console.error("Error opening Patreon link:", error);
        }
    };
    return (
        <button
            onClick={handlePatreonClick}
            title="Colaborar con el desarrollo"
            className="cursor-pointer flex group size-9 aspect-square items-center justify-center hover:bg-neutral-800"
            aria-label="Patreon"
        >
            <PatreonIcon className="size-4 text-white/80 group-hover:text-pink-500" />
        </button>
    );
};
