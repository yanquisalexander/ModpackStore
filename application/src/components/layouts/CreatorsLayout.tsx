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
    items: { path: string; label: string; icon: React.FC<{ size?: number }> }[];
    currentPath: string;
    onClose?: () => void;
}

function SidebarNav({ items, currentPath, onClose }: SidebarNavProps) {
    return (
        <nav className="space-y-0.5">
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                    <NavLink key={item.path} to={item.path} end onClick={onClose}>
                        <div className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}>
                            <Icon size={16} />
                            <span>{item.label}</span>
                        </div>
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
                    {isOrgRoute ? (
                        <LucideBuilding2 size={16} className="text-primary shrink-0" />
                    ) : (
                        <LucidePencilRuler size={16} className="text-primary shrink-0" />
                    )}
                    <h2 className="font-semibold truncate">
                        {isOrgRoute
                            ? (currentTeam?.displayName || currentTeam?.publisherName || "Equipo")
                            : "Panel de Creadores"
                        }
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                        CREATOR
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    {isOrgRoute ? "Administra este equipo" : "Gestiona tus equipos y modpacks"}
                </p>
            </div>

            <Separator />

            {isOrgRoute && (
                <Link
                    to="/creators"
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <LucideChevronRight size={12} className="rotate-180" />
                    <span>Todos los paneles</span>
                </Link>
            )}

            <SidebarNav items={navItems} currentPath={currentPath} onClose={onClose} />

            {!isOrgRoute && teams.length > 0 && (
                <div className="pt-4 border-t border-border">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Equipos
                    </h3>
                    <div className="space-y-0.5">
                        {teams.map((team: any) => (
                            <Link
                                key={team.id}
                                to={`/creators/org/${team.id}`}
                                onClick={onClose}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                                    currentPath.startsWith(`/creators/org/${team.id}`)
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <div className="size-6 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                    {team.logoUrl ? (
                                        <img src={team.logoUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <LucideBuilding2 size={12} className="text-muted-foreground" />
                                    )}
                                </div>
                                <span className="truncate">{team.displayName || team.publisherName}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {isOrgRoute && (
                <div className="pt-4 border-t border-border">
                    <Link
                        to="/creators"
                        onClick={onClose}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                        <LucideBuilding2 size={16} />
                        <span>Cambiar de equipo</span>
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
                            <CreatorsRoutes teams={teams} />
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
                                <CreatorsRoutes teams={teams} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </WizardProvider>
    );
};

export default CreatorsLayout;
