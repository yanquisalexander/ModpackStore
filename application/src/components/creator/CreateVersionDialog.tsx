import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LucidePackage, LucidePlus } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { handleApiError } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (versionId: string) => void;
    modpack: {
        id: string;
        name: string;
        publisherId: string;
    };
}

export const CreateVersionDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, modpack }) => {
    const { sessionTokens } = useAuthentication();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        versionName: '',
        mcVersion: '',
        forgeVersion: 'none',
        changelog: ''
    });

    // Mock data - in a real app, you'd fetch these from APIs
    const minecraftVersions = [
        '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2'
    ];

    const forgeVersions = [
        '47.2.0', '47.1.0', '43.3.0', '43.2.11', '36.2.39', '14.23.5.2860'
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.versionName.trim() || !formData.mcVersion) {
            toast.error('El nombre de la versión y la versión de Minecraft son requeridos');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(
                `${API_ENDPOINT}/creators/publishers/${modpack.publisherId}/modpacks/${modpack.id}/versions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        versionName: formData.versionName.trim(),
                        mcVersion: formData.mcVersion,
                        forgeVersion: formData.forgeVersion === 'none' ? null : formData.forgeVersion || null,
                        changelog: formData.changelog.trim() || null
                    }),
                }
            );

            if (!response.ok) {
                await handleApiError(response);
                return;
            }

            const data = await response.json();
            toast.success('Versión creada exitosamente');

            // Reset form
            setFormData({
                versionName: '',
                mcVersion: '',
                forgeVersion: 'none',
                changelog: ''
            });

            onSuccess(data.version?.id || 'new-version');
            onClose();
        } catch (error) {
            console.error('Error creating version:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear la versión');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({
                versionName: '',
                mcVersion: '',
                forgeVersion: 'none',
                changelog: ''
            });
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <LucidePackage className="h-5 w-5" />
                        Crear Nueva Versión
                    </DialogTitle>
                    <DialogDescription>
                        Crear una nueva versión para el modpack "{modpack.name}"
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Version Name */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Nombre de la Versión *
                        </label>
                        <Input
                            value={formData.versionName}
                            onChange={(e) => setFormData(prev => ({ ...prev, versionName: e.target.value }))}
                            placeholder="ej: 1.0.0, v2.1.3, Release Candidate 1"
                            disabled={loading}
                            required
                        />
                    </div>

                    {/* Minecraft Version */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Versión de Minecraft *
                        </label>
                        <Select
                            value={formData.mcVersion}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, mcVersion: value }))}
                            disabled={loading}
                            required
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar versión de Minecraft" />
                            </SelectTrigger>
                            <SelectContent>
                                {minecraftVersions.map((version) => (
                                    <SelectItem key={version} value={version}>
                                        Minecraft {version}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Forge Version */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Versión de Forge (Opcional)
                        </label>
                        <Select
                            value={formData.forgeVersion}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, forgeVersion: value }))}
                            disabled={loading}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar versión de Forge (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Sin Forge (Vanilla)</SelectItem>
                                {forgeVersions.map((version) => (
                                    <SelectItem key={version} value={version}>
                                        Forge {version}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Changelog */}
                    <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                            Changelog (Opcional)
                        </label>
                        <Textarea
                            value={formData.changelog}
                            onChange={(e) => setFormData(prev => ({ ...prev, changelog: e.target.value }))}
                            placeholder="Describe los cambios en esta versión..."
                            disabled={loading}
                            rows={4}
                        />
                    </div>

                    {/* Info Box */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>Siguiente paso:</strong> Después de crear la versión, podrás subir archivos
                            o reutilizar archivos de versiones anteriores en cada categoría (mods, resourcepacks, config, etc.).
                        </p>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.versionName.trim() || !formData.mcVersion}
                        >
                            <LucidePlus className="h-4 w-4 mr-2" />
                            {loading ? 'Creando...' : 'Crear Versión'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};