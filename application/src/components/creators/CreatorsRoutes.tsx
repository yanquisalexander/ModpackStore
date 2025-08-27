// components/CreatorsRoutes.tsx
import React from "react";
import { Routes, Route, useParams } from "react-router-dom";
import {
    OrganizationWrapper,

    OrganizationMembersWrapper,
    OrganizationSettingsWrapper,
} from "./OrganizationWrappers";
import { OrganizationModpacksWrapper } from "./OrganizationModpacks";
import { OrganizationModpacksView } from "@/views/creator/OrganizationModpacksView";

interface CreatorsRoutesProps {
    teams: any;
}

export const CreatorsRoutes: React.FC<CreatorsRoutesProps> = ({ teams }) => {

    return (
        <Routes>
            <Route index element={<div className="text-lg font-medium">🏠 Bienvenido al panel de Creadores</div>} />
            <Route path="settings" element={<div className="text-lg font-medium">⚙️ Configuración General</div>} />
            <Route path="org/:orgId" element={<OrganizationWrapper teams={teams} />} />
            <Route path="org/:orgId/modpacks" element={<OrganizationModpacksView teams={teams} />} />
            <Route path="org/:orgId/members" element={<OrganizationMembersWrapper teams={teams} />} />
            <Route path="org/:orgId/settings" element={<OrganizationSettingsWrapper teams={teams} />} />
        </Routes>
    );
};