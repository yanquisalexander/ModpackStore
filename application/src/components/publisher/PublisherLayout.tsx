import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
    LucideUsers,
    LucidePackage,
    LucideSettings,
    LucideBuilding2,
    LucideShield,
    LucideHandCoins,
    LucideBarChart3,
    LucideCloud,
    LucideCrown,
    LucideMenu,
    LucideChevronRight
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { useTeams } from '@/hooks/creators/useTeams';
import { useGlobalContext } from "@/stores/GlobalContext";

// Views
import { PublisherModpacksView } from '@/views/publisher/PublisherModpacksView';
import { PublisherTeamView } from '@/views/publisher/PublisherTeamViewEnhanced';
import { PublisherModpackVersionsView } from '@/views/publisher/PublisherModpackVersionsView';
import PublisherModpackVersionDetailView from '@/views/publisher/PublisherModpackVersionDetailView';
import { PublisherPaymentsView } from '@/views/publisher/PublisherPaymentsView';
import PublisherModpackVersionWizard from '@/components/publisher/PublisherModpackVersionWizard';
import { PublisherAnalyticsView } from '@/views/publisher/PublisherAnalyticsView';
import { PublisherStorageView } from '@/views/publisher/PublisherStorageView';
import { PublisherSubscriptionView } from '@/views/publisher/PublisherSubscriptionView';
import { PublisherSettingsView } from '@/views/publisher/PublisherSettingsView';

interface PublisherLayoutProps {
    children?: React.ReactNode;
}

// Configuración centralizada de navegación
const getPublisherNavItems = (publisherId: string) => [
    {
        title: "Gestión",
        items: [
            { path: `/publisher/${publisherId}`, label: 'Modpacks', icon: LucidePackage, desc: "Tus proyectos" },
            { path: `/publisher/${publisherId}/storage`, label: 'Archivos', icon: LucideCloud, desc: "Cloud Storage" },
            { path: `/publisher/${publisherId}/analytics`, label: 'Métricas', icon: LucideBarChart3, desc: "Rendimiento" },
        ]
    },
    {
        title: "Organización",
        items: [
            { path: `/publisher/${publisherId}/team`, label: 'Equipo', icon: LucideUsers, desc: "Miembros y roles" },
            { path: `/publisher/${publisherId}/subscription`, label: 'Plan Pro', icon: LucideCrown, desc: "Facturación", disabled: import.meta.env.PROD },
            { path: `/publisher/${publisherId}/payments`, label: 'Ingresos', icon: LucideHandCoins, desc: "Retiros", disabled: true },
        ]
    },
    {
        title: "Sistema",
        items: [
            { path: `/publisher/${publisherId}/settings`, label: 'Ajustes', icon: LucideSettings, desc: "Configuración general" },
        ]
    }
];

// Componente de Items de Navegación (Reutilizable)
const NavMenu = ({ items, currentPath, onClose }: { items: ReturnType<typeof getPublisherNavItems>, currentPath: string, onClose?: () => void }) => (
    <div className="space-y-6">
        {items.map((group, idx) => (
            <div key={idx} className="space-y-1">
                <h4 className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {group.title}
                </h4>
                {group.items.map((item) => {
                    const Icon = item.icon;
                    // Lógica exacta para determinar si está activo (incluyendo subrutas)
                    const isActive = currentPath === item.path || (item.path !== `/publisher/${items[0].items[0].path.split('/')[2]}` && currentPath.startsWith(item.path + '/'));

                    if (item.disabled) return null;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            onClick={onClose}
                            className={cn(
                                "group flex items-center justify-between p-2.5 rounded-lg text-sm transition-all duration-200 border border-transparent",
                                isActive
                                    ? "bg-primary/5 border-primary/10 text-primary font-medium shadow-sm"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                <span>{item.label}</span>
                            </div>
                            {isActive && <LucideChevronRight className="h-3 w-3 text-primary/50" />}
                        </Link>
                    );
                })}
            </div>
        ))}
    </div>
);

export const PublisherLayout: React.FC<PublisherLayoutProps> = ({ children }) => {
    const { session, loading, sessionTokens } = useAuthentication();
    const { publisherId } = useParams<{ publisherId: string }>();
    const { teams } = useTeams(sessionTokens?.accessToken);
    const { setTitleBarState } = useGlobalContext();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Wizard State
    const [wizardState, setWizardState] = useState<any>({ isOpen: false, modpack: null, existingVersions: [], onSuccess: () => { } });
    const openWizard = (modpack: any, existingVersions: any, onSuccess: any) => setWizardState({ isOpen: true, modpack, existingVersions, onSuccess });
    const closeWizard = () => setWizardState((prev: any) => ({ ...prev, isOpen: false }));
    const handleWizardSuccess = () => { wizardState.onSuccess(); closeWizard(); };

    const publisherMembership = session?.creatorMemberships?.find(m => m.creatorId === publisherId);
    const publisherData = teams.find(team => team.id === publisherId);
    const publisherName = publisherData?.publisherName || "Cargando...";
    const navItems = publisherId ? getPublisherNavItems(publisherId) : [];

    useEffect(() => {
        if (publisherName) {
            setTitleBarState({
                title: `${publisherName}`,
                canGoBack: { history: true },
            });
        }
    }, [publisherName, setTitleBarState]);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

    if (!publisherMembership) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-4">
                <div className="bg-destructive/10 p-4 rounded-full"><LucideShield className="h-10 w-10 text-destructive" /></div>
                <h2 className="text-xl font-bold">Acceso Denegado</h2>
                <p className="text-muted-foreground">No eres miembro de este equipo.</p>
                <Button asChild><Link to="/">Volver al inicio</Link></Button>
            </div>
        );
    }

    return (
        <>
            <PublisherModpackVersionWizard
                isOpen={wizardState.isOpen}
                onClose={closeWizard}
                onSuccess={handleWizardSuccess}
                modpack={wizardState.modpack}
                existingVersions={wizardState.existingVersions}
            />

            <div className="container mx-auto p-4 lg:p-8 max-w-[1600px]">

                {/* Header Móvil */}
                <div className="lg:hidden mb-6 flex items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-3">
                        <LucideBuilding2 className="h-5 w-5 text-primary" />
                        <span className="font-bold truncate max-w-[200px]">{publisherName}</span>
                    </div>
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon"><LucideMenu className="h-5 w-5" /></Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                            <div className="py-6">
                                <div className="flex items-center gap-3 mb-8 px-2">
                                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <LucideBuilding2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold leading-none mb-1">{publisherName}</h3>
                                        <Badge variant="outline" className="text-[10px] h-5">{publisherMembership.role}</Badge>
                                    </div>
                                </div>
                                <NavMenu items={navItems} currentPath={location.pathname} onClose={() => setMobileOpen(false)} />
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Layout Grid Principal */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Sidebar Desktop (Sticky) */}
                    <aside className="hidden lg:block lg:col-span-3 sticky top-6">
                        <Card className="border-border/60 shadow-sm overflow-hidden">
                            <CardHeader className="pb-4 bg-muted/30 border-b border-border/40">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border shadow-sm shrink-0">
                                        <LucideBuilding2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="overflow-hidden">
                                        <h2 className="font-bold text-sm truncate" title={publisherName}>{publisherName}</h2>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-xs text-muted-foreground capitalize">{publisherMembership.role}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-6">
                                <NavMenu items={navItems} currentPath={location.pathname} />
                            </CardContent>
                        </Card>

                        {/* Card opcional de estado rápido */}
                        <Card className="mt-4 bg-primary text-primary-foreground border-none shadow-md overflow-hidden relative">
                            <div className="absolute -right-4 -top-4 bg-white/10 w-24 h-24 rounded-full blur-2xl pointer-events-none" />
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-medium text-primary-foreground/80">Plan Actual</span>
                                    <LucideCrown className="h-4 w-4 text-yellow-300" />
                                </div>
                                <div className="font-bold text-lg">Indie Developer</div>
                                <Button variant="secondary" size="sm" className="w-full mt-3 h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0">
                                    Mejorar Plan
                                </Button>
                            </CardContent>
                        </Card>
                    </aside>

                    {/* Contenido Principal */}
                    <main className="lg:col-span-9 min-w-0">
                        <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                            {children || (
                                <Routes>
                                    <Route path="/modpacks" element={<PublisherModpacksView />} />
                                    <Route path="/modpacks/:modpackId/versions" element={<PublisherModpackVersionsView onOpenWizard={openWizard} />} />
                                    <Route path="/modpacks/:modpackId/versions/:versionId" element={<PublisherModpackVersionDetailView />} />
                                    <Route path="/subscription" element={<PublisherSubscriptionView />} />
                                    <Route path="/team" element={<PublisherTeamView />} />
                                    <Route path="/payments" element={<PublisherPaymentsView />} />
                                    <Route path="/analytics" element={<PublisherAnalyticsView />} />
                                    <Route path="/storage" element={<PublisherStorageView />} />
                                    <Route path="/settings" element={<PublisherSettingsView />} />
                                    <Route path="*" element={<PublisherModpacksView />} />
                                </Routes>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
};