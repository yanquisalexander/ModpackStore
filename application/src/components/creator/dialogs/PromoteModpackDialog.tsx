import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    LucideSparkles,
    LucideLoader,
    LucideDollarSign,
    LucideClock,
    LucideTrendingUp,
    LucideEye,
    LucideCalendar,
    LucideGlobe,
    LucidePackage,
    LucideExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/consts';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

export interface PromoteDialogModpack {
    id: string;
    name: string;
    shortDescription?: string;
    bannerUrl?: string;
    iconUrl?: string;
}

interface PromoteModpackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    modpack?: PromoteDialogModpack | null;
    availableModpacks?: PromoteDialogModpack[];
    orgId: string;
    onSuccess?: () => void;
}

// Pricing tiers and reach estimates
const PRICING_CONFIG = {
    hero_carousel: {
        label: 'Hero Carousel (Carrusel Principal)',
        tiers: {
            7: { priceUSD: 15, reach: '8,000 - 20,000 visualizaciones' },
            14: { priceUSD: 28, reach: '16,000 - 40,000 visualizaciones' },
            30: { priceUSD: 50, reach: '35,000 - 80,000 visualizaciones' },
        },
    },
    explore_banner: {
        label: 'Banner en Catálogo (Explore)',
        tiers: {
            7: { priceUSD: 10, reach: '5,000 - 12,000 visualizaciones' },
            14: { priceUSD: 18, reach: '10,000 - 25,000 visualizaciones' },
            30: { priceUSD: 35, reach: '22,000 - 50,000 visualizaciones' },
        },
    },
};

export const PromoteModpackDialog: React.FC<PromoteModpackDialogProps> = ({
    open,
    onOpenChange,
    modpack,
    availableModpacks = [],
    orgId,
    onSuccess,
}) => {
    const [campaignTarget, setCampaignTarget] = useState<'modpack' | 'external'>(modpack ? 'modpack' : 'external');
    const [selectedModpackId, setSelectedModpackId] = useState<string>(modpack?.id || availableModpacks[0]?.id || '');
    const [submitting, setSubmitting] = useState(false);
    const [placement, setPlacement] = useState<'hero_carousel' | 'explore_banner'>('hero_carousel');
    const [durationDays, setDurationDays] = useState<number>(7);
    const [title, setTitle] = useState(modpack?.name || '');
    const [subtitle, setSubtitle] = useState(modpack?.shortDescription || '');
    const [mediaUrl, setMediaUrl] = useState(modpack?.bannerUrl || modpack?.iconUrl || '');
    const [targetUrl, setTargetUrl] = useState('');
    const [badgeText, setBadgeText] = useState('Destacado');
    const [ctaText, setCtaText] = useState('Ver modpack');
    const [paymentNotes, setPaymentNotes] = useState('');

    React.useEffect(() => {
        if (campaignTarget === 'modpack') {
            const current = modpack || availableModpacks.find((m) => m.id === selectedModpackId);
            if (current) {
                setTitle(current.name);
                setSubtitle(current.shortDescription || '');
                setMediaUrl(current.bannerUrl || current.iconUrl || '');
                setCtaText('Ver modpack');
                setBadgeText('Destacado');
            }
        } else {
            setCtaText('Unirse / Ver más');
            setBadgeText('Patrocinado');
        }
    }, [campaignTarget, modpack, selectedModpackId, availableModpacks]);

    // Pricing and end date estimation
    const currentEstimate = useMemo(() => {
        const config = PRICING_CONFIG[placement];
        const tier = config.tiers[durationDays as 7 | 14 | 30] || config.tiers[7];

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + durationDays);

        return {
            priceUSD: tier.priceUSD,
            reach: tier.reach,
            startDateFormatted: startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
            endDateFormatted: endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
            endDate,
        };
    }, [placement, durationDays]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !mediaUrl.trim()) {
            toast.error('Por favor completa el título y la URL del banner');
            return;
        }

        if (campaignTarget === 'external' && !targetUrl.trim()) {
            toast.error('Por favor introduce la URL de destino (Discord, Servidor o Web)');
            return;
        }

        try {
            setSubmitting(true);
            const targetModpack = campaignTarget === 'modpack' ? (modpack || availableModpacks.find((m) => m.id === selectedModpackId)) : null;

            const res = await fetchWithAuth(`${API_ENDPOINT}/creators/${orgId}/ads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: campaignTarget === 'modpack' && targetModpack
                        ? `Promoción de ${targetModpack.name}`
                        : `Campaña: ${title}`,
                    type: campaignTarget === 'modpack' ? 'creator_modpack' : 'creator_profile',
                    placement,
                    title,
                    subtitle: subtitle || null,
                    badgeText: badgeText || (campaignTarget === 'modpack' ? 'Destacado' : 'Patrocinado'),
                    ctaText: ctaText || 'Ver más',
                    mediaUrl,
                    targetModpackId: campaignTarget === 'modpack' && targetModpack ? targetModpack.id : null,
                    targetUrl: campaignTarget === 'external' ? targetUrl : null,
                    startAt: new Date().toISOString(),
                    endAt: currentEstimate.endDate.toISOString(),
                    paymentMethod: 'paypal',
                    paymentNotes: paymentNotes
                        ? `Plan ${durationDays} días ($${currentEstimate.priceUSD} USD) - PayPal: ${paymentNotes}`
                        : `Plan ${durationDays} días ($${currentEstimate.priceUSD} USD) - Pago pendiente vía PayPal`,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Error enviando solicitud');
            }

            toast.success('¡Solicitud de campaña enviada! El equipo de administración la revisará en breve.');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            toast.error(err.message || 'Error al enviar la solicitud');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <LucideSparkles className="w-5 h-5 text-amber-400" />
                        Crear Campaña de Patrocinio
                    </DialogTitle>
                    <DialogDescription>
                        Llega a miles de jugadores promocionando tu modpack, comunidad de Discord o servidor.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Campaign Target Selector */}
                    <div className="space-y-1.5">
                        <Label>Objetivo del Patrocinio</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setCampaignTarget('modpack')}
                                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition-all ${
                                    campaignTarget === 'modpack'
                                        ? 'border-primary bg-primary/10 text-foreground font-medium'
                                        : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                                }`}
                            >
                                <LucidePackage className={`w-4 h-4 shrink-0 ${campaignTarget === 'modpack' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div>
                                    <div className="font-semibold text-foreground">Modpack</div>
                                    <div className="text-[11px] text-muted-foreground">Ficha en la tienda</div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCampaignTarget('external')}
                                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition-all ${
                                    campaignTarget === 'external'
                                        ? 'border-primary bg-primary/10 text-foreground font-medium'
                                        : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                                }`}
                            >
                                <LucideGlobe className={`w-4 h-4 shrink-0 ${campaignTarget === 'external' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div>
                                    <div className="font-semibold text-foreground">Campaña General</div>
                                    <div className="text-[11px] text-muted-foreground">Discord, Servidor o Web</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Modpack selector if in modpack mode and opened without specific modpack */}
                    {campaignTarget === 'modpack' && !modpack && availableModpacks.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Selecciona el Modpack a Promocionar</Label>
                            <Select value={selectedModpackId} onValueChange={setSelectedModpackId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Elige un modpack..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableModpacks.map((m) => (
                                        <SelectItem key={m.id} value={m.id}>
                                            {m.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* External link destination */}
                    {campaignTarget === 'external' && (
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-1.5">
                                <LucideExternalLink className="w-3.5 h-3.5 text-primary" /> Enlace de Destino (URL)
                            </Label>
                            <Input
                                type="url"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                placeholder="https://discord.gg/... o https://tu-comunidad.com"
                                required={campaignTarget === 'external'}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Los jugadores abrirán este enlace directamente al pulsar el botón del anuncio.
                            </p>
                        </div>
                    )}

                    {/* Placement & Duration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Ubicación (Placement)</Label>
                            <Select
                                value={placement}
                                onValueChange={(val: 'hero_carousel' | 'explore_banner') => setPlacement(val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hero_carousel">Hero Carousel (Portada)</SelectItem>
                                    <SelectItem value="explore_banner">Banner entre Categorías</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Duración de Campaña</Label>
                            <Select
                                value={String(durationDays)}
                                onValueChange={(val) => setDurationDays(Number(val))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">7 días (1 semana)</SelectItem>
                                    <SelectItem value="14">14 días (2 semanas)</SelectItem>
                                    <SelectItem value="30">30 días (1 mes)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Estimates & Monetization Card */}
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <LucideDollarSign className="w-4 h-4" /> Presupuesto Estimado
                            </span>
                            <span className="text-xl font-bold text-foreground">
                                ${currentEstimate.priceUSD}.00 <span className="text-xs font-normal text-muted-foreground">USD</span>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                            <div className="flex items-center gap-1.5">
                                <LucideEye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span>{currentEstimate.reach}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <LucideCalendar className="w-3.5 h-3.5 shrink-0" />
                                <span>{currentEstimate.startDateFormatted} - {currentEstimate.endDateFormatted}</span>
                            </div>
                        </div>
                    </div>

                    {/* Creative Fields */}
                    <div className="space-y-1.5">
                        <Label>Título del Anuncio</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Servidor Oficial o Nombre del Modpack"
                            required
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Texto Promocional (Subtítulo)</Label>
                        <Input
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            placeholder="Frase llamativa para atraer jugadores"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>URL del Banner o Imagen</Label>
                        <Input
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            placeholder="https://... (JPG/PNG)"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label>Insignia</Label>
                            <Input
                                value={badgeText}
                                onChange={(e) => setBadgeText(e.target.value)}
                                placeholder="Destacado"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>Texto del Botón (CTA)</Label>
                            <Input
                                value={ctaText}
                                onChange={(e) => setCtaText(e.target.value)}
                                placeholder={campaignTarget === 'modpack' ? 'Ver modpack' : 'Unirse ahora'}
                            />
                        </div>
                    </div>

                    {/* Payment / PayPal Coordination */}
                    <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                                <LucideDollarSign className="w-3.5 h-3.5 text-amber-400" /> Cobro y Verificación vía PayPal
                            </span>
                            <span className="text-[11px] text-muted-foreground">Aprobación previa</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Una vez enviada la solicitud, el administrador revisará la creatividad y confirmará el pago por PayPal antes de activar la campaña.
                        </p>
                        <Input
                            className="text-xs h-8 bg-background"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="Tu correo de PayPal o ID de transacción (opcional)..."
                        />
                    </div>

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {submitting ? <LucideLoader className="w-4 h-4 animate-spin mr-2" /> : <LucideSparkles className="w-4 h-4 mr-2" />}
                            Solicitar Campaña (${currentEstimate.priceUSD} USD)
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
