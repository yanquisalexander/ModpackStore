import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { LucideExternalLink, LucideUnlink, LucideLoader2, Crown, Star, Check, ShieldCheck } from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { listen } from "@tauri-apps/api/event";
import PatreonIcon from "@/icons/PatreonIcon";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface PatreonStatus {
  isPatron: boolean;
  tier: string;
  isActive: boolean;
  entitledAmount: number;
  tierDescription: string;
  canUploadCoverImage: boolean;
}

interface PatreonConnectionStatus {
  connected: boolean;
  patreonStatus?: PatreonStatus;
}

export const PatreonLinkingComponent = () => {
  const [patreonStatus, setPatreonStatus] = useState<PatreonConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const { sessionTokens } = useAuthentication();

  // --- LOGIC (Mantenida intacta) ---
  const fetchPatreonStatus = async () => {
    try {
      const token = sessionTokens?.accessToken;
      if (!token) {
        setPatreonStatus({ connected: false });
        return;
      }
      const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const status = await response.json();
        setPatreonStatus({
          connected: status.data.isConnected,
          patreonStatus: status.data
        });
      } else {
        setPatreonStatus({ connected: false });
      }
    } catch (error) {
      console.error('Error fetching Patreon status:', error);
      setPatreonStatus({ connected: false });
    }
  };

  const handleLinkPatreon = async () => {
    setLoading(true);
    try {
      await invoke('start_patreon_auth');
      toast.info('Autorización iniciada. Revisa tu navegador.');
    } catch (error) {
      toast.error('Error al iniciar autorización');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkPatreon = async () => {
    setUnlinking(true);
    try {
      const token = sessionTokens?.accessToken;
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${API_ENDPOINT}/social/profile/patreon/unlink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        setPatreonStatus({ connected: false });
        toast.success('Cuenta de Patreon desvinculada');
        fetchPatreonStatus();
      } else {
        toast.error('No se pudo desvincular la cuenta');
      }
    } catch (error) {
      toast.error('Error al desvincular');
    } finally {
      setUnlinking(false);
    }
  };

  useEffect(() => {
    fetchPatreonStatus();
    const unlistenPromise = listen('patreon-auth-success', () => {
      toast.success('Cuenta de Patreon vinculada exitosamente');
      fetchPatreonStatus();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [sessionTokens]);

  // --- RENDER HELPERS ---

  const getTierConfig = (tier: string) => {
    if (tier === 'free' || !tier) return { color: 'text-neutral-400', bg: 'bg-neutral-500/10', icon: Star, label: 'Seguidor' };
    return { color: 'text-[#FF424D]', bg: 'bg-[#FF424D]/10', icon: Crown, label: tier.toUpperCase() };
  };

  if (!patreonStatus) {
    return (
      <Card>
        <CardContent className="p-6 h-[190px] flex items-center justify-center">
          <LucideLoader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const tierInfo = getTierConfig(patreonStatus.patreonStatus?.tier || 'free');
  const TierIcon = tierInfo.icon;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[#FF424D]/10 text-[#FF424D] shrink-0">
            <PatreonIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground">Patreon</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", patreonStatus.connected ? "bg-green-500" : "bg-muted-foreground/40")} />
              <span className="text-xs text-muted-foreground">
                {patreonStatus.connected
                  ? (patreonStatus.patreonStatus?.isActive ? 'Membresía activa' : 'Conectado')
                  : 'No conectado'}
              </span>
            </div>
          </div>

          {patreonStatus.connected && (
            <Badge variant="secondary" className={cn("shrink-0 gap-1", tierInfo.bg)}>
              <TierIcon className={cn("w-3 h-3", tierInfo.color)} />
              <span className={cn("text-[11px] font-medium", tierInfo.color)}>{tierInfo.label}</span>
            </Badge>
          )}
        </div>

        <Separator />

        <AnimatePresence mode="wait">
          {patreonStatus.connected && patreonStatus.patreonStatus ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="bg-muted/50 rounded-md p-3 border border-border">
                {patreonStatus.patreonStatus.tierDescription ? (
                  <div
                    className="prose prose-invert text-xs text-muted-foreground leading-relaxed [&>ul]:list-disc [&>ul]:pl-4 [&>p]:mb-1 last:[&>p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: patreonStatus.patreonStatus.tierDescription }}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground flex flex-col gap-1.5">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-[#FF424D] shrink-0" /> Soporte prioritario</div>
                    <div className="flex items-center gap-2"><Star className="w-3 h-3 text-[#FF424D] shrink-0" /> Imágenes de portada personalizadas</div>
                    <div className="flex items-center gap-2"><Crown className="w-3 h-3 text-[#FF424D] shrink-0" /> Acceso a betas</div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUnlinkPatreon}
                disabled={unlinking}
                variant="ghost"
                size="sm"
                className="px-0 h-auto font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {unlinking ? <LucideLoader2 className="w-3 h-3 animate-spin mr-2" /> : <LucideUnlink className="w-3 h-3 mr-2" />}
                Desvincular cuenta
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="disconnected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Únete a nuestro Patreon para desbloquear insignias, soporte prioritario y personalización avanzada de perfil.
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-[#FF424D]" /> Portadas Custom
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3 h-3 text-[#FF424D]" /> Soporte VIP
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLinkPatreon}
                disabled={loading}
                className="w-full bg-[#FF424D] hover:bg-[#FF424D]/90 text-white"
              >
                {loading ? <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" /> : <LucideExternalLink className="w-4 h-4 mr-2" />}
                Conectar Patreon
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};