import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
    LucideCrown,
    LucideClock,
    LucideBan,
    LucideSearch,
    LucideEye,
    LucidePalette,
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { Pagination } from '@/components/admin/Pagination';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Types ─────────────────────────────────────────

interface Creator {
    id: string;
    displayName: string;
    slug: string;
    description: string;
    tosUrl: string;
    privacyUrl: string;
    bannerUrl: string;
    logoUrl: string;
    websiteUrl?: string;
    discordUrl?: string;
    status: 'pending' | 'approved' | 'rejected';
    verified: boolean;
    partner: boolean;
    banned: boolean;
    hostingPartner: boolean;
    memberCount: number;
    modpackCount: number;
    createdAt: string;
    members?: CreatorMember[];
}

interface CreatorMember {
    userId: string;
    role: 'owner' | 'admin' | 'member';
    username: string;
    email: string;
    avatarUrl?: string;
    joinedAt: string;
}

interface CreatorFormData {
    displayName: string;
    description: string;
    bannerUrl: string;
    logoUrl: string;
    discordUrl?: string;
}

// ── API Service ───────────────────────────────────

class AdminCreatorsAPI {
    private static get baseUrl() { return `${API_ENDPOINT}/admin/creators`; }

    static async getPendingCreators(accessToken: string): Promise<Creator[]> {
        const response = await fetch(`${this.baseUrl}/pending`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching pending creators');
        const json = await response.json();
        return (json.data || []).map(mapBackendCreator);
    }

    static async approveCreator(id: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${id}/approve`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error approving creator');
        }
    }

    static async rejectCreator(id: string, accessToken: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${id}/reject`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error rejecting creator');
        }
    }

    static async getCreators(options: {
        page?: number;
        limit?: number;
        search?: string;
        verified?: boolean;
        partnered?: boolean;
        status?: string;
        banned?: boolean;
        sortBy?: string;
        sortOrder?: string;
    } = {}, accessToken: string) {
        const params = new URLSearchParams();
        Object.entries(options).forEach(([key, value]) => {
            if (value !== undefined) params.append(key, value.toString());
        });

        const response = await fetch(`${this.baseUrl}?${params}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching creators');
        return response.json();
    }

    static async getCreator(id: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching creator');
        return response.json();
    }

    static async createCreator(data: CreatorFormData, accessToken: string) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error creating creator');
        }
        return response.json();
    }

    static async updateCreator(id: string, data: Partial<CreatorFormData & {
        verified: boolean;
        partner: boolean;
        banned: boolean;
        hostingPartner: boolean;
    }>, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error updating creator');
        }
        return response.json();
    }

    static async deleteCreator(id: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error deleting creator');
        }
    }

    static async getCreatorMembers(creatorId: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching members');
        return response.json();
    }

    static async addMember(creatorId: string, userId: string, role: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, role }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error adding member');
        }
        return response.json();
    }

    static async removeMember(creatorId: string, userId: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error removing member');
        }
    }

    static async updateMemberRole(creatorId: string, userId: string, role: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/members/${userId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error updating role');
        }
        return response.json();
    }

    static async getStorageConfig(creatorId: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/storage/config`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching storage config');
        return response.json();
    }

    static async updateStorageConfig(creatorId: string, storageLimitBytes: number, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/storage/config`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ storageLimitBytes }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.errors?.[0]?.detail || err.error || 'Error updating storage config');
        }
        return response.json();
    }

    static async getStorageUsage(creatorId: string, accessToken: string) {
        const response = await fetch(`${this.baseUrl}/${creatorId}/storage/usage`, {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Error fetching storage usage');
        return response.json();
    }
}

// ── Mappers ───────────────────────────────────────

const mapBackendCreator = (item: any): Creator => ({
    id: item.id,
    displayName: item.displayName ?? '',
    slug: item.slug ?? '',
    description: item.description ?? '',
    tosUrl: '',
    privacyUrl: '',
    bannerUrl: item.bannerUrl ?? '',
    logoUrl: item.logoUrl ?? '',
    websiteUrl: '',
    discordUrl: item.discordUrl ?? '',
    status: item.status ?? 'pending',
    verified: item.verified ?? false,
    partner: item.partner ?? false,
    banned: item.banned ?? false,
    hostingPartner: item.hostingPartner ?? false,
    memberCount: item.memberCount ?? 0,
    modpackCount: item.modpackCount ?? 0,
    createdAt: item.createdAt,
    members: item.members?.map(mapBackendMember),
});

const mapBackendMember = (m: any): CreatorMember => ({
    userId: m.userId,
    role: m.role,
    username: m.username,
    email: m.email,
    avatarUrl: m.avatarUrl,
    joinedAt: m.joinedAt ?? m.createdAt,
});

// ── Helpers ───────────────────────────────────────

const getRoleBadge = (role: string) => {
    switch (role) {
        case 'owner': return { variant: 'destructive' as const, label: 'Propietario', icon: LucideCrown };
        case 'admin': return { variant: 'default' as const, label: 'Administrador', icon: LucideShield };
        case 'member': return { variant: 'secondary' as const, label: 'Miembro', icon: LucideUsers };
        default: return { variant: 'outline' as const, label: role, icon: LucideUsers };
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'approved': return { variant: 'default' as const, label: 'Aprobado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        case 'pending': return { variant: 'secondary' as const, label: 'Pendiente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
        case 'rejected': return { variant: 'destructive' as const, label: 'Rechazado', className: 'bg-red-500/10 text-red-400 border-red-500/20' };
        default: return { variant: 'outline' as const, label: status, className: '' };
    }
};

const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// ── Animation Variants ────────────────────────────

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
};

const rowVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

// ── Sub-Components ────────────────────────────────

const CreatorAvatar: React.FC<{ logoUrl: string; name: string; size?: 'sm' | 'md' | 'lg' }> = ({ logoUrl, name, size = 'md' }) => {
    const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };
    const [imgError, setImgError] = useState(false);

    if (!logoUrl || imgError) {
        return (
            <div className={`${sizes[size]} rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0`}>
                {getInitials(name)}
            </div>
        );
    }

    return (
        <img
            src={logoUrl}
            alt={name}
            className={`${sizes[size]} rounded-lg object-cover shrink-0`}
            onError={() => setImgError(true)}
        />
    );
};

const EmptyState: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({ icon: Icon, title, description }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
);

// ── Creator Form Dialog ───────────────────────────

const CreatorFormDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creator?: Creator;
    onSubmit: (data: CreatorFormData) => Promise<void>;
}> = ({ open, onOpenChange, creator, onSubmit }) => {
    const [formData, setFormData] = useState<CreatorFormData>({
        displayName: creator?.displayName || '',
        description: creator?.description || '',
        bannerUrl: creator?.bannerUrl || '',
        logoUrl: creator?.logoUrl || '',
        discordUrl: creator?.discordUrl || '',
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setFormData({
                displayName: creator?.displayName || '',
                description: creator?.description || '',
                bannerUrl: creator?.bannerUrl || '',
                logoUrl: creator?.logoUrl || '',
                discordUrl: creator?.discordUrl || '',
            });
            setErrors({});
        }
    }, [open, creator]);

    const isValidUrl = (url: string) => {
        if (!url.trim()) return true;
        try { new URL(url); return true; } catch { return false; }
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!formData.displayName.trim()) e.displayName = 'El nombre es requerido';
        else if (formData.displayName.length > 32) e.displayName = 'Máximo 32 caracteres';
        if (formData.bannerUrl && !isValidUrl(formData.bannerUrl)) e.bannerUrl = 'URL inválida';
        if (formData.logoUrl && !isValidUrl(formData.logoUrl)) e.logoUrl = 'URL inválida';
        if (formData.discordUrl && !isValidUrl(formData.discordUrl)) e.discordUrl = 'URL inválida';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            await onSubmit(formData);
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <LucidePalette className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle>{creator ? 'Editar Creador' : 'Crear Creador'}</DialogTitle>
                            <p className="text-sm text-muted-foreground">
                                {creator ? 'Modifica la información del creador' : 'Registra un nuevo creador en la plataforma'}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1.5">Nombre *</label>
                            <Input
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                placeholder="Nombre del creador"
                                maxLength={32}
                                className={errors.displayName ? 'border-destructive' : ''}
                            />
                            {errors.displayName && <p className="text-xs text-destructive mt-1">{errors.displayName}</p>}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1.5">Descripción</label>
                            <Input
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Descripción breve del creador"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">URL del Logo</label>
                            <Input
                                value={formData.logoUrl}
                                onChange={e => setFormData({ ...formData, logoUrl: e.target.value })}
                                placeholder="https://..."
                                className={errors.logoUrl ? 'border-destructive' : ''}
                            />
                            {errors.logoUrl && <p className="text-xs text-destructive mt-1">{errors.logoUrl}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1.5">URL del Banner</label>
                            <Input
                                value={formData.bannerUrl}
                                onChange={e => setFormData({ ...formData, bannerUrl: e.target.value })}
                                placeholder="https://..."
                                className={errors.bannerUrl ? 'border-destructive' : ''}
                            />
                            {errors.bannerUrl && <p className="text-xs text-destructive mt-1">{errors.bannerUrl}</p>}
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium mb-1.5">Discord</label>
                            <Input
                                value={formData.discordUrl}
                                onChange={e => setFormData({ ...formData, discordUrl: e.target.value })}
                                placeholder="https://discord.gg/..."
                                className={errors.discordUrl ? 'border-destructive' : ''}
                            />
                            {errors.discordUrl && <p className="text-xs text-destructive mt-1">{errors.discordUrl}</p>}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            {creator ? 'Guardar Cambios' : 'Crear Creador'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

// ── Creator Details Dialog ────────────────────────

const CreatorDetailsDialog: React.FC<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    creator: Creator | null;
    onEdit: () => void;
    onDelete: () => void;
    onToggleStatus: (field: string, value: boolean) => void;
}> = ({ open, onOpenChange, creator, onEdit, onDelete, onToggleStatus }) => {
    const { sessionTokens } = useAuthentication();
    const { toast } = useToast();
    const [members, setMembers] = useState<CreatorMember[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showChangeRole, setShowChangeRole] = useState(false);
    const [showRemoveMember, setShowRemoveMember] = useState(false);
    const [selectedMember, setSelectedMember] = useState<CreatorMember | null>(null);
    const [addMemberForm, setAddMemberForm] = useState({ userId: '', role: 'member' });
    const [opLoading, setOpLoading] = useState<string | null>(null);
    const [storageConfig, setStorageConfig] = useState<any>(null);
    const [storageUsage, setStorageUsage] = useState<any>(null);
    const [storageLoading, setStorageLoading] = useState(false);
    const [storageLimitInput, setStorageLimitInput] = useState('');

    const loadMembers = useCallback(async () => {
        if (!creator || !sessionTokens?.accessToken) return;
        setMembersLoading(true);
        try {
            const res = await AdminCreatorsAPI.getCreatorMembers(creator.id, sessionTokens.accessToken);
            setMembers((res.data || []).map(mapBackendMember));
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setMembersLoading(false);
        }
    }, [creator, sessionTokens?.accessToken]);

    useEffect(() => {
        if (open && creator) loadMembers();
    }, [open, creator]);

    const loadStorageConfig = useCallback(async () => {
        if (!creator || !sessionTokens?.accessToken) return;
        setStorageLoading(true);
        try {
            const [configRes, usageRes] = await Promise.all([
                AdminCreatorsAPI.getStorageConfig(creator.id, sessionTokens.accessToken),
                AdminCreatorsAPI.getStorageUsage(creator.id, sessionTokens.accessToken),
            ]);
            setStorageConfig(configRes.data);
            setStorageUsage(usageRes.data);
            setStorageLimitInput(String(Math.round((configRes.data?.storageLimitBytes || 31457280) / 1048576)));
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setStorageLoading(false);
        }
    }, [creator, sessionTokens?.accessToken]);

    useEffect(() => {
        if (open && creator) loadStorageConfig();
    }, [open, creator]);

    const handleUpdateStorageConfig = async () => {
        if (!creator || !sessionTokens?.accessToken) return;
        const limitMB = parseInt(storageLimitInput, 10);
        if (isNaN(limitMB) || limitMB < 0) {
            toast({ title: 'Error', description: 'Límite inválido', variant: 'destructive' });
            return;
        }
        setOpLoading('storage');
        try {
            await AdminCreatorsAPI.updateStorageConfig(creator.id, limitMB * 1048576, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Límite de storage actualizado' });
            loadStorageConfig();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
        }
    };

    const handleAddMember = async () => {
        if (!creator || !sessionTokens?.accessToken) return;
        setOpLoading('add-member');
        try {
            await AdminCreatorsAPI.addMember(creator.id, addMemberForm.userId, addMemberForm.role, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Miembro agregado' });
            setShowAddMember(false);
            setAddMemberForm({ userId: '', role: 'member' });
            loadMembers();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
        }
    };

    const handleChangeRole = async (userId: string, newRole: string) => {
        if (!creator || !sessionTokens?.accessToken) return;
        setOpLoading('change-role');
        try {
            await AdminCreatorsAPI.updateMemberRole(creator.id, userId, newRole, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Rol actualizado' });
            setShowChangeRole(false);
            setSelectedMember(null);
            loadMembers();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
        }
    };

    const handleRemoveMember = async () => {
        if (!creator || !selectedMember || !sessionTokens?.accessToken) return;
        setOpLoading('remove-member');
        try {
            await AdminCreatorsAPI.removeMember(creator.id, selectedMember.userId, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Miembro removido' });
            setShowRemoveMember(false);
            setSelectedMember(null);
            loadMembers();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
        }
    };

    if (!creator) return null;

    const statusBadge = getStatusBadge(creator.status);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <div className="flex items-start gap-4">
                            <CreatorAvatar logoUrl={creator.logoUrl} name={creator.displayName} size="lg" />
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="text-lg">{creator.displayName}</DialogTitle>
                                <p className="text-sm text-muted-foreground line-clamp-1">{creator.description || 'Sin descripción'}</p>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Badge variant={statusBadge.variant} className={statusBadge.className}>{statusBadge.label}</Badge>
                                    {creator.verified && <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20">Verificado</Badge>}
                                    {creator.partner && <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">Partner</Badge>}
                                    {creator.hostingPartner && <Badge variant="outline">Hosting</Badge>}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={onEdit}>
                                    <LucideEdit className="h-4 w-4 mr-1" /> Editar
                                </Button>
                                <Button variant="destructive" size="sm" onClick={onDelete}>
                                    <LucideTrash className="h-4 w-4 mr-1" /> Banear
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    <Tabs defaultValue="members" className="flex-1 overflow-hidden flex flex-col">
                        <TabsList className="w-full justify-start">
                            <TabsTrigger value="members">Miembros ({members.length})</TabsTrigger>
                            <TabsTrigger value="status">Estado</TabsTrigger>
                            <TabsTrigger value="storage">Storage</TabsTrigger>
                            <TabsTrigger value="info">Info</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto mt-4">
                            <TabsContent value="members" className="space-y-4">
                                <div className="flex justify-end">
                                    <Button size="sm" onClick={() => setShowAddMember(true)}>
                                        <LucidePlus className="h-4 w-4 mr-1" /> Agregar
                                    </Button>
                                </div>

                                {membersLoading ? (
                                    <div className="flex justify-center py-8"><LucideLoader className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                                ) : members.length === 0 ? (
                                    <EmptyState icon={LucideUsers} title="Sin miembros" description="Este creador no tiene miembros" />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Usuario</TableHead>
                                                <TableHead>Rol</TableHead>
                                                <TableHead>Unido</TableHead>
                                                <TableHead className="w-24"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {members.map(member => {
                                                const roleBadge = getRoleBadge(member.role);
                                                const RoleIcon = roleBadge.icon;
                                                return (
                                                    <TableRow key={member.userId}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2.5">
                                                                <CreatorAvatar logoUrl={member.avatarUrl || ''} name={member.username} size="sm" />
                                                                <div>
                                                                    <p className="font-medium text-sm">{member.username}</p>
                                                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={roleBadge.variant} className="gap-1">
                                                                <RoleIcon className="h-3 w-3" />
                                                                {roleBadge.label}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {new Date(member.joinedAt).toLocaleDateString('es-ES')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => { setSelectedMember(member); setShowChangeRole(true); }}
                                                                >
                                                                    <LucideCrown className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    onClick={() => { setSelectedMember(member); setShowRemoveMember(true); }}
                                                                >
                                                                    <LucideUserMinus className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </TabsContent>

                            <TabsContent value="status" className="space-y-4">
                                {[
                                    { field: 'verified', label: 'Verificado', desc: 'Creador verificado oficialmente', icon: LucideShield },
                                    { field: 'partner', label: 'Partner', desc: 'Creador partner oficial', icon: LucideCheck },
                                    { field: 'hostingPartner', label: 'Hosting Partner', desc: 'Con servicios de hosting', icon: LucidePackage },
                                    { field: 'banned', label: 'Baneado', desc: 'Creador suspendido', icon: LucideBan },
                                ].map(({ field, label, desc, icon: Icon }) => {
                                    const val = creator[field as keyof Creator] as boolean;
                                    return (
                                        <div key={field} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${val ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{label}</p>
                                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant={val ? 'destructive' : 'default'}
                                                size="sm"
                                                onClick={() => onToggleStatus(field, !val)}
                                            >
                                                {val ? (
                                                    <><LucideX className="h-4 w-4 mr-1" /> Desactivar</>
                                                ) : (
                                                    <><LucideCheck className="h-4 w-4 mr-1" /> Activar</>
                                                )}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </TabsContent>

                            <TabsContent value="storage" className="space-y-4">
                                {storageLoading ? (
                                    <div className="flex justify-center py-8">
                                        <LucideLoader className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-4 rounded-lg border bg-card">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="font-medium text-sm">Límite de Storage</p>
                                                    <p className="text-xs text-muted-foreground">Espacio máximo para assets del creador</p>
                                                </div>
                                                <Badge variant="outline">
                                                    {storageConfig ? `${Math.round(storageConfig.storageLimitBytes / 1048576)} MB` : '—'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={storageLimitInput}
                                                    onChange={e => setStorageLimitInput(e.target.value)}
                                                    placeholder="MB"
                                                    className="w-32"
                                                    min="0"
                                                />
                                                <span className="text-sm text-muted-foreground">MB</span>
                                                <Button
                                                    size="sm"
                                                    onClick={handleUpdateStorageConfig}
                                                    disabled={opLoading === 'storage'}
                                                >
                                                    {opLoading === 'storage' && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                                                    Guardar
                                                </Button>
                                            </div>
                                        </div>

                                        {storageUsage && (
                                            <div className="p-4 rounded-lg border bg-card">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="font-medium text-sm">Uso Actual</p>
                                                    <span className="text-sm text-muted-foreground">
                                                        {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.limitBytes)}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-2">
                                                    <div
                                                        className="bg-primary h-2 rounded-full transition-all"
                                                        style={{ width: `${Math.min(100, storageUsage.percentage)}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {storageUsage.percentage}% utilizado • {formatBytes(storageUsage.availableBytes)} disponibles
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </TabsContent>

                            <TabsContent value="info" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'ID', value: creator.id },
                                        { label: 'Slug', value: creator.slug },
                                        { label: 'Creado', value: new Date(creator.createdAt).toLocaleDateString('es-ES') },
                                        { label: 'Discord', value: creator.discordUrl || '—' },
                                        { label: 'Modpacks', value: String(creator.modpackCount || 0) },
                                        { label: 'Miembros', value: String(creator.memberCount || 0) },
                                    ].map(({ label, value }) => (
                                        <div key={label}>
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                                            <p className="text-sm mt-0.5">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </DialogContent>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Agregar Miembro</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1.5">ID de usuario o @username</label>
                            <Input
                                value={addMemberForm.userId}
                                onChange={e => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                                placeholder="ID o @username de Discord"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5">Rol</label>
                            <Select value={addMemberForm.role} onValueChange={v => setAddMemberForm({ ...addMemberForm, role: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="owner">Propietario</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="member">Miembro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddMember(false)} disabled={opLoading !== null}>Cancelar</Button>
                        <Button onClick={handleAddMember} disabled={opLoading !== null || !addMemberForm.userId.trim()}>
                            {opLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Agregar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Change Role Dialog */}
            <Dialog open={showChangeRole} onOpenChange={setShowChangeRole}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cambiar Rol</DialogTitle>
                    </DialogHeader>
                    {selectedMember && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                <CreatorAvatar logoUrl={selectedMember.avatarUrl || ''} name={selectedMember.username} size="sm" />
                                <div>
                                    <p className="font-medium text-sm">{selectedMember.username}</p>
                                    <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1.5">Nuevo Rol</label>
                                <Select defaultValue={selectedMember.role} onValueChange={v => handleChangeRole(selectedMember.userId, v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="owner">Propietario</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                        <SelectItem value="member">Miembro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowChangeRole(false); setSelectedMember(null); }}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Remove Member Alert */}
            <AlertDialog open={showRemoveMember} onOpenChange={setShowRemoveMember}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remover Miembro</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Eliminar a <strong>{selectedMember?.username}</strong> del creador? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={opLoading !== null}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemoveMember}
                            disabled={opLoading !== null}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {opLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Remover
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

// ── Pending Creator Row ───────────────────────────

const PendingCreatorRow: React.FC<{
    creator: Creator;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onView: (creator: Creator) => void;
    loading: string | null;
}> = ({ creator, onApprove, onReject, onView, loading }) => (
    <motion.tr variants={rowVariants} className="group">
        <TableCell>
            <div className="flex items-center gap-3">
                <CreatorAvatar logoUrl={creator.logoUrl} name={creator.displayName} />
                <div>
                    <p className="font-medium">{creator.displayName}</p>
                    <p className="text-xs text-muted-foreground">{creator.description || 'Sin descripción'}</p>
                </div>
            </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
            {new Date(creator.createdAt).toLocaleDateString('es-ES')}
        </TableCell>
        <TableCell>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={loading !== null}
                    onClick={() => onApprove(creator.id)}
                >
                    {loading === `approve-${creator.id}` ? (
                        <LucideLoader className="h-4 w-4 animate-spin" />
                    ) : (
                        <><LucideCheck className="h-4 w-4 mr-1" /> Aprobar</>
                    )}
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    disabled={loading !== null}
                    onClick={() => onReject(creator.id)}
                >
                    {loading === `reject-${creator.id}` ? (
                        <LucideLoader className="h-4 w-4 animate-spin" />
                    ) : (
                        <><LucideX className="h-4 w-4 mr-1" /> Rechazar</>
                    )}
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onView(creator)}
                >
                    <LucideEye className="h-4 w-4" />
                </Button>
            </div>
        </TableCell>
    </motion.tr>
);

// ── Main View ─────────────────────────────────────

export const ManageCreatorsView: React.FC = () => {
    const { session, sessionTokens } = useAuthentication();
    const { toast } = useToast();

    // State
    const [activeTab, setActiveTab] = useState('all');
    const [pendingCreators, setPendingCreators] = useState<Creator[]>([]);
    const [allCreators, setAllCreators] = useState<Creator[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingLoading, setPendingLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [opLoading, setOpLoading] = useState<string | null>(null);

    // Dialogs
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);

    // Confirm dialogs
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);
    const [creatorToDelete, setCreatorToDelete] = useState<Creator | null>(null);
    const [showRejectAlert, setShowRejectAlert] = useState(false);
    const [creatorToReject, setCreatorToReject] = useState<Creator | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [verifiedFilter, setVerifiedFilter] = useState<string>('all');
    const [partnerFilter, setPartnerFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const limit = 10;

    // Load pending creators
    const loadPending = useCallback(async () => {
        if (!sessionTokens?.accessToken) return;
        setPendingLoading(true);
        try {
            const data = await AdminCreatorsAPI.getPendingCreators(sessionTokens.accessToken);
            setPendingCreators(data);
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setPendingLoading(false);
        }
    }, [sessionTokens?.accessToken]);

    // Load all creators
    const loadCreators = useCallback(async () => {
        if (!sessionTokens?.accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const opts: any = { page: currentPage, limit, sortBy: 'createdAt', sortOrder: 'DESC' };
            if (search) opts.search = search;
            if (statusFilter !== 'all') opts.status = statusFilter;
            if (verifiedFilter !== 'all') opts.verified = verifiedFilter === 'true';
            if (partnerFilter !== 'all') opts.partnered = partnerFilter === 'true';

            const result = await AdminCreatorsAPI.getCreators(opts, sessionTokens.accessToken);
            setAllCreators((result.data || []).map(mapBackendCreator));
            setTotal(result.meta?.total || 0);
            setTotalPages(result.meta?.totalPages || 1);
        } catch (err: any) {
            setError(err.message);
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [currentPage, search, statusFilter, verifiedFilter, partnerFilter, sessionTokens?.accessToken]);

    useEffect(() => {
        loadPending();
    }, [loadPending]);

    useEffect(() => {
        if (activeTab !== 'pending') loadCreators();
    }, [activeTab, loadCreators]);

    // Actions
    const handleApprove = async (id: string) => {
        if (!sessionTokens?.accessToken) return;
        setOpLoading(`approve-${id}`);
        try {
            await AdminCreatorsAPI.approveCreator(id, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Creador aprobado correctamente' });
            setPendingCreators(prev => prev.filter(c => c.id !== id));
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
        }
    };

    const handleReject = (creator: Creator) => {
        setCreatorToReject(creator);
        setShowRejectAlert(true);
    };

    const confirmReject = async () => {
        if (!creatorToReject || !sessionTokens?.accessToken) return;
        setOpLoading(`reject-${creatorToReject.id}`);
        try {
            await AdminCreatorsAPI.rejectCreator(creatorToReject.id, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Creador rechazado' });
            setPendingCreators(prev => prev.filter(c => c.id !== creatorToReject.id));
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setOpLoading(null);
            setShowRejectAlert(false);
            setCreatorToReject(null);
        }
    };

    const handleCreateCreator = async (data: CreatorFormData) => {
        if (!sessionTokens?.accessToken) return;
        try {
            await AdminCreatorsAPI.createCreator(data, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Creador creado' });
            loadCreators();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            throw err;
        }
    };

    const handleEditCreator = async (data: CreatorFormData) => {
        if (!selectedCreator || !sessionTokens?.accessToken) return;
        try {
            await AdminCreatorsAPI.updateCreator(selectedCreator.id, data, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Creador actualizado' });
            loadCreators();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
            throw err;
        }
    };

    const handleDeleteCreator = async () => {
        if (!creatorToDelete || !sessionTokens?.accessToken) return;
        try {
            await AdminCreatorsAPI.deleteCreator(creatorToDelete.id, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Creador baneado' });
            loadCreators();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setShowDeleteAlert(false);
            setCreatorToDelete(null);
        }
    };

    const handleToggleStatus = async (field: string, value: boolean) => {
        if (!selectedCreator || !sessionTokens?.accessToken) return;
        try {
            await AdminCreatorsAPI.updateCreator(selectedCreator.id, { [field]: value } as any, sessionTokens.accessToken);
            toast({ title: 'Éxito', description: 'Estado actualizado' });
            setSelectedCreator(prev => prev ? { ...prev, [field]: value } : null);
            loadCreators();
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        }
    };

    const resetFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setVerifiedFilter('all');
        setPartnerFilter('all');
        setCurrentPage(1);
    };

    // Auth check
    if (!session?.isAdmin?.()) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <LucideShield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">Acceso Denegado</h2>
                    <p className="text-muted-foreground">No tienes permisos para gestionar creadores.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gestión de Creadores</h1>
                    <p className="text-muted-foreground text-sm">Administrar creadores, aprobaciones y configuración</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { loadPending(); loadCreators(); }}>
                        <LucideRefreshCw className="h-4 w-4 mr-1" /> Actualizar
                    </Button>
                    <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                        <LucidePlus className="h-4 w-4 mr-1" /> Crear Creador
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="pending" className="gap-1.5">
                        <LucideClock className="h-4 w-4" />
                        Pendientes
                        {pendingCreators.length > 0 && (
                            <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">
                                {pendingCreators.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="all" className="gap-1.5">
                        <LucideUsers className="h-4 w-4" />
                        Todos ({total})
                    </TabsTrigger>
                </TabsList>

                {/* ── Pending Tab ── */}
                <TabsContent value="pending">
                    <Card>
                        <CardContent className="p-0">
                            {pendingLoading ? (
                                <div className="flex justify-center py-12">
                                    <LucideLoader className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : pendingCreators.length === 0 ? (
                                <EmptyState
                                    icon={LucideCheck}
                                    title="Sin creadores pendientes"
                                    description="No hay creadores esperando aprobación"
                                />
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Creador</TableHead>
                                            <TableHead>Solicitud</TableHead>
                                            <TableHead className="w-64">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pendingCreators.map(creator => (
                                            <PendingCreatorRow
                                                key={creator.id}
                                                creator={creator}
                                                onApprove={handleApprove}
                                                onReject={handleReject}
                                                onView={(c) => { setSelectedCreator(c); setShowDetailsDialog(true); }}
                                                loading={opLoading}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── All Creators Tab ── */}
                <TabsContent value="all" className="space-y-4">
                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-wrap gap-3 items-center">
                                <div className="flex-1 min-w-[200px]">
                                    <Input
                                        placeholder="Buscar creadores..."
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="approved">Aprobados</SelectItem>
                                        <SelectItem value="pending">Pendientes</SelectItem>
                                        <SelectItem value="rejected">Rechazados</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={verifiedFilter} onValueChange={v => { setVerifiedFilter(v); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Verificados" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="true">Verificados</SelectItem>
                                        <SelectItem value="false">No Verificados</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={partnerFilter} onValueChange={v => { setPartnerFilter(v); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[130px]"><SelectValue placeholder="Partners" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="true">Partners</SelectItem>
                                        <SelectItem value="false">No Partners</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="sm" onClick={resetFilters}>
                                    <LucideRefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <Card>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <LucideLoader className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : error ? (
                                <Alert variant="destructive" className="m-4">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            ) : allCreators.length === 0 ? (
                                <EmptyState icon={LucideSearch} title="Sin resultados" description="No se encontraron creadores con los filtros aplicados" />
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Creador</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead>Miembros</TableHead>
                                                <TableHead>Creado</TableHead>
                                                <TableHead className="w-24"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {allCreators.map(creator => {
                                                const sBadge = getStatusBadge(creator.status);
                                                return (
                                                    <TableRow key={creator.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <CreatorAvatar logoUrl={creator.logoUrl} name={creator.displayName} />
                                                                <div>
                                                                    <p className="font-medium">{creator.displayName}</p>
                                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{creator.description || 'Sin descripción'}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1 flex-wrap">
                                                                <Badge variant={sBadge.variant} className={sBadge.className}>{sBadge.label}</Badge>
                                                                {creator.verified && <Badge className="bg-sky-500/10 text-sky-400 border-sky-500/20 text-xs">Verificado</Badge>}
                                                                {creator.partner && <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">Partner</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-sm">{creator.memberCount || 0}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {new Date(creator.createdAt).toLocaleDateString('es-ES')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => { setSelectedCreator(creator); setShowDetailsDialog(true); }}
                                                                >
                                                                    <LucideEye className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() => { setSelectedCreator(creator); setShowEditDialog(true); }}
                                                                >
                                                                    <LucideEdit className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    onClick={() => { setCreatorToDelete(creator); setShowDeleteAlert(true); }}
                                                                >
                                                                    <LucideBan className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <Pagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            total={creatorsData.total}
                                            limit={20}
                                            onPageChange={setCurrentPage}
                                            onLimitChange={() => { }}
                                            itemLabel="creadores"
                                        />
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Create Dialog */}
            <CreatorFormDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSubmit={handleCreateCreator}
            />

            {/* Edit Dialog */}
            <CreatorFormDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                creator={selectedCreator || undefined}
                onSubmit={handleEditCreator}
            />

            {/* Details Dialog */}
            <CreatorDetailsDialog
                open={showDetailsDialog}
                onOpenChange={setShowDetailsDialog}
                creator={selectedCreator}
                onEdit={() => { setShowDetailsDialog(false); setShowEditDialog(true); }}
                onDelete={() => { setShowDetailsDialog(false); setCreatorToDelete(selectedCreator); setShowDeleteAlert(true); }}
                onToggleStatus={handleToggleStatus}
            />

            {/* Delete Alert */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <LucideBan className="h-5 w-5 text-destructive" />
                            Banear Creador
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Seguro que deseas banear a <strong>{creatorToDelete?.displayName}</strong>? El creador no podrá publicar modpacks.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteCreator}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Banear
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Alert */}
            <AlertDialog open={showRejectAlert} onOpenChange={setShowRejectAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Rechazar Creador</AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Rechazar la solicitud de <strong>{creatorToReject?.displayName}</strong>? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmReject}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {opLoading && <LucideLoader className="mr-2 h-4 w-4 animate-spin" />}
                            Rechazar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </motion.div>
    );
};
