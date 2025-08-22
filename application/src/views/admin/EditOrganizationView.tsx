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
    const { publisherId } = params; // Corrected to params.publisherId based on standard naming, or params.id
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
            setError(err instanceof Error ? err.message : 'Failed to fetch organization details.');
            toast.error(err instanceof Error ? err.message : 'Failed to load organization data.');
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
            toast.error("Authentication token or Organization ID not found.");
            return;
        }
        setIsSubmitting(true);
        try {
            await updatePublisher(publisherId, data, sessionTokens.access_token);
            toast.success('Organization updated successfully!');
            navigate('/admin/organizations');
        } catch (err) {
            console.error("Error updating organization:", err);
            toast.error(err instanceof Error ? err.message : 'Failed to update organization.');
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
                <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
                <p>Please <Button variant="link" onClick={() => navigate('/login')}>login</Button> to access this page.</p>
            </div>
        );
    }

    if (!session?.admin) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
                <p>You do not have administrative privileges to perform this action.</p>
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
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                </Link>
            </div>
        );
    }

    if (!organizationToEdit) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Organization Not Found</h1>
                <p>The requested organization could not be loaded or does not exist.</p>
                <Link to="/admin/organizations">
                    <Button variant="outline" className="mt-4">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Edit Organization</h1>
                <Link to="/admin/organizations">
                    <Button variant="outline">
                        <LucideChevronLeft className="mr-2 h-4 w-4" /> Back to List
                    </Button>
                </Link>
            </header>
            <div className="bg-card shadow-sm rounded-lg p-6">
                <OrganizationForm
                    organizationToEdit={organizationToEdit}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    onCancel={() => navigate('/admin/organizations')}
                />
            </div>
        </div>
    );
};

export default EditOrganizationView;
