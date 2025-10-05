import React from 'react';
import { LucideGamepad2, LucideLoaderCircle, LucideIcon } from "lucide-react";

export interface MinecraftPlayButtonProps {
    /** Texto del botón */
    text?: string;
    /** Si está cargando/deshabilitado */
    loading?: boolean;
    /** Si está reproduciendo */
    playing?: boolean;
    /** Texto alternativo cuando está cargando */
    loadingText?: string;
    /** Texto alternativo cuando está reproduciendo */
    playingText?: string;
    /** Función a ejecutar al hacer clic */
    onClick?: () => void;
    /** Icono personalizado (opcional, por defecto LucideGamepad2) */
    icon?: LucideIcon;
    /** Estilos CSS personalizados para el botón */
    style?: React.CSSProperties;
    /** Clases CSS adicionales */
    className?: string;
    /** Si tiene posicionamiento personalizado */
    hasCustomPosition?: boolean;
    /** Atributos adicionales */
    disabled?: boolean;
    /** Etiqueta aria */
    ariaLabel?: string;
    /** ID del botón */
    id?: string;
}

/**
 * Componente de botón con estilo Minecraft clásico
 * Incluye efectos visuales, animaciones y estados de carga
 *
 * @example
 * // Uso básico
 * <MinecraftPlayButton onClick={() => console.log('Play!')} />
 *
 * @example
 * // Con estados personalizados
 * <MinecraftPlayButton
 *   text="Iniciar Partida"
 *   loading={isLoading}
 *   loadingText="Cargando..."
 *   onClick={handlePlay}
 * />
 *
 * @example
 * // Con estilos personalizados
 * <MinecraftPlayButton
 *   text="Jugar"
 *   style={{
 *     '--bg-color': '#27ce40',
 *     '--hover-color': '#1e9e2e',
 *     '--text-color': '#ffffff',
 *     '--border-color': '#000000'
 *   }}
 *   onClick={handlePlay}
 * />
 */
export const MinecraftPlayButton: React.FC<MinecraftPlayButtonProps> = ({
    text = "Jugar ahora",
    loading = false,
    playing = false,
    loadingText = "Instalando...",
    playingText = "Ya estás jugando",
    onClick,
    icon: Icon = LucideGamepad2,
    style = {},
    className = "",
    hasCustomPosition = false,
    disabled = false,
    ariaLabel,
    id = "play-button"
}) => {
    const isDisabled = disabled || loading || playing;
    const buttonText = loading ? loadingText : playing ? playingText : text;
    const ariaLabelText = ariaLabel || buttonText;

    return (
        <button
            id={id}
            onClick={onClick}
            disabled={isDisabled}
            aria-busy={loading}
            aria-live="polite"
            aria-label={ariaLabelText}
            tabIndex={0}
            style={style}
            className={`
                ${hasCustomPosition ? "fixed" : ""}
                cursor-pointer
                active:scale-95 transition
                px-4 py-2
                font-minecraft-ten
                not-disabled:mc-play-btn
                disabled:border-3
                tracking-wide
                text-shadow-[0_3px_0_rgba(0,0,0,0.25)]
                items-center flex gap-x-2
                disabled:bg-neutral-800 disabled:cursor-not-allowed
                bg-[var(--bg-color)]
                hover:bg-[var(--hover-color)]
                active:bg-[var(--hover-color)]
                text-[var(--text-color)]
                border-[var(--border-color)]
                ${className}
            `}
        >
            {loading ? (
                <>
                    <LucideLoaderCircle className="size-6 animate-spin-clockwise animate-iteration-count-infinite animate-duration-[1500ms]" />
                    <span className="text-sm">{buttonText}</span>
                </>
            ) : (
                <>
                    <Icon className="size-6" />
                    <span className="text-sm">{buttonText}</span>
                </>
            )}
        </button>
    );
};

export default MinecraftPlayButton;