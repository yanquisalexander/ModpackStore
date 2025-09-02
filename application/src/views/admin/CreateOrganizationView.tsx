import React, { useState } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'sonner';
import { useAuthentication } from '@/stores/AuthContext';
import { createPublisher, NewPublisherData } from '@/services/adminPublishers';
import OrganizationForm from '@/components/admin/OrganizationForm';
import { Button } from '@/components/ui/button';
import { LucideChevronLeft, LucideLoader } from "lucide-react";

export const CreateOrganizationView: React.FC = () => {
    const { session, isAuthenticated, sessionTokens, loading: authLoading } = useAuthentication();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleSubmit = async (data: NewPublisherData) => {
        if (!sessionTokens?.access_token) {
            toast.error("Token de autenticación no encontrado. Por favor, inicia sesión nuevamente.");
            return;
        }
        setIsSubmitting(true);
        try {
            await createPublisher(data, sessionTokens.access_token);
            toast.success('¡Organización creada exitosamente!');
            navigate('/admin/organizations');
        } catch (err) {
            console.error("Error al crear la organización:", err);
            toast.error(err instanceof Error ? err.message : 'Error al crear la organización.');
            setIsSubmitting(false); // Only set to false on error, success navigates away
        }
        // No need to set isSubmitting to false on success as the component will unmount
    };

    if (authLoading) {
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

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Crear Nueva Organización</h1>
                <Link to="/admin/organizations">
                    <Button variant="outline">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Volver a la Lista
                    </Button>
                </Link>
            </header>
            <div className="bg-card shadow-sm rounded-lg p-6">
                <OrganizationForm
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    onCancel={() => navigate('/admin/organizations')}
                />
            </div>
        </div>
    );
};

