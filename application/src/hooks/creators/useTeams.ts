// hooks/useTeams.ts
import { useState, useEffect } from "react";
import { API_ENDPOINT } from "@/consts";

interface UseTeamsReturn {
    teams: any[];
    isLoading: boolean;
    error: string | null;
}

export const useTeams = (accessToken?: string): UseTeamsReturn => {
    const [teams, setTeams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!accessToken) {
                setError("No se encontró el token de autenticación.");
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_ENDPOINT}/creators/publishers`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(`Error al obtener los equipos: ${response.statusText}`);
                }

                const data = await response.json();
                setTeams(data.teams || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Ocurrió un error desconocido.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchTeams();
    }, [accessToken]);

    return { teams, isLoading, error };
};