import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    LucideLoader,
    LucideTrash,
    LucideEdit,
    LucideRefreshCw,
    LucideBuilding2,
    LucideUsers,
    LucidePackage,
    LucideShield,
    LucideCheck,
    LucideX,
    LucidePlus,
    LucideUserMinus,
    LucideCrown
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

// Types
interface Publisher {
    id: string;
    publisherName: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
    verified: boolean;
    partnered: boolean;
    banned: boolean;
    isHostingPartner: boolean;
    memberCount: number;
    modpackCount: number;
    createdAt: string;
    members?: PublisherMember[];
}

interface PublisherMember {
    userId: string;
    role: 'owner' | 'admin' | 'member';
    username: string;
    email: string;
    avatarUrl?: string;
    joinedAt: string;
}

interface PublisherFormData {
    publisherName: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
}

// API Service
class AdminPublishersAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/admin/creators`; }

    static async getPublishers(options: {
        page?: number;
        limit?: number;
        search?: string;
        verified?: boolean;
        partnered?: boolean;
        sortBy?: string;
        sortOrder?: string;
    } = {}, accessToken: string): Promise<any> {
        const params = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined) {
                params.append(key, value.toString());
            }
        });

        const response = await fetch(`${this.baseUrl}?${params}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching publishers: ${response.statusText}`);
        }

        return response.json();
    }

    static async getPublisher(id: string, accessToken: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching creator: ${response.statusText}`);
        }

        return response.json();
    }

    static async createPublisher(data: PublisherFormData, accessToken: string): Promise<any> {
        const { tosUrl, privacyUrl, websiteUrl, publisherName, ...rest } = data;
        const body = { ...rest, displayName: publisherName };

        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error creating creator: ${response.statusText}`);
        }

        return response.json();
    }

    static async updatePublisher(id: string, data: Partial<PublisherFormData & {
        verified: boolean;
        partnered: boolean;
        banned: boolean;
        isHostingPartner: boolean;
        displayName?: string;
    }>, accessToken: string): Promise<any> {
        const body: Record<string, unknown> = { ...data };
        if (body.publisherName !== undefined) {
            body.displayName = body.publisherName;
            delete body.publisherName;
        }
        if (body.partnered !== undefined) {
            body.partner = body.partnered;
            delete body.partnered;
        }
        if (body.isHostingPartner !== undefined) {
            body.hostingPartner = body.isHostingPartner;
            delete body.isHostingPartner;
        }
        delete (body as any).tosUrl;
        delete (body as any).privacyUrl;
        delete (body as any).websiteUrl;

        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error updating creator: ${response.statusText}`);
        }

        return response.json();
    }

    static async deletePublisher(id: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error deleting creator: ${response.statusText}`);
        }
    }

    static async getPublisherMembers(publisherId: string, accessToken: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching creator members: ${response.statusText}`);
        }

        return response.json();
    }

    static async addMember(publisherId: string, userId: string, role: string, accessToken: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error adding member: ${response.statusText}`);
        }

        return response.json();
    }

    static async removeMember(publisherId: string, userId: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error removing member: ${response.statusText}`);
        }
    }

    static async updateMemberRole(publisherId: string, userId: string, role: string, accessToken: string): Promise<any> {
        const response = await fetch(`${this.baseUrl}/${publisherId}/members/${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error updating member role: ${response.statusText}`);
        }

        return response.json();
    }

    // Subscription Methods
    static async getPublisherSubscriptions(publisherId: string, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions/publisher/${publisherId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) throw new Error(`Error fetching subscriptions: ${response.statusText}`);
        return response.json();
    }

    static async createSubscription(data: any, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error creating subscription: ${response.statusText}`);
        }
        return response.json();
    }

    static async cancelSubscription(id: string, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions/${id}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error cancelling subscription: ${response.statusText}`);
        }
        return response.json();
    }

    static async overrideFeature(publisherId: string, featureKey: string, value: any, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions/publisher/${publisherId}/features/override`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ featureKey, value }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error overriding feature: ${response.statusText}`);
        }
        return response.json();
    }

    static async removeFeatureOverride(publisherId: string, featureKey: string, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions/publisher/${publisherId}/features/${featureKey}/override`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error removing override: ${response.statusText}`);
        }
        return response.json();
    }

    static async setAdminOverride(publisherId: string, override: boolean, accessToken: string): Promise<any> {
        const response = await fetch(`${API_ENDPOINT}/admin/subscriptions/publisher/${publisherId}/set-override`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ override }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors?.[0]?.detail || errorData.error || `Error setting admin override: ${response.statusText}`);
        }
        return response.json();
    }
}

// Response mapper: backend uses `displayName`, frontend uses `publisherName`
const mapCreatorToPublisher = (item: any): Publisher => ({
    id: item.id,
    publisherName: item.displayName ?? '',
    description: item.description ?? '',
    tosUrl: '',
    privacyUrl: '',
    bannerUrl: item.bannerUrl ?? '',
    logoUrl: item.logoUrl ?? '',
    websiteUrl: '',
    discordUrl: item.discordUrl ?? '',
    verified: item.verified ?? false,
    partnered: item.partner ?? false,
    banned: item.banned ?? false,
    isHostingPartner: item.hostingPartner ?? false,
    memberCount: item.memberCount ?? 0,
    modpackCount: item.modpackCount ?? 0,
    createdAt: item.createdAt,
    members: item.members?.map(mapCreatorMemberToPublisherMember),
});

const mapCreatorMemberToPublisherMember = (m: any): PublisherMember => ({
    userId: m.userId,
    role: m.role,
    username: m.username,
    email: m.email,
    avatarUrl: m.avatarUrl,
    joinedAt: m.joinedAt ?? m.createdAt,
});

// Helper functions
const getRoleBadgeVariant = (role: string) => {
    switch (role) {
        case 'owner': return 'destructive';
        case 'admin': return 'default';
        case 'member': return 'secondary';
        default: return 'outline';
    }
};

const getRoleLabel = (role: string) => {
    switch (role) {
        case 'owner': return 'Propietario';
        case 'admin': return 'Administrador';
        case 'member': return 'Miembro';
        default: return role;
    }
};

// Components
const PublisherForm: React.FC<{
    publisher?: Publisher;
    onSubmit: (data: PublisherFormData) => void;
    onCancel: () => void;
    isLoading: boolean;
}> = ({ publisher, onSubmit, onCancel, isLoading }) => {
    const [formData, setFormData] = useState<PublisherFormData>({
        publisherName: publisher?.publisherName || '',
        description: publisher?.description || '',
        tosUrl: publisher?.tosUrl || '',
        privacyUrl: publisher?.privacyUrl || '',
        bannerUrl: publisher?.bannerUrl || '',
        logoUrl: publisher?.logoUrl || '',
        websiteUrl: publisher?.websiteUrl || '',
        discordUrl: publisher?.discordUrl || '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // URL validation helper
    const isValidUrl = (url: string): boolean => {
        if (!url.trim()) return true; // Empty URLs are valid (optional)
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    // Validate form
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Required fields
        if (!formData.publisherName.trim()) {
            newErrors.publisherName = 'El nombre del publisher es requerido';
        } else if (formData.publisherName.length > 32) {
            newErrors.publisherName = 'El nombre no puede exceder 32 caracteres';
        }

        // URL validations (only if not empty)
        if (formData.tosUrl && !isValidUrl(formData.tosUrl)) {
            newErrors.tosUrl = 'URL de términos de servicio inválida';
        }
        if (formData.privacyUrl && !isValidUrl(formData.privacyUrl)) {
            newErrors.privacyUrl = 'URL de política de privacidad inválida';
        }
        if (formData.bannerUrl && !isValidUrl(formData.bannerUrl)) {
            newErrors.bannerUrl = 'URL del banner inválida';
        }
        if (formData.logoUrl && !isValidUrl(formData.logoUrl)) {
            newErrors.logoUrl = 'URL del logo inválida';
        }
        if (formData.websiteUrl && !isValidUrl(formData.websiteUrl)) {
            newErrors.websiteUrl = 'URL del sitio web inválida';
        }
        if (formData.discordUrl && !isValidUrl(formData.discordUrl)) {
            newErrors.discordUrl = 'URL de Discord inválida';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
            onSubmit(formData);
        }
    };

    const updateField = (field: keyof PublisherFormData, value: string) => {
        setFormData({ ...formData, [field]: value });
        // Clear error when user starts typing
        if (errors[field]) {
            setErrors({ ...errors, [field]: '' });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Nombre del Publisher *</label>
                    <Input
                        value={formData.publisherName}
                        onChange={(e) => updateField('publisherName', e.target.value)}
                        maxLength={32}
                        className={errors.publisherName ? 'border-red-500' : ''}
                    />
                    {errors.publisherName && (
                        <p className="text-sm text-red-500 mt-1">{errors.publisherName}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL del Logo</label>
                    <Input
                        type="url"
                        value={formData.logoUrl}
                        onChange={(e) => updateField('logoUrl', e.target.value)}
                        placeholder="https://ejemplo.com/logo.png"
                        className={errors.logoUrl ? 'border-red-500' : ''}
                    />
                    {errors.logoUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.logoUrl}</p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <Input
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Descripción del publisher"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Términos de Servicio</label>
                    <Input
                        type="url"
                        value={formData.tosUrl}
                        onChange={(e) => updateField('tosUrl', e.target.value)}
                        placeholder="https://ejemplo.com/terminos"
                        className={errors.tosUrl ? 'border-red-500' : ''}
                    />
                    {errors.tosUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.tosUrl}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Política de Privacidad</label>
                    <Input
                        type="url"
                        value={formData.privacyUrl}
                        onChange={(e) => updateField('privacyUrl', e.target.value)}
                        placeholder="https://ejemplo.com/privacidad"
                        className={errors.privacyUrl ? 'border-red-500' : ''}
                    />
                    {errors.privacyUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.privacyUrl}</p>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-2">URL del Banner</label>
                <Input
                    type="url"
                    value={formData.bannerUrl}
                    onChange={(e) => updateField('bannerUrl', e.target.value)}
                    placeholder="https://ejemplo.com/banner.png"
                    className={errors.bannerUrl ? 'border-red-500' : ''}
                />
                {errors.bannerUrl && (
                    <p className="text-sm text-red-500 mt-1">{errors.bannerUrl}</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-2">URL del Sitio Web (Opcional)</label>
                    <Input
                        type="url"
                        value={formData.websiteUrl}
                        onChange={(e) => updateField('websiteUrl', e.target.value)}
                        placeholder="https://ejemplo.com"
                        className={errors.websiteUrl ? 'border-red-500' : ''}
                    />
                    {errors.websiteUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.websiteUrl}</p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2">URL de Discord (Opcional)</label>
                    <Input
                        type="url"
                        value={formData.discordUrl}
                        onChange={(e) => updateField('discordUrl', e.target.value)}
                        placeholder="https://discord.gg/ejemplo"
                        className={errors.discordUrl ? 'border-red-500' : ''}
                    />
                    {errors.discordUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.discordUrl}</p>
                    )}
                </div>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                    {publisher ? 'Actualizar' : 'Crear'}
                </Button>
            </DialogFooter>
        </form>
    );
};

const PublisherSubscriptionTab: React.FC<{ publisherId: string }> = ({ publisherId }) => {
    const { sessionTokens } = useAuthentication();
    const { toast } = useToast();
    const [subscriptions, setSubscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [createLoading, setCreateLoading] = useState(false);
    const [overrideLoading, setOverrideLoading] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // New subscription form state
    const [newSubTier, setNewSubTier] = useState('free');
    const [newSubDuration, setNewSubDuration] = useState('30');

    useEffect(() => {
        loadSubscriptions();
    }, [publisherId]);

    const loadSubscriptions = async () => {
        if (!sessionTokens?.accessToken) return;
        setLoading(true);
        try {
            const res = await AdminPublishersAPI.getPublisherSubscriptions(publisherId, sessionTokens.accessToken);
            setSubscriptions(res.data || []);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Error cargando suscripciones', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubscription = async () => {
        if (!sessionTokens?.accessToken) return;
        setCreateLoading(true);
        try {
            await AdminPublishersAPI.createSubscription({
                publisherId,
                tier: newSubTier,
                paymentProvider: 'manual', // Admin created
                durationDays: parseInt(newSubDuration),
                autoRenew: false
            }, sessionTokens.accessToken);

            toast({ title: 'Éxito', description: 'Suscripción creada correctamente' });
            setShowCreateDialog(false);
            loadSubscriptions();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setCreateLoading(false);
        }
    };

    const handleCancelSubscription = async (id: string) => {
        if (!confirm('¿Seguro que deseas cancelar esta suscripción?')) return;
        if (!sessionTokens?.accessToken) return;
        try {
            await AdminPublishersAPI.cancelSubscription(id, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Suscripción cancelada' });
            loadSubscriptions();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const handleFeatureOverride = async (featureKey: string, value: any) => {
        if (!sessionTokens?.accessToken) return;
        // Simple prompt for value for now, in a real app would be a modal
        const newValue = prompt(`Nuevo valor para ${featureKey} (true/false, number, string):`, value);
        if (newValue === null) return;

        let parsedValue: any = newValue;
        if (newValue === 'true') parsedValue = true;
        else if (newValue === 'false') parsedValue = false;
        else if (!isNaN(Number(newValue))) parsedValue = Number(newValue);

        setOverrideLoading(true);
        try {
            await AdminPublishersAPI.overrideFeature(publisherId, featureKey, parsedValue, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Característica ajustada' });
            loadSubscriptions();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setOverrideLoading(false);
        }
    };

    const handleRemoveOverride = async (featureKey: string) => {
        if (!confirm(`¿Remover override para ${featureKey}?`)) return;
        if (!sessionTokens?.accessToken) return;
        try {
            await AdminPublishersAPI.removeFeatureOverride(publisherId, featureKey, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Override removido' });
            loadSubscriptions();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    }

    const handleToggleAdminOverride = async (currentValue: boolean) => {
        if (!sessionTokens?.accessToken) return;
        try {
            await AdminPublishersAPI.setAdminOverride(publisherId, !currentValue, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: `Override administrativo ${!currentValue ? 'activado' : 'desactivado'}` });
            loadSubscriptions();
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    };

    const activeSub = subscriptions.find(s => s.isActive);

    if (loading) return <LucideLoader className="animate-spin" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Suscripción Actual</h3>
                {!activeSub && (
                    <Button onClick={() => setShowCreateDialog(true)} size="sm">
                        <LucidePlus className="mr-2 h-4 w-4" /> Asignar Plan
                    </Button>
                )}
            </div>

            {activeSub ? (
                <div className="space-y-4">
                    <Card className="border-primary/20 bg-muted/30">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle>{activeSub.tier.toUpperCase()}</CardTitle>
                                        <Badge>Activo</Badge>
                                        {activeSub.isAdminOverride && (
                                            <Badge variant="destructive" className="animate-pulse">ADMIN OVERRIDE</Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">Provider: {activeSub.paymentProvider}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant={activeSub.isAdminOverride ? "destructive" : "outline"}
                                        size="sm"
                                        onClick={() => handleToggleAdminOverride(activeSub.isAdminOverride)}
                                    >
                                        {activeSub.isAdminOverride ? "Desactivar Override" : "Activar Override"}
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => handleCancelSubscription(activeSub.id)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>Expira: {activeSub.expiresAt ? new Date(activeSub.expiresAt).toLocaleDateString() : 'Nunca'}</div>
                                <div>Días restantes: {activeSub.daysUntilExpiry ?? 'N/A'}</div>
                            </div>

                            <h4 className="font-medium mb-2">Características y Límites</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Característica</TableHead>
                                        <TableHead>Valor</TableHead>
                                        <TableHead>Override</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activeSub.features.map((f: any) => (
                                        <TableRow key={f.key}>
                                            <TableCell>{f.key}</TableCell>
                                            <TableCell className="font-mono">
                                                {typeof f.value === 'boolean' ? (f.value ? 'Sí' : 'No') : f.value}
                                            </TableCell>
                                            <TableCell>
                                                {f.isOverride && <Badge variant="secondary">Manual</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleFeatureOverride(f.key, f.value)}>
                                                        <LucideEdit className="h-4 w-4" />
                                                    </Button>
                                                    {f.isOverride && (
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveOverride(f.key)}>
                                                            <LucideTrash className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <Alert>
                    <AlertDescription>Este publisher no tiene una suscripción activa (Plan Free por defecto).</AlertDescription>
                </Alert>
            )}

            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Asignar Suscripción Manual</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Plan</label>
                            <Select value={newSubTier} onValueChange={setNewSubTier}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="basic">Basic</SelectItem>
                                    <SelectItem value="premium">Premium</SelectItem>
                                    <SelectItem value="enterprise">Enterprise</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Duración (Días)</label>
                            <Input type="number" value={newSubDuration} onChange={e => setNewSubDuration(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
                        <Button onClick={handleCreateSubscription} disabled={createLoading}>
                            {createLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Suscripción
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const PublisherDetails: React.FC<{
    publisher: Publisher;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: (field: 'verified' | 'partnered' | 'banned' | 'isHostingPartner', value: boolean) => void;
}> = ({ publisher, onEdit, onDelete, onToggleStatus }) => {
    const [members, setMembers] = useState<PublisherMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
    const [showChangeRoleDialog, setShowChangeRoleDialog] = useState(false);
    const [selectedMember, setSelectedMember] = useState<PublisherMember | null>(null);
    const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'member' });
    const [operationLoading, setOperationLoading] = useState(false);
    const [showRemoveMemberAlert, setShowRemoveMemberAlert] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<PublisherMember | null>(null);
    const { sessionTokens } = useAuthentication();
    const { toast } = useToast();

    useEffect(() => {
        loadMembers();
    }, [publisher.id]);

    const loadMembers = async () => {
        if (!sessionTokens?.accessToken) {
            console.error('No access token available');
            return;
        }

        setMembersLoading(true);
        try {
            const result = await AdminPublishersAPI.getPublisherMembers(publisher.id, sessionTokens.accessToken);
            const rawMembers = result.data || [];
            setMembers(rawMembers.map(mapCreatorMemberToPublisherMember));
        } catch (error) {
            console.error('Error loading members:', error);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setOperationLoading(true);
        try {
            await AdminPublishersAPI.addMember(publisher.id, addMemberForm.userId, addMemberForm.role, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Miembro añadido exitosamente",
            });
            setShowAddMemberDialog(false);
            setAddMemberForm({ userId: '', role: 'member' });
            loadMembers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Error al añadir miembro: " + error.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    const confirmRemoveMember = async () => {
        if (!memberToRemove || !sessionTokens?.accessToken) {
            return;
        }

        setOperationLoading(true);
        try {
            await AdminPublishersAPI.removeMember(publisher.id, memberToRemove.userId, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Miembro removido exitosamente",
            });
            loadMembers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Error al remover miembro: " + error.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
            setShowRemoveMemberAlert(false);
            setMemberToRemove(null);
        }
    };

    const handleChangeRole = async (memberId: string, newRole: string) => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setOperationLoading(true);
        try {
            await AdminPublishersAPI.updateMemberRole(publisher.id, memberId, newRole, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Rol del miembro actualizado exitosamente",
            });
            setShowChangeRoleDialog(false);
            setSelectedMember(null);
            loadMembers();
        } catch (error: any) {
            toast({
                title: "Error",
                description: "Error al cambiar rol: " + error.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold">{publisher.publisherName}</h3>
                    <p className="text-muted-foreground">{publisher.description}</p>
                    <div className="flex gap-2 mt-2">
                        {publisher.verified && <Badge variant="default">Verificado</Badge>}
                        {publisher.partnered && <Badge variant="secondary">Partner</Badge>}
                        {publisher.banned && <Badge variant="destructive">Baneado</Badge>}
                        {publisher.isHostingPartner && <Badge variant="outline">Hosting Partner</Badge>}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <LucideEdit className="h-4 w-4 mr-2" />
                        Editar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={onDelete}>
                        <LucideTrash className="h-4 w-4 mr-2" />
                        Eliminar
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="info" className="w-full">
                <TabsList>
                    <TabsTrigger value="info">Información</TabsTrigger>
                    <TabsTrigger value="members">Miembros ({members.length})</TabsTrigger>
                    <TabsTrigger value="modpacks">Modpacks ({publisher.modpackCount || 0})</TabsTrigger>
                    <TabsTrigger value="subscriptions">Suscripción</TabsTrigger>
                    <TabsTrigger value="status">Estado</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">ID</label>
                            <p className="text-sm text-muted-foreground">{publisher.id}</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Creado</label>
                            <p className="text-sm text-muted-foreground">
                                {new Date(publisher.createdAt).toLocaleDateString('es-ES')}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Sitio Web</label>
                            <p className="text-sm text-muted-foreground">
                                {publisher.websiteUrl ? (
                                    <a href={publisher.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {publisher.websiteUrl}
                                    </a>
                                ) : 'No especificado'}
                            </p>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Discord</label>
                            <p className="text-sm text-muted-foreground">
                                {publisher.discordUrl ? (
                                    <a href={publisher.discordUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        {publisher.discordUrl}
                                    </a>
                                ) : 'No especificado'}
                            </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="subscriptions">
                    <PublisherSubscriptionTab publisherId={publisher.id} />
                </TabsContent>

                <TabsContent value="members">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">
                                    <LucideUsers className="h-5 w-5" />
                                    Miembros del Publisher
                                </CardTitle>
                                <Button
                                    onClick={() => setShowAddMemberDialog(true)}
                                    size="sm"
                                >
                                    <LucidePlus className="h-4 w-4 mr-2" />
                                    Añadir Miembro
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {membersLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <LucideLoader className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Rol</TableHead>
                                            <TableHead>Unido</TableHead>
                                            <TableHead>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((member) => (
                                            <TableRow key={member.userId}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        {member.avatarUrl && (
                                                            <img
                                                                src={member.avatarUrl}
                                                                alt={member.username}
                                                                className="w-6 h-6 rounded-full"
                                                            />
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{member.username}</p>
                                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getRoleBadgeVariant(member.role)}>
                                                        {getRoleLabel(member.role)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(member.joinedAt).toLocaleDateString('es-ES')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedMember(member);
                                                                setShowChangeRoleDialog(true);
                                                            }}
                                                        >
                                                            <LucideCrown className="h-4 w-4 mr-2" />
                                                            Cambiar Rol
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => {
                                                                setMemberToRemove(member);
                                                                setShowRemoveMemberAlert(true);
                                                            }}
                                                        >
                                                            <LucideUserMinus className="h-4 w-4 mr-2" />
                                                            Remover
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="modpacks">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LucidePackage className="h-5 w-5" />
                                Modpacks
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                {publisher.modpackCount || 0} modpacks asociados
                            </p>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="status">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <LucideShield className="h-5 w-5" />
                                Estado del Publisher
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Verificado</p>
                                    <p className="text-sm text-muted-foreground">Publisher verificado oficialmente</p>
                                </div>
                                <Button
                                    variant={publisher.verified ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('verified', !publisher.verified)}
                                >
                                    {publisher.verified ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.verified ? 'Desverificar' : 'Verificar'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Partner</p>
                                    <p className="text-sm text-muted-foreground">Publisher partner oficial</p>
                                </div>
                                <Button
                                    variant={publisher.partnered ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('partnered', !publisher.partnered)}
                                >
                                    {publisher.partnered ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.partnered ? 'Quitar Partner' : 'Hacer Partner'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Baneado</p>
                                    <p className="text-sm text-muted-foreground">Publisher suspendido</p>
                                </div>
                                <Button
                                    variant={publisher.banned ? "default" : "destructive"}
                                    size="sm"
                                    onClick={() => onToggleStatus('banned', !publisher.banned)}
                                >
                                    {publisher.banned ? <LucideCheck className="h-4 w-4 mr-2" /> : <LucideX className="h-4 w-4 mr-2" />}
                                    {publisher.banned ? 'Desbanear' : 'Banear'}
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">Hosting Partner</p>
                                    <p className="text-sm text-muted-foreground">Publisher con servicios de hosting</p>
                                </div>
                                <Button
                                    variant={publisher.isHostingPartner ? "destructive" : "default"}
                                    size="sm"
                                    onClick={() => onToggleStatus('isHostingPartner', !publisher.isHostingPartner)}
                                >
                                    {publisher.isHostingPartner ? <LucideX className="h-4 w-4 mr-2" /> : <LucideCheck className="h-4 w-4 mr-2" />}
                                    {publisher.isHostingPartner ? 'Quitar Hosting' : 'Hacer Hosting Partner'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Add Member Dialog */}
            <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Agregar Miembro al Publisher</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">ID de usuario o Username de Discord</label>
                            <Input
                                value={addMemberForm.userId}
                                onChange={(e) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                                placeholder="Introduce el ID del usuario o @username de Discord"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Rol</label>
                            <Select
                                value={addMemberForm.role}
                                onValueChange={(value) => setAddMemberForm({ ...addMemberForm, role: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">Propietario</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="member">Miembro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAddMember} disabled={operationLoading}>
                            {operationLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Agregar Miembro
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Role Dialog */}
            <Dialog open={showChangeRoleDialog} onOpenChange={setShowChangeRoleDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cambiar Rol del Miembro</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Usuario</label>
                            <Input
                                value={selectedMember?.username}
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Rol Actual</label>
                            <Badge variant={getRoleBadgeVariant(selectedMember?.role || 'member')}>
                                {getRoleLabel(selectedMember?.role || 'member')}
                            </Badge>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Nuevo Rol</label>
                            <Select
                                value={selectedMember?.role || 'member'}
                                onValueChange={(value) => {
                                    if (selectedMember) {
                                        handleChangeRole(selectedMember.userId, value);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccione un nuevo rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">Propietario</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="member">Miembro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowChangeRoleDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={() => {
                            if (selectedMember) {
                                handleChangeRole(selectedMember.userId, selectedMember.role);
                            }
                        }} disabled={operationLoading}>
                            {operationLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Cambiar Rol
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Member Alert Dialog */}
            <AlertDialog open={showRemoveMemberAlert} onOpenChange={setShowRemoveMemberAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Miembro</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que quieres remover a {memberToRemove?.username} del publisher?
                            Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowRemoveMemberAlert(false);
                            setMemberToRemove(null);
                        }}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveMember}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {operationLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Remover Miembro
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export const ManagePublishersView: React.FC = () => {
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();

    // State
    const [publishers, setPublishers] = useState<Publisher[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPublisher, setSelectedPublisher] = useState<Publisher | null>(null);

    // Dialog states
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);
    const [showDeletePublisherAlert, setShowDeletePublisherAlert] = useState(false);
    const [publisherToDelete, setPublisherToDelete] = useState<Publisher | null>(null);

    // Filter states
    const [search, setSearch] = useState('');
    const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
    const [partneredFilter, setPartneredFilter] = useState<string>('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    useEffect(() => {
        if (sessionTokens?.accessToken) {
            loadPublishers();
        }
    }, [currentPage, search, verifiedFilter, partneredFilter, sessionTokens?.accessToken]);

    const loadPublishers = async () => {
        if (!sessionTokens?.accessToken) {
            setError('No access token available');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const options: any = {
                page: currentPage,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'DESC'
            };

            if (search) options.search = search;
            if (verifiedFilter !== 'all') options.verified = verifiedFilter === 'true';
            if (partneredFilter !== 'all') options.partnered = partneredFilter === 'true';

            const result = await AdminPublishersAPI.getPublishers(options, sessionTokens.accessToken);

            const rawList = result.data || [];
            setPublishers(rawList.map(mapCreatorToPublisher));
            setTotal(result.meta?.total || 0);
            setTotalPages(result.meta?.totalPages || 1);
        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error",
                description: "Error al cargar los publishers: " + err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePublisher = async (data: PublisherFormData) => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setOperationLoading(true);
        try {
            await AdminPublishersAPI.createPublisher(data, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Publisher creado exitosamente",
            });
            setShowCreateDialog(false);
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al crear publisher: " + err.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    const handleEditPublisher = async (data: PublisherFormData) => {
        if (!selectedPublisher) return;

        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        setOperationLoading(true);
        try {
            await AdminPublishersAPI.updatePublisher(selectedPublisher.id, data, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Publisher actualizado exitosamente",
            });
            setShowEditDialog(false);
            setSelectedPublisher(null);
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al actualizar publisher: " + err.message,
                variant: "destructive",
            });
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePublisher = async (publisher: Publisher) => {
        setPublisherToDelete(publisher);
        setShowDeletePublisherAlert(true);
    };

    const confirmDeletePublisher = async () => {
        if (!publisherToDelete || !sessionTokens?.accessToken) {
            return;
        }

        try {
            await AdminPublishersAPI.deletePublisher(publisherToDelete.id, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Publisher eliminado exitosamente",
            });
            loadPublishers();
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al eliminar publisher: " + err.message,
                variant: "destructive",
            });
        } finally {
            setShowDeletePublisherAlert(false);
            setPublisherToDelete(null);
        }
    };

    const handleToggleStatus = async (publisherId: string, field: 'verified' | 'partnered' | 'banned' | 'isHostingPartner', value: boolean) => {
        if (!sessionTokens?.accessToken) {
            toast({
                title: 'Error',
                description: 'No access token available',
                variant: 'destructive'
            });
            return;
        }

        try {
            await AdminPublishersAPI.updatePublisher(publisherId, { [field]: value }, sessionTokens.accessToken);
            toast({
                title: "Éxito",
                description: "Estado del publisher actualizado exitosamente",
            });
            loadPublishers();
            if (selectedPublisher && selectedPublisher.id === publisherId) {
                const updatedPublisher = { ...selectedPublisher, [field]: value };
                setSelectedPublisher(updatedPublisher);
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: "Error al actualizar estado: " + err.message,
                variant: "destructive",
            });
        }
    };

    const resetFilters = () => {
        setSearch('');
        setVerifiedFilter('all');
        setPartneredFilter('all');
        setCurrentPage(1);
    };

    // Check if user has admin privileges
    if (!session?.isAdmin?.()) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <LucideShield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
                    <p className="text-muted-foreground">
                        No tienes permisos para acceder a la gestión de publishers.
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Publishers</h1>
                    <p className="text-muted-foreground">
                        Administrar organizaciones, miembros y configuraciones
                    </p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <LucideBuilding2 className="mr-2 h-4 w-4" />
                            Crear Publisher
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Crear Nuevo Publisher</DialogTitle>
                        </DialogHeader>
                        <PublisherForm
                            onSubmit={handleCreatePublisher}
                            onCancel={() => setShowCreateDialog(false)}
                            isLoading={operationLoading}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex-1 min-w-[200px]">
                            <Input
                                placeholder="Buscar publishers..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Verificados" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="true">Verificados</SelectItem>
                                <SelectItem value="false">No Verificados</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={partneredFilter} onValueChange={setPartneredFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Partners" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="true">Partners</SelectItem>
                                <SelectItem value="false">No Partners</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={resetFilters}>
                            <LucideRefreshCw className="h-4 w-4 mr-2" />
                            Limpiar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LucideBuilding2 className="h-5 w-5" />
                        Publishers ({total})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Publisher</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Miembros</TableHead>
                                        <TableHead>Creado</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {publishers.map((publisher) => (
                                        <TableRow key={publisher.id}>
                                            <TableCell>

                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={publisher.logoUrl}
                                                        alt={publisher.publisherName}
                                                        className="w-8 h-8 rounded"
                                                        onError={(e) => {
                                                            // Evitar loop infinito verificando si ya es UI Avatar
                                                            if (!e.currentTarget.src.includes('ui-avatars.com')) {
                                                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(publisher.publisherName)}&size=32&background=random`;
                                                            }
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="font-medium">{publisher.publisherName}</p>
                                                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                                                            {publisher.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {publisher.verified && <Badge variant="default" className="text-xs">Verificado</Badge>}
                                                    {publisher.partnered && <Badge variant="secondary" className="text-xs">Partner</Badge>}
                                                    {publisher.banned && <Badge variant="destructive" className="text-xs">Baneado</Badge>}
                                                    {publisher.isHostingPartner && <Badge variant="outline" className="text-xs">Hosting</Badge>}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {publisher.memberCount || 0}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(publisher.createdAt).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPublisher(publisher);
                                                            setShowDetailsDialog(true);
                                                        }}
                                                    >
                                                        Ver
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedPublisher(publisher);
                                                            setShowEditDialog(true);
                                                        }}
                                                    >
                                                        <LucideEdit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => {
                                                            setPublisherToDelete(publisher);
                                                            setShowDeletePublisherAlert(true);
                                                        }}
                                                    >
                                                        <LucideTrash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(currentPage + 1)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Publisher</DialogTitle>
                    </DialogHeader>
                    {selectedPublisher && (
                        <PublisherForm
                            publisher={selectedPublisher}
                            onSubmit={handleEditPublisher}
                            onCancel={() => {
                                setShowEditDialog(false);
                                setSelectedPublisher(null);
                            }}
                            isLoading={operationLoading}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Details Dialog */}
            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalles del Publisher</DialogTitle>
                    </DialogHeader>
                    {selectedPublisher && (
                        <PublisherDetails
                            publisher={selectedPublisher}
                            onEdit={() => {
                                setShowDetailsDialog(false);
                                setShowEditDialog(true);
                            }}
                            onDelete={() => {
                                setShowDetailsDialog(false);
                                handleDeletePublisher(selectedPublisher);
                            }}
                            onToggleStatus={(field, value) => handleToggleStatus(selectedPublisher.id, field, value)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Publisher Alert Dialog */}
            <AlertDialog open={showDeletePublisherAlert} onOpenChange={setShowDeletePublisherAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Publisher</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar el publisher "{publisherToDelete?.publisherName}"?
                            Esta acción no se puede deshacer y eliminará permanentemente el publisher y toda su información.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowDeletePublisherAlert(false);
                            setPublisherToDelete(null);
                        }}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDeletePublisher}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar Publisher
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};