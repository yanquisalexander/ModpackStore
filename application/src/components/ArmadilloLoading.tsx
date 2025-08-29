import clsx from "clsx";

export const ArmadilloLoading = ({ className = "h-8", ...props }: React.HTMLAttributes<HTMLImageElement>) => {
    return (
        <img
            src="/armadillo_running.gif"
            alt="Loading..."
            draggable="false"
            className={clsx(
                className // Permitir que se reemplace la clase predeterminada
            )}
            {...props}
        />
    );
}