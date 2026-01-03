import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
      <div className="bg-[#151515] border border-white/5 rounded-xl p-6 h-[200px] flex items-center justify-center animate-pulse">
        <LucideLoader2 className="w-8 h-8 text-[#FF424D] animate-spin" />
      </div>
    );
  }

  const tierInfo = getTierConfig(patreonStatus.patreonStatus?.tier || 'free');
  const TierIcon = tierInfo.icon;

  return (
    <div className="relative group overflow-hidden bg-[#151515] border border-[#FF424D]/20 rounded-xl p-6 transition-all hover:border-[#FF424D]/40">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[#FF424D]/5 group-hover:bg-[#FF424D]/10 transition-colors pointer-events-none" />

      <div className="relative flex flex-col h-full justify-between gap-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#FF424D]/20 rounded-xl text-[#FF424D] ring-1 ring-[#FF424D]/30">
              <PatreonIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Patreon</h3>
              <div className="flex items-center gap-2 mt-1">
                {patreonStatus.connected ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-xs text-green-400 font-medium">
                      {patreonStatus.patreonStatus?.isActive ? 'Membresía Activa' : 'Conectado'}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                    <span className="text-xs text-neutral-400 font-medium">No conectado</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tier Badge (Only if connected) */}
          {patreonStatus.connected && (
            <div className={cn("hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg border border-white/5", tierInfo.bg)}>
              <TierIcon className={cn("w-3.5 h-3.5", tierInfo.color)} />
              <span className={cn("text-xs font-bold tracking-wide", tierInfo.color)}>{tierInfo.label}</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {patreonStatus.connected && patreonStatus.patreonStatus ? (
            <motion.div
              key="connected"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2"
            >
              {/* Description Box */}
              <div className="bg-black/20 rounded-lg p-3 mb-4 border border-white/5">
                {patreonStatus.patreonStatus.tierDescription ? (
                  <div
                    className="prose prose-invert text-xs text-neutral-300 leading-relaxed [&>ul]:list-disc [&>ul]:pl-4 [&>p]:mb-1 last:[&>p]:mb-0"
                    dangerouslySetInnerHTML={{ __html: patreonStatus.patreonStatus.tierDescription }}
                  />
                ) : (
                  <div className="text-xs text-neutral-400 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-[#FF424D]" /> Soporte prioritario</div>
                    <div className="flex items-center gap-2"><Star className="w-3 h-3 text-[#FF424D]" /> Imágenes de portada personalizadas</div>
                    <div className="flex items-center gap-2"><Crown className="w-3 h-3 text-[#FF424D]" /> Acceso a betas</div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUnlinkPatreon}
                disabled={unlinking}
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-0 h-auto font-normal"
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
              className="space-y-4"
            >
              <div className="space-y-2 pt-2">
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Únete a nuestro Patreon para desbloquear insignias, soporte prioritario y personalización avanzada de perfil.
                </p>
                <div className="flex gap-4 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                    <Check className="w-3 h-3 text-[#FF424D]" /> Portadas Custom
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                    <Check className="w-3 h-3 text-[#FF424D]" /> Soporte VIP
                  </div>
                </div>
              </div>

              <Button
                onClick={handleLinkPatreon}
                disabled={loading}
                className="w-full bg-[#FF424D] hover:bg-[#D9353F] text-white font-medium transition-all shadow-[0_0_20px_rgba(255,66,77,0.15)] hover:shadow-[0_0_25px_rgba(255,66,77,0.3)]"
              >
                {loading ? <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" /> : <LucideExternalLink className="w-4 h-4 mr-2" />}
                Conectar Patreon
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};