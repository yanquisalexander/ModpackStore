// components/CreatorsRoutes.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import {
    OrganizationWrapper,
    OrganizationModpacksWrapper,
    OrganizationMembersWrapper,
    OrganizationSettingsWrapper,
} from "./OrganizationWrappers";

interface CreatorsRoutesProps {
    teams: any;
}

export const CreatorsRoutes: React.FC<CreatorsRoutesProps> = ({ teams }) => {
    return (
        <Routes>
            <Route index element={<div className="text-lg font-medium">🏠 Bienvenido al panel de Creadores</div>} />
            <Route path="settings" element={<div className="text-lg font-medium">⚙️ Configuración General</div>} />
            <Route path="org/:orgId" element={<OrganizationWrapper teams={teams} />} />
            <Route path="org/:orgId/modpacks" element={<OrganizationModpacksWrapper teams={teams} />} />
            <Route path="org/:orgId/members" element={<OrganizationMembersWrapper teams={teams} />} />
            <Route path="org/:orgId/settings" element={<OrganizationSettingsWrapper teams={teams} />} />
        </Routes>
    );
};