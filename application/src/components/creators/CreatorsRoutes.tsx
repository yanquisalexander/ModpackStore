import React from "react";
import { Routes, Route } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LucideSettings } from "lucide-react";

import { CreatorDashboard } from "@/components/creators/CreatorDashboard";
import { OrganizationModpacksView } from "@/views/creator/OrganizationModpacksView";
import { PublisherModpacksView } from "@/views/publisher/PublisherModpacksView";
import { PublisherModpackVersionsView } from "@/views/publisher/PublisherModpackVersionsView";
import PublisherModpackVersionDetailView from "@/views/publisher/PublisherModpackVersionDetailView";
import { PublisherTeamView } from "@/views/publisher/PublisherTeamViewEnhanced";
import { PublisherAnalyticsView } from "@/views/publisher/PublisherAnalyticsView";
import { PublisherStorageView } from "@/views/publisher/PublisherStorageView";
import { PublisherSettingsView } from "@/views/publisher/PublisherSettingsView";

interface CreatorsRoutesProps {
    teams: any[];
}

export const CreatorsRoutes: React.FC<CreatorsRoutesProps> = ({ teams }) => {
    return (
        <div className="min-h-full">
            <Routes>
                <Route index element={<CreatorDashboard teams={teams} />} />

                {/* Org routes */}
                <Route path="org/:publisherId/modpacks" element={<PublisherModpacksView />} />
                <Route path="org/:publisherId/modpacks/:modpackId/versions" element={<PublisherModpackVersionsView />} />
                <Route path="org/:publisherId/modpacks/:modpackId/versions/:versionId" element={<PublisherModpackVersionDetailView />} />
                <Route path="org/:publisherId/team" element={<PublisherTeamView />} />
                <Route path="org/:publisherId/analytics" element={<PublisherAnalyticsView />} />
                <Route path="org/:publisherId/storage" element={<PublisherStorageView />} />
                <Route path="org/:publisherId/settings" element={<PublisherSettingsView />} />
                <Route path="org/:publisherId" element={<OrganizationModpacksView teams={teams} />} />

                {/* Global */}
                <Route path="settings" element={
                    <div className="max-w-4xl mx-auto p-6">
                        <Card>
                            <CardHeader className="border-b border-border pb-6">
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
                                <div className="h-32 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground">
                                    Panel de configuración en construcción
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                } />
            </Routes>
        </div>
    );
};
