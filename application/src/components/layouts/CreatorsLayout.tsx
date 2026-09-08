import { useMatch, useLocation, Link, NavLink } from "react-router-dom";
import { useAuthentication } from "@/stores/AuthContext";
import { getBaseNavItems, getOrgNavItems } from "../creators/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { CreatorsRoutes } from "../creators/CreatorsRoutes";
import { WizardProvider } from "../creators/WizardContext";
import { useTitleBar } from "@/hooks/creators/useTitleBar";
import { useTeams } from "@/hooks/creators/useTeams";
import React from "react";
import {
    LucidePencilRuler,
    LucideBuilding2,
    LucideChevronRight,
    LucideClock,
    LucideXCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const LoadingScreen = ({ message = "Cargando panel de creador..." }) => (
    <div className="flex items-center justify-center min-h-full h-full bg-background">
        <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
    </div>
);

interface SidebarNavProps {
    items: { path: string; label: string; description?: string; icon: React.FC<{ className?: string; size?: number }> }[];
    currentPath: string;
    onClose?: () => void;
}

function SidebarNav({ items, currentPath, onClose }: SidebarNavProps) {
    return (
        <nav className="space-y-2">
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end
                        onClick={onClose}
                        className={cn(
                            "flex items-center gap-3 p-3 rounded-lg transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted/50 text-foreground"
                        )}
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm leading-none mb-1">{item.label}</div>
                            {item.description && (
                                <div className={cn(
                                    "text-xs truncate",
                                    isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}>
                                    {item.description}
                                </div>
                            )}
                        </div>
                        {isActive && <LucideChevronRight className="h-4 w-4 shrink-0" />}
                    </NavLink>
                );
            })}
        </nav>
    );
}

function SidebarContent({ isOrgRoute, orgId, teams, currentPath, onClose }: {
    isOrgRoute: boolean;
    orgId?: string;
    teams: any[];
    currentPath: string;
    onClose?: () => void;
}) {
    const navItems = isOrgRoute && orgId ? getOrgNavItems(orgId) : getBaseNavItems();
    const currentTeam = teams.find((t: any) => t.id === orgId);

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-primary/10 text-primary shrink-0">
                        {isOrgRoute ? (
                            <LucideBuilding2 className="h-4 w-4" />
                        ) : (
                            <LucidePencilRuler className="h-4 w-4" />
                        )}
                    </div>
                    <h2 className="font-semibold truncate flex-1">
                        {isOrgRoute
                            ? (currentTeam?.displayName || currentTeam?.publisherName || "Equipo")
                            : "Panel de Creadores"
                        }
                    </h2>
                    <Badge variant="secondary" className="text-xs shrink-0">
                        CREATOR
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    {isOrgRoute ? "Administra este equipo y sus recursos" : "Gestiona tus equipos y modpacks"}
                </p>
            </div>

            <Separator />

            {isOrgRoute && (
                <Link
                    to="/creators"
                    onClick={onClose}
                    className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted/40 border border-border/50"
                >
                    <LucideChevronRight size={14} className="rotate-180 shrink-0" />
                    <span>Volver a todos los paneles</span>
                </Link>
            )}

            <SidebarNav items={navItems} currentPath={currentPath} onClose={onClose} />

            {!isOrgRoute && teams.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Tus Organizaciones ({teams.length})
                    </h3>
                    <div className="space-y-1">
                        {teams.map((team: any) => {
                            const isCurrent = currentPath.startsWith(`/creators/org/${team.id}`);
                            return (
                                <Link
                                    key={team.id}
                                    to={`/creators/org/${team.id}`}
                                    onClick={onClose}
                                    className={cn(
                                        "flex items-center gap-3 p-2.5 rounded-lg transition-colors border border-transparent",
                                        isCurrent
                                            ? "bg-primary text-primary-foreground font-medium"
                                            : "hover:bg-muted/50 text-foreground"
                                    )}
                                >
                                    <div className="size-7 rounded-md bg-muted/50 border border-border/60 flex items-center justify-center shrink-0 overflow-hidden">
                                        {team.logoUrl ? (
                                            <img src={team.logoUrl} alt="" className="size-full object-cover" />
                                        ) : (
                                            <LucideBuilding2 size={14} className="text-muted-foreground" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm truncate font-medium">
                                            {team.displayName || team.publisherName}
                                        </div>
                                        <div className={cn(
                                            "text-[10px] truncate",
                                            isCurrent ? "text-primary-foreground/70" : "text-muted-foreground"
                                        )}>
                                            {team.status === "approved" ? "Activo" : "Pendiente"}
                                        </div>
                                    </div>
                                    <LucideChevronRight size={14} className={cn("shrink-0", isCurrent ? "text-primary-foreground" : "text-muted-foreground/50")} />
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {isOrgRoute && (
                <div className="pt-4 border-t border-border">
                    <Link
                        to="/creators"
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-dashed border-border"
                    >
                        <div className="flex items-center gap-2">
                            <LucideBuilding2 size={14} />
                            <span>Cambiar de equipo</span>
                        </div>
                        <LucideChevronRight size={12} />
                    </Link>
                </div>
            )}
        </div>
    );
}

export const CreatorsLayout = () => {
    const { sessionTokens, loading: authLoading } = useAuthentication();
    const location = useLocation();

    const orgRouteMatch = useMatch("/creators/org/:orgId/*");
    const isOrgRoute = !!orgRouteMatch;
    const orgId = orgRouteMatch?.params?.orgId;

    const versionDetailMatch = useMatch("/creators/org/:orgId/modpacks/:modpackId/versions/:versionId");
    const isVersionDetail = !!versionDetailMatch;

    const { teams, isLoading, error } = useTeams(sessionTokens?.accessToken);
    useTitleBar(isOrgRoute, teams, orgId);

    const currentTeam = orgId ? teams.find((t: any) => t.id === orgId) : null;
    const isPendingOrg = currentTeam && currentTeam.status !== "approved";

    if (authLoading || isLoading) return <LoadingScreen />;
    if (error) return <ErrorScreen error={error} />;

    if (isPendingOrg) {
        const isRejected = currentTeam.status === "rejected";
        const teamName = currentTeam.displayName || currentTeam.publisherName || "Organización";
        return (
            <WizardProvider>
                <div className="bg-background min-h-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center text-center px-6 max-w-md">
                        <div className={cn(
                            "size-20 rounded-2xl flex items-center justify-center mb-6 ring-1",
                            isRejected
                                ? "bg-destructive/10 text-destructive ring-destructive/20"
                                : "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                        )}>
                            {isRejected ? <LucideXCircle size={40} /> : <LucideClock size={40} />}
                        </div>
                        <h1 className="text-2xl font-bold mb-2">{teamName}</h1>
                        <h2 className="text-sm font-medium text-muted-foreground mb-4">
                            {isRejected ? "Organización rechazada" : "Organización pendiente de revisión"}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {isRejected
                                ? "Tu solicitud para crear esta organización no ha sido aprobada. Si crees que esto es un error, contacta con el equipo de soporte."
                                : "Tu organización está siendo revisada por el equipo de Modpack Store. Te notificaremos cuando sea aprobada y puedas empezar a publicar modpacks."
                            }
                        </p>
                    </div>
                </div>
            </WizardProvider>
        );
    }

    return (
        <WizardProvider>
            <div className="bg-background min-h-full h-full">
                <div className="p-4 lg:p-6">
                    {isVersionDetail ? (
                        <div className="w-full">
                            <CreatorsRoutes teams={teams} accessToken={sessionTokens?.accessToken} />
                        </div>
                    ) : (
                        <div className="flex gap-6">
                            <div className="w-64 shrink-0">
                                <Card className="h-fit">
                                    <CardContent className="p-6">
                                        <SidebarContent
                                            isOrgRoute={isOrgRoute}
                                            orgId={orgId}
                                            teams={teams}
                                            currentPath={location.pathname}
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="flex-1 min-w-0">
                                <CreatorsRoutes teams={teams} accessToken={sessionTokens?.accessToken} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WizardProvider>
    );
};

export default CreatorsLayout;
