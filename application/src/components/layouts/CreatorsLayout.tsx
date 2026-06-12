import { useMatch, useLocation, Link, NavLink } from "react-router-dom";
import { useAuthentication } from "@/stores/AuthContext";
import { getBaseNavItems, getOrgNavItems } from "../creators/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { CreatorsRoutes } from "../creators/CreatorsRoutes";
import { WizardProvider } from "../creators/WizardContext";
import { useTitleBar } from "@/hooks/creators/useTitleBar";
import { useTeams } from "@/hooks/creators/useTeams";
import React, { useState } from "react";
import {
    LucidePencilRuler,
    LucideBuilding2,
    LucideChevronRight,
    LucideMenu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const LoadingScreen = ({ message = "Cargando panel de creador..." }) => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="mt-2 text-muted-foreground">{message}</p>
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
        <nav className="space-y-1">
            {items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path || currentPath.startsWith(item.path + "/");
                return (
                    <NavLink key={item.path} to={item.path} end onClick={onClose}>
                        <div className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                            isActive
                                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}>
                            <Icon size={16} />
                            <span>{item.label}</span>
                            {isActive && <LucideChevronRight size={14} className="ml-auto opacity-50" />}
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
                        <>
                            <LucideBuilding2 size={18} className="text-green-500" />
                            <h2 className="font-semibold text-sm truncate">
                                {currentTeam?.displayName || currentTeam?.publisherName || "Equipo"}
                            </h2>
                        </>
                    ) : (
                        <>
                            <LucidePencilRuler size={18} className="text-primary" />
                            <h2 className="font-semibold text-sm">Panel de Creadores</h2>
                        </>
                    )}
                    <Badge variant="secondary" className="text-[10px] h-5">CREATOR</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                    {isOrgRoute ? "Administra este equipo" : "Gestiona tus equipos y modpacks"}
                </p>
            </div>

            {isOrgRoute && (
                <Link
                    to="/creators"
                    onClick={onClose}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <LucideChevronRight size={12} className="rotate-180" />
                    <span>Todos los paneles</span>
                </Link>
            )}

            <SidebarNav items={navItems} currentPath={currentPath} onClose={onClose} />

            {!isOrgRoute && teams.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                        Equipos
                    </h3>
                    <div className="space-y-0.5">
                        {teams.map((team: any) => (
                            <Link
                                key={team.id}
                                to={`/creators/org/${team.id}`}
                                onClick={onClose}
                                className={cn(
                                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                                    currentPath.startsWith(`/creators/org/${team.id}`)
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                            >
                                <div className="size-6 rounded bg-muted ring-1 ring-border flex items-center justify-center shrink-0 overflow-hidden">
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
                <div className="pt-4 border-t border-border/50">
                    <Link
                        to="/creators"
                        onClick={onClose}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
    const [mobileOpen, setMobileOpen] = useState(false);

    const orgRouteMatch = useMatch("/creators/org/:orgId/*");
    const isOrgRoute = !!orgRouteMatch;
    const orgId = orgRouteMatch?.params?.orgId;

    const { teams, isLoading, error } = useTeams(sessionTokens?.accessToken);
    useTitleBar(isOrgRoute, teams, orgId);

    if (authLoading || isLoading) return <LoadingScreen />;
    if (error) return <ErrorScreen error={error} />;

    const sidebarCard = (
        <Card className="h-fit border-border/60 shadow-sm">
            <CardContent className="p-5">
                <SidebarContent
                    isOrgRoute={isOrgRoute}
                    orgId={orgId}
                    teams={teams}
                    currentPath={location.pathname}
                />
            </CardContent>
        </Card>
    );

    return (
        <WizardProvider>
            {/* Mobile header */}
            <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex items-center gap-2.5">
                    <LucidePencilRuler size={16} className="text-primary" />
                    <span className="text-sm font-medium">Panel de Creadores</span>
                </div>
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <LucideMenu size={16} />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-4" onInteractOutside={() => setMobileOpen(false)}>
                        <SidebarContent
                            isOrgRoute={isOrgRoute}
                            orgId={orgId}
                            teams={teams}
                            currentPath={location.pathname}
                            onClose={() => setMobileOpen(false)}
                        />
                    </SheetContent>
                </Sheet>
            </div>

            <div className="container mx-auto p-4 lg:p-6 max-w-[1600px]">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        {sidebarCard}
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-3 min-w-0">
                        <CreatorsRoutes teams={teams} />
                    </div>
                </div>
            </div>
        </WizardProvider>
    );
};

export default CreatorsLayout;
