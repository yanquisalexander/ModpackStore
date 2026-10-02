import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
import {
    LucideKeyRound,
    LucidePlus,
    LucideTrash2,
    LucideCopy,
    LucideCheck,
    LucideLoader2,
    LucideAlertTriangle,
    LucideServer,
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import {
    listCreatorApiTokens,
    createCreatorApiToken,
    revokeCreatorApiToken,
    listCreatorModpacksForTokens,
    type CreatorApiToken,
    type CreatedCreatorApiToken,
    type CreatorModpackOption,
} from '@/services/creatorApiTokens.service';
import { toast } from 'sonner';

const SERVER_SYNC_SCOPE = 'server:sync';

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export const PublisherApiTokensView: React.FC = () => {
    const { publisherId } = useParams<{ publisherId: string }>();
    const { sessionTokens } = useAuthentication();
    const accessToken = sessionTokens?.accessToken;

    const [tokens, setTokens] = useState<CreatorApiToken[]>([]);
    const [modpacks, setModpacks] = useState<CreatorModpackOption[]>([]);
    const [loading, setLoading] = useState(true);

    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [tokenName, setTokenName] = useState('');
    const [scopeAll, setScopeAll] = useState(true);
    const [selectedModpacks, setSelectedModpacks] = useState<string[]>([]);
    const [expiresAt, setExpiresAt] = useState('');

    const [createdToken, setCreatedToken] = useState<CreatedCreatorApiToken | null>(null);
    const [copied, setCopied] = useState(false);

    const [revokeOpen, setRevokeOpen] = useState(false);
    const [tokenToRevoke, setTokenToRevoke] = useState<CreatorApiToken | null>(null);
    const [revoking, setRevoking] = useState(false);

    const loadData = useCallback(async () => {
        if (!publisherId || !accessToken) return;
        try {
            setLoading(true);
            const [tokensData, modpacksData] = await Promise.all([
                listCreatorApiTokens(accessToken, publisherId),
                listCreatorModpacksForTokens(accessToken, publisherId).catch(() => [] as CreatorModpackOption[]),
            ]);
            setTokens(tokensData);
            setModpacks(modpacksData);
        } catch (error) {
            console.error('Error loading API tokens:', error);
            toast.error('Error al cargar los tokens');
        } finally {
            setLoading(false);
        }
    }, [publisherId, accessToken]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const resetCreateForm = () => {
        setTokenName('');
        setScopeAll(true);
        setSelectedModpacks([]);
        setExpiresAt('');
        setCreatedToken(null);
        setCopied(false);
    };

    const handleCreate = async () => {
        if (!publisherId || !accessToken || !tokenName.trim()) {
            toast.error('Ponle un nombre al token');
            return;
        }
        if (!scopeAll && selectedModpacks.length === 0) {
            toast.error('Selecciona al menos un modpack o marca "Todos"');
            return;
        }
        try {
            setCreating(true);
            const created = await createCreatorApiToken(accessToken, publisherId, {
                name: tokenName.trim(),
                scopes: [SERVER_SYNC_SCOPE],
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                modpackIds: scopeAll ? null : selectedModpacks,
            });
            setCreatedToken(created);
            await loadData();
        } catch (error) {
            console.error('Error creating token:', error);
            toast.error(error instanceof Error ? error.message : 'Error al crear el token');
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async () => {
        if (!createdToken) return;
        try {
            await navigator.clipboard.writeText(createdToken.token);
            setCopied(true);
            toast.success('Token copiado');
        } catch {
            toast.error('No se pudo copiar al portapapeles');
        }
    };

    const handleRevoke = async () => {
        if (!publisherId || !accessToken || !tokenToRevoke) return;
        try {
            setRevoking(true);
            await revokeCreatorApiToken(accessToken, publisherId, tokenToRevoke.id);
            toast.success('Token revocado');
            setRevokeOpen(false);
            setTokenToRevoke(null);
            await loadData();
        } catch (error) {
            console.error('Error revoking token:', error);
            toast.error(error instanceof Error ? error.message : 'Error al revocar el token');
        } finally {
            setRevoking(false);
        }
    };

    const toggleModpack = (id: string) => {
        setSelectedModpacks((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]);
    };

    const activeTokens = tokens.filter((t) => !t.revokedAt);

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <Card>
                <CardHeader className="border-b border-border pb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <LucideKeyRound className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle>API Tokens</CardTitle>
                                <CardDescription>
                                    Tokens a nombre del creator con scope <code>server:sync</code> para el server-agent y servidores headless.
                                </CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
                            <LucidePlus className="h-4 w-4 mr-2" />
                            Nuevo token
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : activeTokens.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <LucideServer className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>No hay tokens activos.</p>
                            <p className="text-sm mt-1">Crea uno para que tus servidores se actualicen solos con el server-agent.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeTokens.map((t) => (
                                <div key={t.id} className="flex items-center justify-between border rounded-lg p-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium truncate">{t.name}</span>
                                            <Badge variant="secondary">mps_{t.prefix}…</Badge>
                                            {t.scopes.map((s) => (
                                                <Badge key={s} variant="outline">{s}</Badge>
                                            ))}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Alcance: {t.modpackIds === null ? 'Todos los modpacks' : `${t.modpackIds.length} modpack(s)`}
                                            {' · '}Expira: {formatDate(t.expiresAt)}
                                            {' · '}Último uso: {formatDate(t.lastUsedAt)}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => { setTokenToRevoke(t); setRevokeOpen(true); }}
                                        title="Revocar"
                                    >
                                        <LucideTrash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {tokens.some((t) => t.revokedAt) && (
                        <div className="mt-6">
                            <h4 className="text-sm font-medium text-muted-foreground mb-2">Revocados</h4>
                            <div className="space-y-2">
                                {tokens.filter((t) => t.revokedAt).map((t) => (
                                    <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg p-3 opacity-70">
                                        <span className="font-medium">{t.name}</span>
                                        <Badge variant="outline">mps_{t.prefix}…</Badge>
                                        <span className="text-xs">revocado {formatDate(t.revokedAt)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nuevo API token</DialogTitle>
                        <DialogDescription>
                            El secreto se muestra <strong>una sola vez</strong>. Guárdalo como <code>MODPACK_TOKEN</code> en tu servidor.
                        </DialogDescription>
                    </DialogHeader>

                    {createdToken ? (
                        <div className="space-y-4">
                            <Alert>
                                <LucideAlertTriangle className="h-4 w-4" />
                                <AlertDescription>
                                    Cópialo ahora. No podrás verlo de nuevo.
                                </AlertDescription>
                            </Alert>
                            <div className="flex items-center gap-2">
                                <Input readOnly value={createdToken.token} className="font-mono text-xs" />
                                <Button size="icon" variant="outline" onClick={handleCopy}>
                                    {copied ? <LucideCheck className="h-4 w-4" /> : <LucideCopy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <DialogFooter>
                                <Button onClick={() => { setCreateOpen(false); resetCreateForm(); }}>
                                    Hecho
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="token-name">Nombre</Label>
                                <Input
                                    id="token-name"
                                    placeholder="Servidor EU - Hetzner 1"
                                    value={tokenName}
                                    onChange={(e) => setTokenName(e.target.value)}
                                    maxLength={64}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Alcance</Label>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="scope-all"
                                        checked={scopeAll}
                                        onCheckedChange={(v) => setScopeAll(v === true)}
                                    />
                                    <label htmlFor="scope-all" className="text-sm">Todos los modpacks del creator</label>
                                </div>
                                {!scopeAll && (
                                    <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                        {modpacks.length === 0 && (
                                            <p className="text-sm text-muted-foreground">No hay modpacks.</p>
                                        )}
                                        {modpacks.map((m) => (
                                            <div key={m.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`mp-${m.id}`}
                                                    checked={selectedModpacks.includes(m.id)}
                                                    onCheckedChange={() => toggleModpack(m.id)}
                                                />
                                                <label htmlFor={`mp-${m.id}`} className="text-sm truncate">{m.name}</label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="token-expires">Expira (opcional)</Label>
                                <Input
                                    id="token-expires"
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    min={new Date().toISOString().slice(0, 10)}
                                />
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleCreate} disabled={creating || !tokenName.trim()}>
                                    {creating && <LucideLoader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Crear token
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Revoke confirm */}
            <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Revocar token</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se revocará <strong>{tokenToRevoke?.name}</strong> inmediatamente.
                            Los servidores que lo usen dejarán de poder sincronizar.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRevoke} disabled={revoking}>
                            {revoking && <LucideLoader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Revocar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
