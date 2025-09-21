import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
    LucideFileText,
    LucideLoader,
    LucideRefreshCw,
    LucideUserX,
    LucideSave,
    LucideEye
} from 'lucide-react';
import { ToSService, type ToSSettings } from '@/services/termsAndConditions';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

export const ManageTermsAndConditionsView: React.FC = () => {
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();

    const [tosSettings, setTosSettings] = useState<ToSSettings>({ content: '', enabled: false });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

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

    // Load ToS settings on mount
    useEffect(() => {
        loadToSSettings();
    }, []);

    const loadToSSettings = async () => {
        if (!sessionTokens?.accessToken) return;

        setIsLoading(true);
        try {
            const settings = await ToSService.getAdminSettings(sessionTokens.accessToken);
            setTosSettings(settings);
            setHasChanges(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron cargar las configuraciones de ToS',
                variant: 'destructive'
            });
            console.error('Failed to load ToS settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContentChange = (content: string) => {
        setTosSettings(prev => ({ ...prev, content }));
        setHasChanges(true);
    };

    const handleEnabledChange = (enabled: boolean) => {
        setTosSettings(prev => ({ ...prev, enabled }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!sessionTokens?.accessToken || !hasChanges) return;

        setIsSaving(true);
        try {
            const updatedSettings = await ToSService.updateSettings(tosSettings, sessionTokens.accessToken);
            setTosSettings(updatedSettings);
            setHasChanges(false);
            toast({
                title: 'Éxito',
                description: 'Configuraciones de Términos y Condiciones actualizadas exitosamente'
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron guardar las configuraciones',
                variant: 'destructive'
            });
            console.error('Failed to save ToS settings:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRevokeAll = async () => {
        if (!sessionTokens?.accessToken) return;

        setIsRevoking(true);
        try {
            const result = await ToSService.revokeAllAcceptances(sessionTokens.accessToken);
            toast({
                title: 'Éxito',
                description: `Se revocaron las autorizaciones de ${result.usersUpdated} usuarios`
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron revocar las autorizaciones',
                variant: 'destructive'
            });
            console.error('Failed to revoke ToS acceptances:', error);
        } finally {
            setIsRevoking(false);
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex items-center justify-center h-64">
                    <LucideLoader className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <LucideFileText className="h-8 w-8" />
                        Términos y Condiciones
                    </h1>
                    <p className="text-muted-foreground">
                        Gestiona el contenido y configuración de los términos y condiciones
                    </p>
                </div>
                <Button 
                    onClick={loadToSSettings} 
                    variant="outline" 
                    size="sm"
                    disabled={isLoading}
                >
                    <LucideRefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Actualizar
                </Button>
            </div>

            {/* Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Configuración General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="tos-enabled"
                            checked={tosSettings.enabled}
                            onCheckedChange={handleEnabledChange}
                        />
                        <Label htmlFor="tos-enabled">
                            Requerir aceptación de términos y condiciones
                        </Label>
                    </div>
                    {tosSettings.enabled && (
                        <Alert>
                            <AlertDescription>
                                Cuando está habilitado, todos los usuarios deberán aceptar los términos 
                                y condiciones antes de poder usar la aplicación.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* Content Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Contenido (Markdown)</CardTitle>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowPreview(!showPreview)}
                            >
                                <LucideEye className="h-4 w-4 mr-2" />
                                {showPreview ? 'Editar' : 'Vista Previa'}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {showPreview ? (
                        <ScrollArea className="h-96 border rounded-md p-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>{tosSettings.content || '*Sin contenido*'}</ReactMarkdown>
                            </div>
                        </ScrollArea>
                    ) : (
                        <Textarea
                            placeholder="Ingresa el contenido de los términos y condiciones en formato Markdown..."
                            value={tosSettings.content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            className="min-h-96 font-mono text-sm"
                        />
                    )}
                </CardContent>
            </Card>

            {/* Actions Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Acciones Administrativas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className="flex-1"
                        >
                            {isSaving ? (
                                <>
                                    <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <LucideSave className="h-4 w-4 mr-2" />
                                    Guardar Cambios
                                </>
                            )}
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    variant="destructive" 
                                    disabled={isRevoking}
                                    className="flex-1"
                                >
                                    {isRevoking ? (
                                        <>
                                            <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                            Revocando...
                                        </>
                                    ) : (
                                        <>
                                            <LucideUserX className="h-4 w-4 mr-2" />
                                            Revocar Todas las Autorizaciones
                                        </>
                                    )}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción revocará las autorizaciones de términos y condiciones 
                                        de todos los usuarios. Tendrán que aceptar nuevamente los términos 
                                        para poder usar la aplicación.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleRevokeAll}>
                                        Sí, revocar todas
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>

                    {hasChanges && (
                        <Alert>
                            <AlertDescription>
                                Tienes cambios sin guardar. No olvides guardar antes de salir.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};