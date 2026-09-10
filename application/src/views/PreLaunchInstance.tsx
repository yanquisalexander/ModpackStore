import { usePrelaunchInstance } from "@/hooks/usePrelaunchInstance";
import { LucideGamepad2, LucideLoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { memo, useMemo } from "react";
import { PreLaunchAppearance } from "@/types/PreLaunchAppeareance";
import { BackgroundVideo } from "@/components/LauncherBackgroundVideo";
import PreLaunchQuickActions from "@/components/PreLaunchQuickActions";
import { InstanceCrashDialog } from "@/components/InstanceCrashDialog";
import { AccountSelectionDialog } from "@/components/AccountSelectionDialog";
import { useParams } from "react-router-dom";
import { MinecraftPlayButton } from "@/components/MinecraftPlayButton";
import CustomBlocksRenderer from "@/components/CustomBlocksRenderer";


// Memoized Background Component
const Background = memo((props: PreLaunchAppearance['background'] | undefined) => {
    console.log("Background props:", props);
    if (!props) return null;
    const { imageUrl, videoUrl } = props;
    if (imageUrl) {
        return (
            <img
                className="absolute inset-0 z-0 h-full w-full object-cover animate-fade-in ease-in-out duration-1000"
                src={imageUrl}
                onError={(e => {
                    if (!videoUrl) {
                        (e.currentTarget as HTMLImageElement).src = "/assets/videos/prelaunch-default-1.mp4";
                    }
                })}
                alt="Background"
            />
        );
    } else if (videoUrl) {
        const videoUrls = Array.isArray(videoUrl) ? videoUrl : [videoUrl];
        return (
            <BackgroundVideo
                key={"background-video"}
                videoUrls={videoUrls}
            />
        );
    }
    return null;
}, (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders when props are the same
    return prevProps?.imageUrl === nextProps?.imageUrl &&
        JSON.stringify(prevProps?.videoUrl) === JSON.stringify(nextProps?.videoUrl);
});

// Memoized Logo Component
const Logo = memo(({ logo, onLoadError }: { logo: PreLaunchAppearance['logo'], onLoadError: (resource: string, error: string) => void }) => {
    if (!logo?.url) return null;

    const logoHasCustomPosition = logo?.position &&
        Object.values(logo.position).some(value => value != null);

    return (
        <img
            src={logo.url}
            draggable={false}
            alt="Logo"
            onError={(e) => {
                onLoadError("Logo", `Failed to load ${logo.url}`);
                (e.currentTarget as HTMLImageElement).src = "/images/mc_logo.svg";
            }}
            style={{
                top: logo.position?.top,
                left: logo.position?.left,
                transform: logo.position?.transform,
                animationDelay: logo.fadeInDelay,
                animationDuration: logo.fadeInDuration,
                height: logo.height,
            }}
            className="absolute z-10 animate-fade-in duration-500 ease-in-out"
        />
    );
});

// Memoized Loading Indicator Component
const LoadingIndicator = memo(({ isLoading, message, stage, loadingIndicator }: { isLoading: boolean, message: string, stage?: any, loadingIndicator?: PreLaunchAppearance['loadingIndicator'] }) => {
    if (!isLoading) return null;

    const positionStyle: React.CSSProperties = loadingIndicator?.position ? {
        top: loadingIndicator.position.top,
        left: loadingIndicator.position.left,
        right: loadingIndicator.position.right,
        bottom: loadingIndicator.position.bottom,
        transform: loadingIndicator.position.transform?.replace('!important', '').trim(),
    } : {};

    const hasCustomPosition = loadingIndicator?.position && Object.values(loadingIndicator.position).some(value => value != null);

    // Calculate progress if stage has current/total
    const progress = stage && 'current' in stage && 'total' in stage && stage.total > 0
        ? Math.min(100, Math.round((stage.current / stage.total) * 100))
        : null;

    const showBar = loadingIndicator?.showProgressBar && progress !== null;
    const showPct = loadingIndicator?.showPercentage && progress !== null;

    return (
        <div
            className={`absolute z-20 ${hasCustomPosition ? '' : 'top-12 right-4'}`}
            style={hasCustomPosition ? positionStyle : {}}
        >
            <div
                className="flex flex-col gap-2 animate-fade-in-down tabular-nums animate-duration-400 ease-in-out"
                style={{
                    background: '#000000cc',
                    color: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    maxWidth: '280px',
                    width: '100%',
                    ...loadingIndicator?.style,
                }}
            >
                <div className="flex gap-x-2 items-center">
                    {loadingIndicator?.showSpinner !== false && (
                        <LucideLoaderCircle
                            className="animate-spin-clockwise animate-iteration-count-infinite animate-duration-[2500ms] flex-shrink-0"
                            style={{ color: loadingIndicator?.spinnerColor || '#ffffff' }}
                        />
                    )}
                    <span>{message}</span>
                    {showPct && <span className="ml-auto opacity-70">{progress}%</span>}
                </div>
                {showBar && (
                    <div
                        style={{
                            height: loadingIndicator?.barHeight || '4px',
                            background: loadingIndicator?.barBackgroundColor || '#ffffff20',
                            borderRadius: loadingIndicator?.barBorderRadius || '2px',
                            overflow: 'hidden',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${progress}%`,
                                background: loadingIndicator?.progressColor || '#22c55e',
                                borderRadius: loadingIndicator?.barBorderRadius || '2px',
                                transition: 'width 0.3s ease',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

// Memoized Footer Component with Play Button
type FooterProps = {
    appearance: PreLaunchAppearance | undefined;
    isLoading: boolean;
    isPlaying: boolean;
    isInstanceBootstraping: boolean;
    onPlay: () => void;
};

const Footer = memo(({ appearance, isLoading, isPlaying, isInstanceBootstraping, onPlay }: FooterProps) => {
    const hasCustomPosition = appearance?.playButton?.position &&
        Object.values(appearance.playButton.position).some(value => value != null);

    return (
        <footer className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 p-4 text-white flex items-center justify-center">
            <div className="flex flex-col items-center justify-center space-y-4">
                <MinecraftPlayButton
                    id="play-button"
                    text={appearance?.playButton?.text ?? "Jugar ahora"}
                    loading={isInstanceBootstraping}
                    playing={isPlaying}
                    loadingText="Instalando..."
                    playingText="Ya estás jugando"
                    disabled={isLoading || isPlaying || isInstanceBootstraping}
                    onClick={onPlay}
                    hasCustomPosition={hasCustomPosition}
                    style={{
                        "--bg-color": appearance?.playButton?.backgroundColor,
                        "--hover-color": appearance?.playButton?.hoverColor,
                        "--text-color": appearance?.playButton?.textColor,
                        "--border-color": appearance?.playButton?.borderColor,
                        top: appearance?.playButton?.position?.top,
                        left: appearance?.playButton?.position?.left,
                        right: appearance?.playButton?.position?.right,
                        bottom: appearance?.playButton?.position?.bottom,
                        transform: appearance?.playButton?.position?.transform,
                    } as any}
                    ariaLabel={isInstanceBootstraping ? "Instalando..." : isPlaying ? "Ya estás jugando" : appearance?.playButton?.text ?? "Jugar ahora"}
                />

                {/* Footer content */}
                <div className="flex items-center justify-center space-x-2">
                    {
                        appearance?.logo?.url ? null : (
                            <img
                                src={appearance?.logo?.url || "/images/mc_logo.svg"}
                                className="h-8 w-8"
                                alt="Logo"
                            />
                        )
                    }
                    {
                        appearance?.footerText ? (
                            <span className="text-sm text-center">
                                {appearance.footerText}
                            </span>
                        ) : null
                    }
                </div>
            </div>
        </footer>
    );
});

export const PreLaunchInstance = () => {
    const { instanceId } = useParams<{ instanceId: string }>();
    if (!instanceId) return null;
    const {
        prelaunchState,
        appearance,
        loadingStatus,
        isPlaying,
        isInstanceBootstraping,
        IS_FORGE,
        showConfig,
        showAccountSelection,
        setShowAccountSelection,
        crashErrorState,
        setCrashErrorState,
        handlePlayButtonClick,
        handleAccountSelected,
        fetchInstanceData,
        handleResourceError,
        navigate
    } = usePrelaunchInstance(instanceId);


    // Memoizar las props del background para evitar re-renders innecesarios
    const backgroundProps = useMemo(() => ({
        imageUrl: appearance?.background?.imageUrl,
        videoUrl: appearance?.background?.videoUrl,
    }), [appearance?.background?.imageUrl, appearance?.background?.videoUrl]);

    if (prelaunchState.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-full h-full">
                <LucideLoaderCircle className="size-10 animate-spin-clockwise text-white" />
            </div>
        );
    }

    console.log("Appearance:", appearance);

    if (prelaunchState.error) {
        toast.error(prelaunchState.error, {
            id: "instance-load-error",
            description: "No se pudo cargar la instancia. Intenta nuevamente.",
            action: { label: "Volver a inicio", onClick: () => navigate("/") },
        });
        return (
            <div className="flex items-center justify-center min-h-screen text-white">
                {prelaunchState.error}
            </div>
        );
    }

    return (
        <div className="absolute inset-0">
            <div className="relative h-full w-full overflow-hidden">
                <Background
                    {...backgroundProps}
                />
                <LoadingIndicator
                    isLoading={loadingStatus.isLoading}
                    message={loadingStatus.message}
                    stage={loadingStatus.stage}
                    loadingIndicator={appearance?.loadingIndicator}
                />
                <Logo
                    logo={appearance?.logo}
                    onLoadError={handleResourceError} // Pasar la función de notificación
                />
                <CustomBlocksRenderer
                    blocks={appearance?.customBlocks}
                    instance={prelaunchState.instance!}
                />
                <Footer
                    appearance={appearance}
                    isLoading={loadingStatus.isLoading}
                    isPlaying={isPlaying}
                    isInstanceBootstraping={isInstanceBootstraping}
                    onPlay={handlePlayButtonClick}
                />

                {prelaunchState.instance && (
                    <PreLaunchQuickActions
                        instanceId={instanceId}
                        isForge={IS_FORGE}
                        isModpack={!!prelaunchState.instance?.modpackId}
                        onReloadInfo={fetchInstanceData}
                        defaultShowEditInfo={showConfig}
                    />
                )}
                <InstanceCrashDialog
                    open={crashErrorState.showModal}
                    onOpenChange={(open) => setCrashErrorState(prev => ({ ...prev, showModal: open }))}
                    errorMessage={crashErrorState.message}
                    data={crashErrorState.data}
                    exitCode={crashErrorState.exitCode}
                />

                <AccountSelectionDialog
                    open={showAccountSelection}
                    onOpenChange={setShowAccountSelection}
                    onAccountSelected={handleAccountSelected}
                    instanceId={instanceId}
                    appearance={appearance}
                />
            </div>
        </div>
    );
};