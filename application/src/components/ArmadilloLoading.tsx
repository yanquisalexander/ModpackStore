import clsx from "clsx";

export const ArmadilloLoading = ({ className, ...props }: React.HTMLAttributes<HTMLImageElement>) => {
    return (
        <img
            src="/armadillo_running.gif"
            alt="Loading..."
            draggable="false"
            className={clsx(
                "h-8",
                className // Allow additional classes to be passed
            )}
            {...props}
        />
    );
}