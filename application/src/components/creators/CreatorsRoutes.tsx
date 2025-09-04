// components/CreatorsRoutes.tsx
import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    LucideSettings,
    LucideBuilding2
} from "lucide-react";

import { OrganizationModpacksView } from "@/views/creator/OrganizationModpacksView";
import ModpackVersionDetailView from "@/views/creator/ModpackVersionDetailView";
import { ModpackEditView } from "@/views/creator/ModpackEditView";

interface CreatorsRoutesProps {
    teams: any[];
}

// Organizations List Component
const OrganizationsList: React.FC<{ teams: any[] }> = ({ teams }) => {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">Tus Organizaciones</h1>
            {teams.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <LucideBuilding2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h2 className="text-lg font-medium mb-2">No tienes organizaciones</h2>
                        <p className="text-muted-foreground">
                            Crea una organización para empezar a gestionar modpacks.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map((team) => (
                        <Card key={team.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <LucideBuilding2 className="h-6 w-6 text-primary" />
                                    <h3 className="font-semibold">{team.publisherName || team.name}</h3>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Gestiona modpacks y miembros de esta organización.
                                </p>
                                <div className="flex gap-2">
                                    <Button asChild size="sm">
                                        <Link to={`/publisher/${team.id}`}>
                                            Ver Organización
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm">
                                        <Link to={`/publisher/${team.id}/modpacks`}>
                                            Modpacks
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export const CreatorsRoutes: React.FC<CreatorsRoutesProps> = ({ teams }) => {
    return (
        <Routes>
            <Route index element={<OrganizationsList teams={teams} />} />
            <Route path="settings" element={
                <Card>
                    <CardContent className="p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <LucideSettings className="h-6 w-6 text-primary" />
                            <h1 className="text-2xl font-bold">Configuración General</h1>
                        </div>
                        <p className="text-muted-foreground">
                            Configura tus preferencias y ajustes generales.
                        </p>
                    </CardContent>
                </Card>
            } />
            <Route path="org/:orgId/modpacks" element={<OrganizationModpacksView teams={teams} />} />
            <Route path="org/:orgId/modpacks/:modpackId/edit" element={<ModpackEditView teams={teams} />} />
            <Route path="org/:orgId/modpacks/:modpackId/versions/:versionId" element={<ModpackVersionDetailView />} />
        </Routes>
    );
};