import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthentication } from '@/stores/AuthContext';
import {
    LucideWrench,
    LucideTrash,
    LucideLoader
} from 'lucide-react';
import { API_ENDPOINT } from "@/consts";


export const MaintenanceView: React.FC = () => {
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();

    const [isCleanupLoading, setIsCleanupLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Prevent non-admin users from accessing this view
    if (!session?.isAdmin?.()) {
        return (
            <div className="container mx-auto p-4 text-center">
                <Alert>
                    <AlertDescription>
                        No tienes permisos para acceder a esta página.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    const handleCleanupModpackFiles = async () => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'Token de acceso no disponible',
                variant: 'destructive'
            });
            return;
        }

        setIsCleanupLoading(true);

        try {
            const response = await fetch(`${API_ENDPOINT}/admin/maintenance/cleanup-modpack-files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${sessionTokens.accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Error en el servidor');
            }

            const result = await response.json();

            // Close dialog
            setIsDialogOpen(false);

            // Show success toast
            if (result.deletedCount > 0) {
                toast({
                    title: 'Éxito',
                    description: `Se eliminaron ${result.deletedCount} registros huérfanos.`,
                });
            } else {
                toast({
                    title: 'Éxito',
                    description: 'No se encontraron registros huérfanos para limpiar.',
                });
            }
        } catch (error) {
            console.error('Cleanup error:', error);

            // Close dialog
            setIsDialogOpen(false);

            // Show error toast
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'No se pudo completar la limpieza. Inténtalo de nuevo.',
                variant: 'destructive'
            });
        } finally {
            setIsCleanupLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Header */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideWrench className="h-5 w-5" />
                        Mantenimiento del Sistema
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Herramientas para el mantenimiento y limpieza de datos del sistema.
                        Utiliza estas funciones con precaución ya que las acciones son irreversibles.
                    </p>
                </CardContent>
            </Card>

            {/* Cleanup Actions */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideTrash className="h-5 w-5" />
                        Limpiar Archivos de Modpacks Huérfanos
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        Elimina registros de la base de datos y sus archivos correspondientes que no están
                        asociados a ninguna versión de modpack. Esta acción es irreversible.
                    </p>

                    <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="destructive"
                                disabled={isCleanupLoading}
                                className="w-full sm:w-auto"
                            >
                                {isCleanupLoading ? (
                                    <>
                                        <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <LucideTrash className="h-4 w-4 mr-2" />
                                        Ejecutar Limpieza
                                    </>
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción buscará y eliminará permanentemente todos los registros y
                                    archivos de ModpackFiles huérfanos. No podrás deshacer esta operación.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isCleanupLoading}>
                                    Cancelar
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleCleanupModpackFiles}
                                    disabled={isCleanupLoading}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    {isCleanupLoading ? (
                                        <>
                                            <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                            Limpiando...
                                        </>
                                    ) : (
                                        'Confirmar y Limpiar'
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>
        </div>
    );
};