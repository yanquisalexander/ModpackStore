// components/OrganizationWrappers.tsx
import { useParams } from "react-router-dom";

export interface OrganizationWrapperProps {
    teams: {
        id: string;
        publisherName: string;
        logoUrl?: string;
    }[];
}

export const OrganizationWrapper: React.FC<OrganizationWrapperProps> = ({ teams }) => {
    const { orgId } = useParams<{ orgId: string }>();
    const currentTeam = teams.find(team => team.id === orgId);

    return (
        <div className="space-y-4">
            <div className="text-lg font-medium">🏠 Inicio de la Organización: {currentTeam?.publisherName}</div>
            {currentTeam && (
                <div className="bg-zinc-800 p-4 rounded-lg">
                    <h2 className="text-xl font-semibold text-blue-400">{currentTeam.publisherName}</h2>
                    <p className="text-gray-300 mt-2">ID: {currentTeam.id}</p>
                    {currentTeam.logoUrl && (
                        <img
                            src={currentTeam.logoUrl}
                            alt={`Logo de ${currentTeam.publisherName}`}
                            className="w-16 h-16 rounded-lg mt-2"
                        />
                    )}
                </div>
            )}
        </div>
    );
};



export const OrganizationMembersWrapper: React.FC<OrganizationWrapperProps> = ({ teams }) => {
    const { orgId } = useParams<{ orgId: string }>();
    const currentTeam = teams.find(team => team.id === orgId);

    return (
        <div className="space-y-4">
            <div className="text-lg font-medium">👥 Miembros de {currentTeam?.publisherName || orgId}</div>
            <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-gray-300">Lista de miembros del equipo...</p>
            </div>
        </div>
    );
};

export const OrganizationSettingsWrapper: React.FC<OrganizationWrapperProps> = ({ teams }) => {
    const { orgId } = useParams<{ orgId: string }>();
    const currentTeam = teams.find(team => team.id === orgId);

    return (
        <div className="space-y-4">
            <div className="text-lg font-medium">⚙️ Configuración de {currentTeam?.publisherName || orgId}</div>
            <div className="bg-zinc-800 p-4 rounded-lg">
                <p className="text-gray-300">Configuraciones de la organización...</p>
            </div>
        </div>
    );
};