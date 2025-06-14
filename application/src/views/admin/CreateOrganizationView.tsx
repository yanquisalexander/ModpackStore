import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { toast } from 'sonner';
import { useAuthentication } from '../../../stores/AuthContext';
import { createPublisher, NewPublisherData } from '../../../services/adminPublishers';
import OrganizationForm from '../../../components/admin/OrganizationForm';
import { Button } from '../../../components/ui/button';
import { Icons } from '../../../components/Icons'; // Assuming Icons component

const CreateOrganizationView: React.FC = () => {
    const { session, isAuthenticated, sessionTokens, loading: authLoading } = useAuthentication();
    const [, navigate] = useLocation();
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleSubmit = async (data: NewPublisherData) => {
        if (!sessionTokens?.access_token) {
            toast.error("Authentication token not found. Please log in again.");
            return;
        }
        setIsSubmitting(true);
        try {
            await createPublisher(data, sessionTokens.access_token);
            toast.success('Organization created successfully!');
            navigate('/admin/organizations');
        } catch (err) {
            console.error("Error creating organization:", err);
            toast.error(err instanceof Error ? err.message : 'Failed to create organization.');
            setIsSubmitting(false); // Only set to false on error, success navigates away
        }
        // No need to set isSubmitting to false on success as the component will unmount
    };

    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
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

    if (!session?.roles.includes('admin')) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
                <p>You do not have administrative privileges to perform this action.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Create New Organization</h1>
                <Link href="/admin/organizations">
                    <Button variant="outline">
                        <Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to List
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

export default CreateOrganizationView;
