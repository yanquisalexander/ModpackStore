import React, { useEffect } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
    LucideUsers,
    LucidePackage,
    LucideSettings,
    LucideBuilding2,
    LucideChevronRight,
    LucideShield,
    LucideHandCoins
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useTeams } from '@/hooks/creators/useTeams';
import { PublisherModpacksView } from '@/views/publisher/PublisherModpacksView';
import { PublisherTeamView } from '@/views/publisher/PublisherTeamView';
import { PublisherPermissionsView } from '@/views/publisher/PublisherPermissionsView';
import { PublisherModpackVersionsView } from '@/views/publisher/PublisherModpackVersionsView';
import PublisherModpackVersionDetailView from '@/views/publisher/PublisherModpackVersionDetailView';
import { useGlobalContext } from "@/stores/GlobalContext";

interface PublisherLayoutProps {
    children?: React.ReactNode;
}

// Navigation items for publisher sidebar
const getPublisherNavItems = (publisherId: string) => [
    {
        path: `/publisher/${publisherId}/modpacks`,
        label: 'Gestión de Modpacks',
        icon: LucidePackage,
        description: 'Administrar modpacks y versiones'
    },
    {
        path: `/publisher/${publisherId}/team`,
        label: 'Gestión de Equipo',
        icon: LucideUsers,
        description: 'Administrar miembros del equipo'
    },
    {
        path: `/publisher/${publisherId}/permissions`,
        label: 'Permisos Granulares',
        icon: LucideShield,
        description: 'Administrar permisos detallados por miembro'
    },
    {
        path: `/publisher/${publisherId}/payments`,
        label: 'Pagos',
        icon: LucideHandCoins,
        description: 'Ver y retirar pagos',
        disabled: true
    },
    {
        path: `/publisher/${publisherId}/settings`,
        label: 'Configuración',
        icon: LucideSettings,
        description: 'Configuración del publisher',
        disabled: true // Not implemented yet
    }
];

// Sidebar Navigation Component
const PublisherSidebar: React.FC<{ publisherId: string; publisherName: string; userRole: string }> = ({ publisherId, publisherName, userRole }) => {
    const location = useLocation();
    const { session } = useAuthentication();
    const navItems = getPublisherNavItems(publisherId);
    const { setTitleBarState, titleBarState } = useGlobalContext();

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            canGoBack: {
                history: true
            },
            title: `Gestión de Modpacks - ${publisherName}`
        });
    }, [publisherName]);

    return (
        <Card className="h-fit">
            <CardContent className="p-6">
                <div className="space-y-6">
                    {/* Publisher Header */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <LucideBuilding2 className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold">Panel de Publisher</h2>
                            <Badge variant="secondary" className="text-xs">
                                {userRole?.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {publisherName}
                        </p>
                    </div>

                    <Separator />

                    {/* Navigation */}
                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            const isDisabled = item.disabled;

                            return (
                                <div key={item.path}>
                                    {isDisabled ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-50 cursor-not-allowed">
                                            <div className="flex items-center gap-3">
                                                <Icon className="h-4 w-4" />
                                                <div>
                                                    <div className="text-sm font-medium">{item.label}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {item.description}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link to={item.path}>
                                            <div className={`flex items-center justify-between p-3 rounded-lg transition-colors ${isActive
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    <Icon className="h-4 w-4" />
                                                    <div>
                                                        <div className={`text-sm font-medium ${isActive ? 'text-primary-foreground' : ''
                                                            }`}>
                                                            {item.label}
                                                        </div>
                                                        <div className={`text-xs ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                            }`}>
                                                            {item.description}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isActive && <LucideChevronRight className="h-4 w-4" />}
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </CardContent>
        </Card>
    );
};

// Main Publisher Layout Component
export const PublisherLayout: React.FC<PublisherLayoutProps> = ({ children }) => {
    const { session, loading, sessionTokens } = useAuthentication();
    const { publisherId } = useParams<{ publisherId: string }>();
    const { teams } = useTeams(sessionTokens?.accessToken);

    // Show loading while auth is being checked
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Cargando...</p>
                </div>
            </div>
        );
    }

    // Check if user has publisher access
    const publisherMembership = session?.publisherMemberships?.find(
        membership => membership.publisherId === publisherId
    );

    if (!publisherMembership) {
        return (
            <div className="container mx-auto p-4 text-center">
                <Card>
                    <CardContent className="p-8">
                        <LucideShield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
                        <p className="text-muted-foreground mb-4">
                            No tienes permisos para acceder a este publisher.
                        </p>
                        <Button asChild>
                            <Link to="/">Volver al Inicio</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Get publisher name from teams data
    const publisherData = teams.find(team => team.id === publisherId);
    const publisherName = publisherData?.publisherName || publisherId;

    return (
        <div className="container mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <PublisherSidebar
                        publisherId={publisherId!}
                        publisherName={publisherName}
                        userRole={publisherMembership.role}
                    />
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {children || (
                        <Routes>
                            <Route path="/modpacks" element={<PublisherModpacksView />} />
                            <Route path="/modpacks/:modpackId/versions" element={<PublisherModpackVersionsView />} />
                            <Route path="/modpacks/:modpackId/versions/:versionId" element={<PublisherModpackVersionDetailView />} />
                            <Route path="/team" element={<PublisherTeamView />} />
                            <Route path="/permissions" element={<PublisherPermissionsView />} />
                            <Route path="*" element={<PublisherModpacksView />} /> {/* Default to modpacks */}
                        </Routes>
                    )}
                </div>
            </div>
        </div>
    );
};