import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { API_ENDPOINT } from '@/consts';
import { useAuthentication } from '@/stores/AuthContext';
import { toast } from 'sonner';

import { Modpack } from '@/types/modpacks';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (created?: Modpack) => void;
    organizationId?: string;
}

const CreateModpackDialog: React.FC<Props> = ({ isOpen, onClose, onSuccess, organizationId }) => {
    const { sessionTokens } = useAuthentication();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [iconUrl, setIconUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [visibility, setVisibility] = useState<'public' | 'private' | 'patreon'>('public');
    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setName(''); setSlug(''); setShortDescription(''); setDescription(''); setIconUrl(''); setBannerUrl(''); setVisibility('public');
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!organizationId) {
            toast.error('Organization not selected');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                publisherId: organizationId,
                name,
                slug,
                iconUrl,
                bannerUrl,
                shortDescription: shortDescription || undefined,
                description: description || undefined,
                visibility,
            };

            const res = await fetch(`${API_ENDPOINT}/modpacks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokens?.accessToken}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                const message = err?.errors || err?.detail || `Error ${res.status}`;
                toast.error(String(message));
                setLoading(false);
                return;
            }

            const created = await res.json().catch(() => null);
            toast.success('Modpack creado');
            resetForm();
            onClose();
            onSuccess && onSuccess(created);
        } catch (error) {
            console.error('Create modpack error', error);
            toast.error('Error creando modpack');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-white">
                <DialogHeader>
                    <DialogTitle>Crear nuevo modpack</DialogTitle>
                    <DialogDescription className="text-zinc-400">Crea un modpack para la organización seleccionada.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-3 p-2">
                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Nombre</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Slug (minúsculas y guiones)</label>
                        <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Icon URL</label>
                        <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Banner URL</label>
                        <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Visibilidad</label>
                        <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                            <option value="public">Publico</option>
                            <option value="private">Privado</option>
                            <option value="patreon">Patreon</option>
                        </Select>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Descripción corta</label>
                        <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-sm text-zinc-300 block mb-1">Descripción</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>

                    <DialogFooter>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                            <Button type="submit" className="bg-emerald-600" disabled={loading}>{loading ? 'Creando...' : 'Crear modpack'}</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateModpackDialog;
