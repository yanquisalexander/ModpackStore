// CreatorsLayout.tsx
import { useMatch } from "react-router-dom";
import { useAuthentication } from "@/stores/AuthContext";
import { getBaseNavItems, getOrgNavItems } from "../creators/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { CreatorsRoutes } from "../creators/CreatorsRoutes";
import { useTitleBar } from "@/hooks/creators/useTitleBar";
import { useTeams } from "@/hooks/creators/useTeams";
import { ArmadilloLoading } from "../ArmadilloLoading";
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    LucidePencilRuler,
    Users,
    ArrowLeft,
    LucideChevronRight
} from "lucide-react";

export const LoadingScreen = ({ message = "Cargando panel de creador..." }) => {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">{message}</p>
            </div>
        </div>
    );
};

export const CreatorsLayout = () => {
    const { sessionTokens } = useAuthentication();

    // Hook para detectar si la ruta actual corresponde a una organización
    const orgRouteMatch = useMatch("/creators/org/:orgId/*");
    const isOrgRoute = !!orgRouteMatch;
    const orgId = orgRouteMatch?.params?.orgId;

    // Custom hooks
    const { teams, isLoading, error } = useTeams(sessionTokens?.accessToken);

    // Hook para configurar la barra de título
    useTitleBar(isOrgRoute, teams, orgId);

    // Configurar elementos de navegación
    const navItems = isOrgRoute && orgId
        ? getOrgNavItems(orgId)
        : getBaseNavItems();

    // Estados de carga y error
    if (isLoading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen error={error} />;
    }

    const currentTeam = teams.find(team => team.id === orgId);

    // Renderizado principal
    return (
        <div className="container mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <Card className="h-fit">
                        <CardContent className="p-6">
                            <div className="space-y-6">
                                {/* Header */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        {isOrgRoute ? (
                                            <>
                                                <Users className="h-5 w-5 text-green-500" />
                                                <h2 className="font-semibold">{currentTeam?.publisherName}</h2>
                                            </>
                                        ) : (
                                            <>
                                                <LucidePencilRuler className="h-5 w-5 text-primary" />
                                                <h2 className="font-semibold">Panel de Creadores</h2>
                                            </>
                                        )}
                                        <Badge variant="secondary" className="text-xs">
                                            CREATOR
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Gestiona tus organizaciones y modpacks
                                    </p>
                                </div>

                                {/* Navigation */}
                                <nav className="space-y-2">
                                    {isOrgRoute && (
                                        <Link to="/creators" className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                            <ArrowLeft className="h-4 w-4" />
                                            <span className="text-sm font-medium">Todos los paneles</span>
                                        </Link>
                                    )}

                                    {navItems.map((item) => (
                                        <NavLink key={item.path} to={item.path} end>
                                            {({ isActive }) => (
                                                <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50'}`}>
                                                    <item.icon className="h-4 w-4" />
                                                    <span className="text-sm font-medium">{item.label}</span>
                                                    {isActive && <LucideChevronRight className="h-4 w-4 ml-auto" />}
                                                </div>
                                            )}
                                        </NavLink>
                                    ))}

                                    {!isOrgRoute && teams.length > 0 && (
                                        <>
                                            <div className="pt-4 mt-4 border-t">
                                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                    Panel de Publisher
                                                </h3>
                                                <div className="space-y-1">
                                                    {teams.map((team) => (
                                                        <Link key={`publisher-${team.id}`} to={`/publisher/${team.id}/modpacks`}>
                                                            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                                                <img src={team.logoUrl} alt={`${team.publisherName} logo`} className="size-6 object-cover rounded-md" />
                                                                <span className="text-sm truncate">{team.publisherName} </span>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>

                                        </>
                                    )}
                                </nav>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    <CreatorsRoutes teams={teams} />
                </div>
            </div>
        </div>
    );
};

export default CreatorsLayout;