import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuthentication } from '../../../stores/AuthContext';
import { listPublishers, deletePublisher, PublisherData } from '../../../services/adminPublishers';
import { Button } from '../../../components/ui/button';
import { Icons } from '../../../components/Icons'; // Assuming Icons component for loading spinner

const ManageOrganizationsView: React.FC = () => {
    const { session, isAuthenticated, sessionTokens, loading: authLoading } = useAuthentication();
    const [, navigate] = useLocation();

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
            setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [sessionTokens]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && session?.roles.includes('admin')) {
            fetchOrganizations();
        }
    }, [authLoading, isAuthenticated, session, fetchOrganizations]);

    const handleDelete = async (orgId: string) => {
        if (!sessionTokens?.access_token) return;
        if (window.confirm('Are you sure you want to delete this organization? This action cannot be undone.')) {
            setIsLoading(true); // Indicate loading for the delete and re-fetch operation
            try {
                await deletePublisher(orgId, sessionTokens.access_token);
                await fetchOrganizations(); // Re-fetch the list after deletion
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete organization');
                console.error(err);
                setIsLoading(false); // Ensure loading is false if delete fails
            }
            // setIsLoading(false) will be called by fetchOrganizations's finally block if successful
        }
    };

    if (authLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect to login or show message
        // For now, showing a message. A redirect would be:
        // useEffect(() => { if (!isAuthenticated) navigate('/login'); }, [isAuthenticated, navigate]);
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
                <p>You do not have administrative privileges to view this page.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Manage Organizations</h1>
                <Button onClick={() => navigate('/admin/organizations/new')}>
                    <Icons.plus className="mr-2 h-4 w-4" /> Create New Organization
                </Button>
            </header>

            {isLoading && !organizations.length && ( // Show central loading only if no data yet
                <div className="flex justify-center items-center py-10">
                    <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive p-4 rounded-md mb-4">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}

            {!isLoading && !error && !organizations.length && (
                <div className="text-center py-10">
                    <p>No organizations found.</p>
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
                                        <span>Status:
                                            {org.banned ? <span className="font-semibold text-destructive"> Banned</span> : <span className="font-semibold text-green-600"> Active</span>}
                                        </span>
                                        {org.verified && <span className="text-blue-500 font-medium">Verified</span>}
                                        {org.partnered && <span className="text-purple-500 font-medium">Partnered</span>}
                                    </div>
                                </div>
                                <div className="flex space-x-2 flex-shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => navigate(`/admin/organizations/edit/${org.id}`)}>
                                        <Icons.edit className="mr-2 h-3.5 w-3.5" /> Edit
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(org.id)}
                                        disabled={isLoading} // Disable button while any operation is in progress
                                    >
                                        <Icons.trash className="mr-2 h-3.5 w-3.5" /> Delete
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
