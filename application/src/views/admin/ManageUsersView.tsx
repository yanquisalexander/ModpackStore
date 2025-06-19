import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LucideLoader, LucideTrash, LucideEdit } from 'lucide-react';

// Simulación de fetch, reemplazar por llamada real a la API
async function fetchUsers() {
    // TODO: Llamar a la API real
    return [
        { id: '1', username: 'admin', email: 'admin@modpackstore.dev', role: 'admin' },
        { id: '2', username: 'usuario', email: 'user@modpackstore.dev', role: 'user' },
    ];
}

export const ManageUsersView: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        fetchUsers()
            .then(setUsers)
            .catch((err) => setError(err.message || 'Error al cargar usuarios'))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="container mx-auto p-4">
            <header className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Administrar Usuarios</h1>
            </header>
            {isLoading && (
                <div className="flex justify-center items-center py-10">
                    <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                </div>
            )}
            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive p-4 rounded-md mb-4">
                    <p><strong>Error:</strong> {error}</p>
                </div>
            )}
            <div className="bg-card shadow-sm rounded-lg">
                <ul className="divide-y divide-border">
                    {users.map((user) => (
                        <li key={user.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0">
                            <div className="flex-grow">
                                <h2 className="text-xl font-semibold text-card-foreground">{user.username}</h2>
                                <div className="text-sm text-muted-foreground space-x-2">
                                    <span>ID: {user.id}</span>
                                    <span>Email: {user.email}</span>
                                    <span>Rol: {user.role}</span>
                                </div>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                <Button variant="outline" size="sm">
                                    <LucideEdit className="mr-2 h-3.5 w-3.5" /> Editar
                                </Button>
                                <Button variant="destructive" size="sm">
                                    <LucideTrash className="mr-2 h-3.5 w-3.5" /> Eliminar
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};
