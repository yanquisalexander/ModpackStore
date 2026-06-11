import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Asumiendo que tienes este componente, si no, es opcional
import {
    LucideSettings,
    LucideBuilding2,
    LucidePlus,
    LucideArrowRight,
    LucideBox
} from "lucide-react";

import { OrganizationModpacksView } from "@/views/creator/OrganizationModpacksView";
import ModpackVersionDetailView from "@/views/creator/ModpackVersionDetailView";

interface CreatorsRoutesProps {
    teams: any[];
}

// --- Components ---

const EmptyState = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in zoom-in duration-500">
        <div className="bg-neutral-900 p-4 rounded-full mb-4 ring-1 ring-white/10">
            <LucideBuilding2 className="h-8 w-8 text-neutral-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No tienes organizaciones</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
            Las organizaciones te permiten colaborar con otros creadores y gestionar tus modpacks en equipo.
        </p>

    </div>
);

const OrganizationCard = ({ team }: { team: any }) => (
    <div className="group relative flex flex-col h-full bg-[#121212] border border-white/5 rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
        {/* Decorative Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="p-6 flex flex-col h-full relative z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 flex items-center justify-center text-primary shadow-inner">
                        <LucideBuilding2 size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight text-white group-hover:text-primary transition-colors">
                            {team.displayName || team.name}
                        </h3>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                            Organización
                        </span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="text-sm text-neutral-400 mb-6 flex-1 leading-relaxed">
                {team.description || "Gestiona los proyectos y miembros de este equipo."}
            </p>

            {/* Actions Footer */}
            <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-white/5">
                <Button asChild variant="outline" size="sm" className="w-full bg-transparent border-white/10 hover:bg-white/5 hover:text-white">
                    <Link to={`/publisher/${team.id}/modpacks`}>
                        <LucideBox size={16} className="mr-2" />
                        Modpacks
                    </Link>
                </Button>

                <Button asChild size="sm" className="w-full group/btn">
                    <Link to={`/publisher/${team.id}`}>
                        Gestionar
                        <LucideArrowRight size={16} className="ml-2 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </div>
    </div>
);

const OrganizationsList: React.FC<{ teams: any[] }> = ({ teams }) => {
    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 p-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                        Tus Organizaciones
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Selecciona un equipo para gestionar sus proyectos.
                    </p>
                </div>


            </div>

            {/* Content Section */}
            {teams.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {teams.map((team) => (
                        <OrganizationCard key={team.id} team={team} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Main Routes Component ---

export const CreatorsRoutes: React.FC<CreatorsRoutesProps> = ({ teams }) => {
    return (
        <div className="min-h-full bg-background/50">
            <Routes>
                <Route index element={<OrganizationsList teams={teams} />} />

                {/* Settings View Styled */}
                <Route path="settings" element={
                    <div className="max-w-4xl mx-auto p-6">
                        <Card className="bg-[#121212] border-white/5">
                            <CardHeader className="border-b border-white/5 pb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <LucideSettings className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>Configuración General</CardTitle>
                                        <CardDescription>Ajusta tus preferencias de creador y notificaciones.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8">
                                {/* Placeholder Content */}
                                <div className="h-32 border-2 border-dashed border-white/10 rounded-lg flex items-center justify-center text-muted-foreground">
                                    Panel de configuración en construcción
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                } />

                {/* Sub-routes */}
                <Route path="org/:orgId/modpacks" element={<OrganizationModpacksView teams={teams} />} />
                <Route path="org/:orgId/modpacks/:modpackId/versions/:versionId" element={<ModpackVersionDetailView />} />
            </Routes>
        </div>
    );
};