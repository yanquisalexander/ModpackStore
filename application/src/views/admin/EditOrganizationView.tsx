import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'sonner';
import { getPublisherDetails, updatePublisher, PublisherData, UpdatePublisherData } from '@/services/adminPublishers';
import { useAuthentication } from "@/stores/AuthContext";
import { LucideChevronLeft, LucideLoader } from "lucide-react";
import { Button } from "@/components/ui/button";
import OrganizationForm from "@/components/admin/OrganizationForm";

interface EditOrganizationViewProps {
    params: { id: string }; // From wouter path="/admin/organizations/edit/:id"
}

const EditOrganizationView: React.FC<EditOrganizationViewProps> = ({ params }) => {
    console.log({ params }); // Debugging line to check params structure
    const publisherId = params.id; // Get publisherId from params.id
    const { session, isAuthenticated, sessionTokens, loading: authLoading } = useAuthentication();
    const navigate = useNavigate();

    const [organizationToEdit, setOrganizationToEdit] = useState<PublisherData | undefined>(undefined);
    const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);


    const fetchOrganization = useCallback(async () => {
        if (!sessionTokens?.access_token || !publisherId) return;
        setIsLoadingData(true);
        setError(null);
        try {
            const data = await getPublisherDetails(publisherId, sessionTokens.access_token);
            setOrganizationToEdit(data);
        } catch (err) {
            console.error("Error fetching organization details:", err);
            setError(err instanceof Error ? err.message : 'Error al cargar los detalles de la organización.');
            toast.error(err instanceof Error ? err.message : 'Error al cargar los datos de la organización.');
        } finally {
            setIsLoadingData(false);
        }
    }, [publisherId, sessionTokens]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && session?.admin) {
            fetchOrganization();
        }
    }, [authLoading, isAuthenticated, session, fetchOrganization]);


    const handleSubmit = async (data: UpdatePublisherData) => {
        if (!sessionTokens?.access_token || !publisherId) {
            toast.error("Token de autenticación o ID de organización no encontrado.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updatePublisher(publisherId, data, sessionTokens.access_token);
            toast.success('¡Organización actualizada exitosamente!');
            navigate('/admin/organizations');
        } catch (err) {
            console.error("Error updating organization:", err);
            toast.error(err instanceof Error ? err.message : 'Error al actualizar la organización.');
            setIsSubmitting(false);
        }
    };

    if (authLoading || isLoadingData) {
        return (
            <div className="flex justify-center items-center h-screen">
                <LucideLoader className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
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
                <p>No tienes privilegios administrativos para realizar esta acción.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
                <p>{error}</p>
                <Link to="/admin/organizations">
                    <Button variant="outline" className="mt-4">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Volver a la Lista
                    </Button>
                </Link>
            </div>
        );
    }

    if (!organizationToEdit) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Organización No Encontrada</h1>
                <p>La organización solicitada no pudo ser cargada o no existe.</p>
                <Link to="/admin/organizations">
                    <Button variant="outline" className="mt-4">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Volver a la Lista
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Editar Organización</h1>
                <Link to="/admin/organizations">
                    <Button variant="outline">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Volver a la Lista
                    </Button>
                </Link>
            </header>
            <div className="bg-card shadow-sm rounded-lg p-6">
                <OrganizationForm
                    initialData={organizationToEdit}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    onCancel={() => navigate('/admin/organizations')}
                    isEdit={true}
                />
            </div>
        </div>
    );
};

export default EditOrganizationView;
