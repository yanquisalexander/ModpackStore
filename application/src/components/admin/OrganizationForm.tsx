import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { NewPublisherData, UpdatePublisherData } from '@/services/adminPublishers';

interface OrganizationFormProps {
    initialData?: UpdatePublisherData;
    onSubmit: (data: NewPublisherData) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    isEdit?: boolean;
}

const OrganizationForm: React.FC<OrganizationFormProps> = ({ 
    initialData, 
    onSubmit, 
    onCancel, 
    isSubmitting, 
    isEdit = false 
}) => {
    const [formData, setFormData] = useState<NewPublisherData>({
        publisherName: '',
        tosUrl: '',
        privacyUrl: '',
        bannerUrl: '',
        logoUrl: '',
        description: '',
        websiteUrl: '',
        discordUrl: '',
        banned: false,
        verified: false,
        partnered: false,
        isHostingPartner: false,
        ...initialData
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.publisherName.trim()) {
            newErrors.publisherName = 'El nombre de la organización es requerido';
        } else if (formData.publisherName.length > 32) {
            newErrors.publisherName = 'El nombre no puede exceder 32 caracteres';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'La descripción es requerida';
        }

        if (!formData.tosUrl.trim()) {
            newErrors.tosUrl = 'La URL de términos de servicio es requerida';
        } else if (!isValidUrl(formData.tosUrl)) {
            newErrors.tosUrl = 'Debe ser una URL válida';
        }

        if (!formData.privacyUrl.trim()) {
            newErrors.privacyUrl = 'La URL de política de privacidad es requerida';
        } else if (!isValidUrl(formData.privacyUrl)) {
            newErrors.privacyUrl = 'Debe ser una URL válida';
        }

        if (!formData.bannerUrl.trim()) {
            newErrors.bannerUrl = 'La URL del banner es requerida';
        } else if (!isValidUrl(formData.bannerUrl)) {
            newErrors.bannerUrl = 'Debe ser una URL válida';
        }

        if (!formData.logoUrl.trim()) {
            newErrors.logoUrl = 'La URL del logo es requerida';
        } else if (!isValidUrl(formData.logoUrl)) {
            newErrors.logoUrl = 'Debe ser una URL válida';
        }

        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) {
            newErrors.websiteUrl = 'Debe ser una URL válida';
        }

        if (formData.discordUrl && !isValidUrl(formData.discordUrl)) {
            newErrors.discordUrl = 'Debe ser una URL válida';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    const handleInputChange = (field: keyof NewPublisherData, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nombre de la organización */}
                <div className="space-y-2">
                    <Label htmlFor="publisherName">Nombre de la Organización *</Label>
                    <Input
                        id="publisherName"
                        value={formData.publisherName}
                        onChange={(e) => handleInputChange('publisherName', e.target.value)}
                        placeholder="Ej: Mi Organización"
                        maxLength={32}
                        className={errors.publisherName ? 'border-red-500' : ''}
                    />
                    {errors.publisherName && (
                        <p className="text-sm text-red-500">{errors.publisherName}</p>
                    )}
                </div>

                {/* URL del Logo */}
                <div className="space-y-2">
                    <Label htmlFor="logoUrl">URL del Logo *</Label>
                    <Input
                        id="logoUrl"
                        value={formData.logoUrl}
                        onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                        placeholder="https://ejemplo.com/logo.png"
                        className={errors.logoUrl ? 'border-red-500' : ''}
                    />
                    {errors.logoUrl && (
                        <p className="text-sm text-red-500">{errors.logoUrl}</p>
                    )}
                </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
                <Label htmlFor="description">Descripción *</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe tu organización..."
                    rows={4}
                    className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                    <p className="text-sm text-red-500">{errors.description}</p>
                )}
            </div>

            {/* URL del Banner */}
            <div className="space-y-2">
                <Label htmlFor="bannerUrl">URL del Banner *</Label>
                <Input
                    id="bannerUrl"
                    value={formData.bannerUrl}
                    onChange={(e) => handleInputChange('bannerUrl', e.target.value)}
                    placeholder="https://ejemplo.com/banner.png"
                    className={errors.bannerUrl ? 'border-red-500' : ''}
                />
                {errors.bannerUrl && (
                    <p className="text-sm text-red-500">{errors.bannerUrl}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* URL de Términos de Servicio */}
                <div className="space-y-2">
                    <Label htmlFor="tosUrl">URL de Términos de Servicio *</Label>
                    <Input
                        id="tosUrl"
                        value={formData.tosUrl}
                        onChange={(e) => handleInputChange('tosUrl', e.target.value)}
                        placeholder="https://ejemplo.com/terminos"
                        className={errors.tosUrl ? 'border-red-500' : ''}
                    />
                    {errors.tosUrl && (
                        <p className="text-sm text-red-500">{errors.tosUrl}</p>
                    )}
                </div>

                {/* URL de Política de Privacidad */}
                <div className="space-y-2">
                    <Label htmlFor="privacyUrl">URL de Política de Privacidad *</Label>
                    <Input
                        id="privacyUrl"
                        value={formData.privacyUrl}
                        onChange={(e) => handleInputChange('privacyUrl', e.target.value)}
                        placeholder="https://ejemplo.com/privacidad"
                        className={errors.privacyUrl ? 'border-red-500' : ''}
                    />
                    {errors.privacyUrl && (
                        <p className="text-sm text-red-500">{errors.privacyUrl}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* URL del Sitio Web */}
                <div className="space-y-2">
                    <Label htmlFor="websiteUrl">URL del Sitio Web</Label>
                    <Input
                        id="websiteUrl"
                        value={formData.websiteUrl}
                        onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                        placeholder="https://ejemplo.com"
                        className={errors.websiteUrl ? 'border-red-500' : ''}
                    />
                    {errors.websiteUrl && (
                        <p className="text-sm text-red-500">{errors.websiteUrl}</p>
                    )}
                </div>

                {/* URL de Discord */}
                <div className="space-y-2">
                    <Label htmlFor="discordUrl">URL de Discord</Label>
                    <Input
                        id="discordUrl"
                        value={formData.discordUrl}
                        onChange={(e) => handleInputChange('discordUrl', e.target.value)}
                        placeholder="https://discord.gg/ejemplo"
                        className={errors.discordUrl ? 'border-red-500' : ''}
                    />
                    {errors.discordUrl && (
                        <p className="text-sm text-red-500">{errors.discordUrl}</p>
                    )}
                </div>
            </div>

            {/* Configuraciones */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium">Configuraciones</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                        <Switch
                            id="verified"
                            checked={formData.verified}
                            onCheckedChange={(checked) => handleInputChange('verified', checked)}
                        />
                        <Label htmlFor="verified">Verificado</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="partnered"
                            checked={formData.partnered}
                            onCheckedChange={(checked) => handleInputChange('partnered', checked)}
                        />
                        <Label htmlFor="partnered">Asociado</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="isHostingPartner"
                            checked={formData.isHostingPartner}
                            onCheckedChange={(checked) => handleInputChange('isHostingPartner', checked)}
                        />
                        <Label htmlFor="isHostingPartner">Socio de Hosting</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Switch
                            id="banned"
                            checked={formData.banned}
                            onCheckedChange={(checked) => handleInputChange('banned', checked)}
                        />
                        <Label htmlFor="banned">Baneado</Label>
                    </div>
                </div>
            </div>

            {/* Botones */}
            <div className="flex gap-4 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-amber-600 hover:bg-amber-700"
                >
                    {isSubmitting 
                        ? 'Guardando...' 
                        : isEdit 
                            ? 'Actualizar Organización' 
                            : 'Crear Organización'
                    }
                </Button>
            </div>
        </form>
    );
};

export default OrganizationForm;