import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthentication } from '@/stores/AuthContext';
import { listPublishers, deletePublisher, PublisherData } from '@/services/adminPublishers';
import { Button } from '@/components/ui/button';
import { LucideEdit, LucideLoader, LucidePlus, LucideTrash } from "lucide-react";

const ManageOrganizationsView: React.FC = () => {
    const { session, isAuthenticated, sessionTokens, loading: authLoading } = useAuthentication();
    const navigate = useNavigate();

    const [organizations, setOrganizations] = useState<PublisherData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOrganizations = useCallback(async () => {
        if (!sessionTokens?.access_token) return;
        setIsLoading(true);
        setError(null);
        try {
            const data = await listPublishers(sessionTokens.access_token);
            setOrganizations(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar las organizaciones');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && session?.admin) {
            fetchOrganizations();
        }
    }, [authLoading, isAuthenticated, session, fetchOrganizations]);

    const handleDelete = async (orgId: string) => {
        if (!sessionTokens?.access_token) return;
        if (window.confirm('¿Estás seguro de que quieres eliminar esta organización? Esta acción no se puede deshacer.')) {
            setIsLoading(true); // Indicate loading for the delete and re-fetch operation
            try {
                await deletePublisher(orgId, sessionTokens.access_token);
                await fetchOrganizations(); // Re-fetch the list after deletion
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al eliminar la organización');
                console.error(err);
                setIsLoading(false); // Ensure loading is false if delete fails
            }
            // setIsLoading(false) will be called by fetchOrganizations's finally block if successful
        }
    };

    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <LucideLoader className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect to login or show message
        // For now, showing a message. A redirect would be:
        // useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
                <p>Por favor <Button variant="link" onClick={() => navigate('/login')}>inicia sesión</Button> para acceder a esta página.</p>
            </div>
        );
    }

    if (!session?.admin) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Acceso Denegado</h1>
                <p>No tienes privilegios administrativos para ver esta página.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Gestionar Organizaciones</h1>
                <Button onClick={() => navigate('/admin/organizations/new')}>
                    <LucidePlus className="mr-2 h-4 w-4" /> Crear Nueva Organización
                </Button>
            </header>

            {isLoading && !organizations.length && ( // Show central loading only if no data yet
                <div className="flex justify-center items-center py-10">
                    <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive p-4 rounded-md mb-4">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}

            {!isLoading && !error && !organizations.length && (
                <div className="text-center py-10">
                    <p>No se encontraron organizaciones.</p>
                </div>
            )}

            {organizations.length > 0 && (
                <div className="bg-card shadow-sm rounded-lg">
                    <ul className="divide-y divide-border">
                        {organizations.map((org) => (
                            <li key={org.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                                <div className="flex-grow">
                                    <h2 className="text-xl font-semibold text-card-foreground">{org.publisherName}</h2>
                                    <div className="text-sm text-muted-foreground space-x-2">
                                        <span>ID: {org.id}</span>
                                        <span>Estado:
                                            {org.banned ? <span className="font-semibold text-destructive"> Baneado</span> : <span className="font-semibold text-green-600"> Activo</span>}
                                        </span>
                                        {org.verified && <span className="text-blue-500 font-medium">Verificado</span>}
                                        {org.partnered && <span className="text-purple-500 font-medium">Asociado</span>}
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/organizations/edit/${org.id}`)}>
                                        <LucideEdit className="mr-2 h-3.5 w-3.5" /> Editar
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(org.id)}
                                        disabled={isLoading} // Disable button while any operation is in progress
                                    >
                                        <LucideTrash className="mr-2 h-3.5 w-3.5" /> Eliminar
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ManageOrganizationsView;
