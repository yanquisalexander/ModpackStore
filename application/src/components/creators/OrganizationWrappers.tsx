// components/OrganizationWrappers.tsx
import { API_ENDPOINT } from "@/consts";
import { useAuthentication } from "@/stores/AuthContext";
import { LucidePlay } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

interface OrganizationWrapperProps {
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

export const OrganizationModpacksWrapper: React.FC<OrganizationWrapperProps> = ({ teams }) => {
    const { orgId } = useParams<{ orgId: string }>();
    const currentTeam = teams.find(team => team.id === orgId);
    const { sessionTokens } = useAuthentication();

    const [loading, setLoading] = useState(true);
    const [modpacks, setModpacks] = useState<any[]>([]);

    useEffect(() => {
        if (!currentTeam) return;

        // Fetch modpacks for the current team
        const fetchModpacks = async () => {
            try {
                const response = await fetch(`${API_ENDPOINT}/creators/teams/${orgId}/modpacks`, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${sessionTokens?.accessToken}`,
                    },
                });
                const data = await response.json();
                setModpacks(data.modpacks || []);
            } catch (error) {
                console.error("Error fetching modpacks:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchModpacks();
    }, [currentTeam]);

    return (
        <div className="space-y-4">
            <div className="text-lg font-medium">📦 Modpacks de {currentTeam?.publisherName || orgId}</div>
            <div className="bg-zinc-800 p-4 rounded-lg">
                {loading ? (
                    <p className="text-gray-300">Cargando modpacks...</p>
                ) : (
                    <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modpacks.map((modpack) => (
                            <li key={modpack.id}>
                                <article className={`z-10 group relative overflow-hidden rounded-xl h-full
                                    transition 
                                    before:left-1/2 before:bottom-0 before:-translate-x-1/2 before:w-full before:h-1/2 
                                    before:rounded-full before:bg-black before:absolute before:translate-y-full 
                                    hover:before:translate-y-1/2 before:blur-3xl before:-z-10 before:transition before:duration-200 
                                    after:left-0 after:bottom-0 after:-translate-x-full after:translate-y-full 
                                    hover:after:-translate-x-1/2 hover:after:translate-y-1/2 after:w-2/2 after:aspect-square 
                                    after:rounded-2xl after:bg-black after:absolute after:blur-3xl hover:after:opacity-40 
                                    after:-z-10 after:opacity-0 after:transition after:duration-200
                                    border border-white/20`}>


                                    <Link to={`/creators/${orgId}/modpacks/${modpack.id}`} className="flex aspect-video flex-col h-full p-4">
                                        <img
                                            src={modpack.iconUrl}
                                            onError={(e) => { e.currentTarget.src = "/images/modpack-fallback.webp" }}
                                            className="absolute inset-0 -z-20 transform-gpu animate-fade-in object-cover w-full h-full rounded-xl transition duration-500 group-hover:scale-105 group-hover:opacity-80"
                                            alt={modpack.name}
                                        />

                                        <div className="opacity-100 flex transition flex-col gap-2 flex-1">
                                            <div className="flex justify-end items-start flex-wrap gap-2 transition group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0 opacity-0 duration-300">
                                                {modpack.isNew && (
                                                    <span className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-lg border border-brand-yellow bg-line bg-special-gradient px-2 text-xs text-brand-yellow backdrop-blur-xs">
                                                        <span className="py-1">Nuevo</span>
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-y-6 items-end justify-between mt-8 transition group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 opacity-0 duration-300">
                                            <div>
                                                <h2 className="text-lg mt-auto text-white leading-snug font-medium text-balance max-w-[28ch] group-hover:text-sky-200">
                                                    {modpack.name}
                                                </h2>

                                            </div>

                                        </div>
                                    </Link>
                                </article>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
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