import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    LucideUsers,
    LucideRefreshCw,
    LucideSettings,
    LucideDollarSign,
    LucideCalendar,
    LucideLoader,
    LucideShield,
    LucideEdit
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthentication } from '@/stores/AuthContext';
import {
    PatreonPlusService,
    PatreonTierData,
    PatreonMemberData,
    PatreonStatistics
} from '@/services/patreonPlus';
import { AVAILABLE_BENEFITS, BenefitDefinition } from '@/types/userFlags';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MetadataFormData {
    [key: string]: boolean | number | string;
}

export const PatreonPlusManagementView: React.FC = () => {
    const { sessionTokens } = useAuthentication();
    const [tiers, setTiers] = useState<PatreonTierData[]>([]);
    const [statistics, setStatistics] = useState<PatreonStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Dialog states
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [membersDialogOpen, setMembersDialogOpen] = useState(false);

    // Form states
    const [editingTier, setEditingTier] = useState<PatreonTierData | null>(null);
    const [metadataForm, setMetadataForm] = useState<MetadataFormData>({});
    const [tierMembers, setTierMembers] = useState<PatreonMemberData[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [newFieldName, setNewFieldName] = useState('');

    // Load tiers and statistics
    const loadData = async () => {
        if (!sessionTokens?.accessToken) return;

        try {
            setLoading(true);
            const [tiersData, statsData] = await Promise.all([
                PatreonPlusService.getTiers(sessionTokens.accessToken),
                PatreonPlusService.getStatistics(sessionTokens.accessToken)
            ]);
            setTiers(tiersData);
            setStatistics(statsData);
        } catch (error) {
            console.error('Error loading Patreon data:', error);
            toast.error('Error al cargar los datos de Patreon');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [sessionTokens?.accessToken]);

    // Handle manual sync
    const handleSync = async () => {
        if (!sessionTokens?.accessToken) return;

        try {
            setSyncing(true);
            const result = await PatreonPlusService.triggerSync(sessionTokens.accessToken);
            toast.success('Sincronización completada', {
                description: `Tiers: ${result.tiers.tiersAdded} añadidos, ${result.tiers.tiersUpdated} actualizados, ${result.tiers.tiersDeactivated} desactivados. Miembros: ${result.members.membersUpdated} actualizados, ${result.members.membersCleared} limpiados.`
            });
            await loadData();
        } catch (error) {
            console.error('Error during sync:', error);
            toast.error('Error al sincronizar con Patreon');
        } finally {
            setSyncing(false);
        }
    };

    // Open edit dialog
    const openEditDialog = (tier: PatreonTierData) => {
        setEditingTier(tier);
        setMetadataForm(tier.metadata || {});
        setNewFieldName('');
        setEditDialogOpen(true);
    };

    // Handle metadata change
    const handleMetadataChange = (key: string, value: boolean | number | string) => {
        setMetadataForm(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Add new metadata field from definition
    const addMetadataFieldFromDef = (benefitId: string) => {
        const def = AVAILABLE_BENEFITS.find(b => b.id === benefitId);
        if (!def) return;

        setMetadataForm(prev => ({
            ...prev,
            [def.id]: def.defaultValue
        }));
        setNewFieldName('');
    };

    // Remove metadata field
    const removeMetadataField = (key: string) => {
        setMetadataForm(prev => {
            const newForm = { ...prev };
            delete newForm[key];
            return newForm;
        });
    };

    // Save metadata
    const saveMetadata = async () => {
        if (!sessionTokens?.accessToken || !editingTier) return;

        try {
            await PatreonPlusService.updateTierMetadata(
                sessionTokens.accessToken,
                editingTier.id,
                metadataForm
            );
            toast.success('Beneficios actualizados correctamente');
            setEditDialogOpen(false);
            await loadData();
        } catch (error: any) {
            console.error('Error updating metadata:', error);
            toast.error('Error al actualizar los beneficios', {
                description: error.message || 'Error desconocido'
            });
        }
    };

    // View tier members
    const viewTierMembers = async (tier: PatreonTierData) => {
        if (!sessionTokens?.accessToken) return;

        try {
            setLoadingMembers(true);
            setMembersDialogOpen(true);
            setEditingTier(tier);
            const members = await PatreonPlusService.getTierMembers(sessionTokens.accessToken, tier.id);
            setTierMembers(members);
        } catch (error) {
            console.error('Error loading members:', error);
            toast.error('Error al cargar los miembros');
        } finally {
            setLoadingMembers(false);
        }
    };

    // Format currency
    const formatCurrency = (cents: number) => {
        return `$${(cents / 100).toFixed(2)}`;
    };

    // Format date
    const formatDate = (date: Date | null) => {
        if (!date) return 'Nunca';
        return new Date(date).toLocaleString('es-ES');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <LucideLoader className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Cargando datos de Patreon...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Statistics */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <LucideShield className="h-5 w-5" />
                                ModpackStore +
                            </CardTitle>
                            <CardDescription>
                                Configura beneficios por tier y sincroniza con Patreon
                            </CardDescription>
                        </div>
                        <Button onClick={handleSync} disabled={syncing}>
                            {syncing ? (
                                <LucideLoader className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <LucideRefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Sincronizar
                        </Button>
                    </div>
                </CardHeader>
                {statistics && (
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <LucideShield className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Tiers Activos</p>
                                    <p className="text-2xl font-bold">{statistics.totalTiers}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <LucideUsers className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Miembros Activos</p>
                                    <p className="text-2xl font-bold">{statistics.totalMembers}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <LucideDollarSign className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Ingresos Mensuales</p>
                                    <p className="text-2xl font-bold">${statistics.totalRevenueUSD}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-lg">
                                    <LucideCalendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Última Sync</p>
                                    <p className="text-sm font-medium">
                                        {formatDate(statistics.lastSync)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Tiers Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Tiers de Patreon</CardTitle>
                    <CardDescription>
                        Lista de todos los tiers con sus beneficios configurados
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Miembros</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Última Sync</TableHead>
                                <TableHead>Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {tiers.map((tier) => (
                                <TableRow key={tier.id}>
                                    <TableCell>
                                        <div>
                                            <p className="font-medium">{tier.name}</p>
                                            {tier.description && (
                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                    {tier.description}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono">
                                            {formatCurrency(tier.amountCents)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => viewTierMembers(tier)}
                                        >
                                            <LucideUsers className="h-4 w-4 mr-1" />
                                            {tier.memberCount}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={tier.active ? 'default' : 'secondary'}>
                                            {tier.active ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(tier.lastSyncAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openEditDialog(tier)}
                                        >
                                            <LucideEdit className="h-4 w-4 mr-1" />
                                            Beneficios
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Edit Metadata Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Configurar Beneficios</DialogTitle>
                        <DialogDescription>
                            {editingTier && `${editingTier.name} - ${formatCurrency(editingTier.amountCents)}/mes`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {Object.entries(metadataForm).map(([key, value]) => {
                            const benefitDef = AVAILABLE_BENEFITS.find(b => b.id === key);
                            return (
                                <div key={key} className="flex items-center gap-3 p-3 border rounded-lg bg-card/50">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`meta-${key}`} className="font-bold">
                                                {benefitDef?.name || key}
                                            </Label>
                                            <code className="text-[10px] bg-muted px-1 rounded font-mono text-muted-foreground">
                                                {key}
                                            </code>
                                        </div>
                                        {benefitDef && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {benefitDef.description}
                                            </p>
                                        )}
                                        <div className="mt-2">
                                            {typeof value === 'boolean' ? (
                                                <Switch
                                                    id={`meta-${key}`}
                                                    checked={value}
                                                    onCheckedChange={(checked) => handleMetadataChange(key, checked)}
                                                />
                                            ) : typeof value === 'number' ? (
                                                <Input
                                                    id={`meta-${key}`}
                                                    type="number"
                                                    value={value}
                                                    onChange={(e) => handleMetadataChange(key, Number(e.target.value))}
                                                />
                                            ) : (
                                                <Input
                                                    id={`meta-${key}`}
                                                    type="text"
                                                    value={value}
                                                    onChange={(e) => handleMetadataChange(key, e.target.value)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => removeMetadataField(key)}
                                    >
                                        Eliminar
                                    </Button>
                                </div>
                            );
                        })}

                        <Separator />

                        {/* Add New Field */}
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-dashed">
                            <Label className="text-sm font-semibold">Añadir Nuevo Beneficio</Label>

                            {/* Filter benefits that are not already in the form */}
                            {AVAILABLE_BENEFITS.filter(b => !(b.id in metadataForm)).length > 0 ? (
                                <div className="flex gap-2">
                                    <Select
                                        value={newFieldName}
                                        onValueChange={setNewFieldName}
                                    >
                                        <SelectTrigger className="flex-1 bg-background">
                                            <SelectValue placeholder="Seleccionar beneficio..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {AVAILABLE_BENEFITS
                                                .filter(b => !(b.id in metadataForm))
                                                .map(benefit => (
                                                    <SelectItem key={benefit.id} value={benefit.id}>
                                                        <div className="flex flex-col text-left">
                                                            <span className="font-medium text-sm">{benefit.name}</span>
                                                            <span className="text-[10px] text-muted-foreground">{benefit.id}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            }
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="default"
                                        disabled={!newFieldName}
                                        onClick={() => addMetadataFieldFromDef(newFieldName)}
                                    >
                                        Añadir
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic text-center py-2">
                                    Todos los beneficios disponibles ya están configurados.
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={saveMetadata}>
                            Guardar Cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Members Dialog */}
            <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Miembros del Tier</DialogTitle>
                        <DialogDescription>
                            {editingTier && `${editingTier.name} - ${tierMembers.length} miembros`}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingMembers ? (
                        <div className="flex items-center justify-center py-8">
                            <LucideLoader className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tierMembers.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {member.avatarUrl && (
                                                    <img
                                                        src={member.avatarUrl}
                                                        alt={member.username}
                                                        className="h-8 w-8 rounded-full"
                                                    />
                                                )}
                                                <span className="font-medium">{member.username}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{member.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="default">{member.patreonStatus}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {member.patreonEntitledAmount && formatCurrency(member.patreonEntitledAmount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setMembersDialogOpen(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
