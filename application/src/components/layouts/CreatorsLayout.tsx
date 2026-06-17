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
    LucideClock,
    LucideXCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const LoadingScreen = ({ message = "Cargando panel de creador..." }) => (
    <div className="flex items-center justify-center min-h-full h-full bg-[#0e0e10]">
        <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-neutral-600 mx-auto" />
            <p className="mt-2 text-sm text-neutral-500">{message}</p>
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
                                ? "bg-white/[0.04] text-white"
                                : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
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
        <div className="space-y-5">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    {isOrgRoute ? (
                        <LucideBuilding2 size={16} className="text-teal-400 shrink-0" />
                    ) : (
                        <LucidePencilRuler size={16} className="text-teal-400 shrink-0" />
                    )}
                    <h2 className="text-sm font-semibold text-white truncate">
                        {isOrgRoute
                            ? (currentTeam?.displayName || currentTeam?.publisherName || "Equipo")
                            : "Panel de Creadores"
                        }
                    </h2>
                    <span className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.04]">CREATOR</span>
                </div>
                <p className="text-xs text-neutral-600">
                    {isOrgRoute ? "Administra este equipo" : "Gestiona tus equipos y modpacks"}
                </p>
            </div>

            {isOrgRoute && (
                <Link
                    to="/creators"
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                    <LucideChevronRight size={12} className="rotate-180" />
                    <span>Todos los paneles</span>
                </Link>
            )}

            <SidebarNav items={navItems} currentPath={currentPath} onClose={onClose} />

            {!isOrgRoute && teams.length > 0 && (
                <div className="pt-4 border-t border-white/[0.04]">
                    <h3 className="text-[10px] font-medium text-neutral-600 uppercase tracking-wider mb-2 px-1">
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
                                        ? "bg-white/[0.04] text-white"
                                        : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02]"
                                )}
                            >
                                <div className="size-6 rounded bg-black/20 ring-1 ring-white/[0.04] flex items-center justify-center shrink-0 overflow-hidden">
                                    {team.logoUrl ? (
                                        <img src={team.logoUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <LucideBuilding2 size={12} className="text-neutral-600" />
                                    )}
                                </div>
                                <span className="truncate">{team.displayName || team.publisherName}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {isOrgRoute && (
                <div className="pt-4 border-t border-white/[0.04]">
                    <Link
                        to="/creators"
                        onClick={onClose}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02] transition-colors"
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
                <div className="bg-[#0e0e10] min-h-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center text-center px-6 max-w-md">
                        <div className={cn(
                            "size-20 rounded-2xl flex items-center justify-center mb-6 ring-1",
                            isRejected
                                ? "bg-red-500/10 text-red-400 ring-red-500/20"
                                : "bg-amber-500/10 text-amber-400 ring-amber-500/20"
                        )}>
                            {isRejected ? <LucideXCircle size={40} /> : <LucideClock size={40} />}
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">{teamName}</h1>
                        <h2 className="text-sm font-medium text-neutral-400 mb-4">
                            {isRejected ? "Organización rechazada" : "Organización pendiente de revisión"}
                        </h2>
                        <p className="text-sm text-neutral-600 leading-relaxed">
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
            <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-[#0e0e10] sticky top-0 z-20">
                <div className="flex items-center gap-2.5">
                    <LucidePencilRuler size={16} className="text-teal-400" />
                    <span className="text-sm font-medium text-white">{isVersionDetail ? "Detalle de versión" : "Panel de Creadores"}</span>
                </div>
                {!isVersionDetail && (
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-white">
                                <LucideMenu size={16} />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[280px] p-4 bg-[#0e0e10] border-white/[0.06]" onInteractOutside={() => setMobileOpen(false)}>
                            <SidebarContent
                                isOrgRoute={isOrgRoute}
                                orgId={orgId}
                                teams={teams}
                                currentPath={location.pathname}
                                onClose={() => setMobileOpen(false)}
                            />
                        </SheetContent>
                    </Sheet>
                )}
            </div>

            <div className="bg-[#0e0e10] min-h-full h-full">
                <div className="mx-auto p-4 lg:p-6 max-w-[1600px]">
                    {isVersionDetail ? (
                        <div className="w-full">
                            <CreatorsRoutes teams={teams} />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="hidden md:block md:col-span-1">
                                <div className="bg-[#121214] border border-white/[0.06] rounded-lg p-5">
                                    <SidebarContent
                                        isOrgRoute={isOrgRoute}
                                        orgId={orgId}
                                        teams={teams}
                                        currentPath={location.pathname}
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-3 min-w-0">
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
