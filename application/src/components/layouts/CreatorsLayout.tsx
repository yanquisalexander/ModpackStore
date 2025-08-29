// CreatorsLayout.tsx
import { useMatch } from "react-router-dom";
import { useAuthentication } from "@/stores/AuthContext";
import { getBaseNavItems, getOrgNavItems } from "../creators/navigation";
import { ErrorScreen } from "@/components/ErrorScreen";
import { CreatorsRoutes } from "../creators/CreatorsRoutes";
import { CreatorsSidebar } from "../creators/CreatorsSidebar";
import { LoaderCircle } from "lucide-react";
import { useTitleBar } from "@/hooks/creators/useTitleBar";
import { useTeams } from "@/hooks/creators/useTeams";
import { ArmadilloLoading } from "../ArmadilloLoading";

export const LoadingScreen = ({ message = "Cargando panel de creador..." }) => {
    return (
        <div className="flex min-h-screen  text-gray-100 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col items-center justify-center h-64">
                    <ArmadilloLoading className="h-14" />
                    <p className="text-neutral-400 font-minecraft-ten tracking-wider text-sm mt-2">
                        {message}
                    </p>
                </div>
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

    // Renderizado principal
    return (
        <div className="flex min-h-screen bg-[#202020] text-gray-100">
            <CreatorsSidebar
                isOrgRoute={isOrgRoute}
                orgId={orgId}
                navItems={navItems}
                teams={teams}
            />

            <main className="flex-1 ml-64 pt-9 p-8">
                <CreatorsRoutes teams={teams} />
            </main>
        </div>
    );
};

export default CreatorsLayout;