import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { LucideExternalLink, LucideUnlink, LucideLoader2, LucideCheck } from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { listen } from "@tauri-apps/api/event";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface TwitchStatus {
  linked: boolean;
  twitchId?: string;
  twitchUsername?: string;
}

export const TwitchLinkingComponent = () => {
  const [twitchStatus, setTwitchStatus] = useState<TwitchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const { sessionTokens } = useAuthentication();

  // --- LOGIC (Mantenida intacta) ---
  const fetchTwitchStatus = async () => {
    try {
      const token = sessionTokens?.accessToken;
      if (!token) {
        setTwitchStatus({ linked: false });
        return;
      }
      const response = await fetch(`${API_ENDPOINT}/auth/twitch/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const status = await response.json();
        setTwitchStatus(status);
      } else {
        setTwitchStatus({ linked: false });
      }
    } catch (error) {
      console.error('Error fetching Twitch status:', error);
      setTwitchStatus({ linked: false });
    }
  };

  const handleLinkTwitch = async () => {
    setLoading(true);
    try {
      await invoke('start_twitch_auth');
      toast.info('Autorización iniciada. Revisa tu navegador.');
    } catch (error) {
      toast.error('Error al iniciar autorización');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkTwitch = async () => {
    setUnlinking(true);
    try {
      const token = sessionTokens?.accessToken;
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${API_ENDPOINT}/auth/twitch/unlink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        setTwitchStatus({ linked: false });
        toast.success('Cuenta de Twitch desvinculada');
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
    fetchTwitchStatus();
    const unlistenPromise = listen('twitch-auth-success', () => {
      toast.success('Cuenta de Twitch vinculada exitosamente');
      fetchTwitchStatus();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(console.error);
    };
  }, [sessionTokens]);

  // --- RENDER ---

  if (!twitchStatus) {
    return (
      <div className="bg-[#151515] border border-white/5 rounded-xl p-6 h-[200px] flex items-center justify-center animate-pulse">
        <LucideLoader2 className="w-8 h-8 text-[#9146FF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative group overflow-hidden bg-[#151515] border border-[#9146FF]/20 rounded-xl p-6 transition-all hover:border-[#9146FF]/40">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[#9146FF]/5 group-hover:bg-[#9146FF]/10 transition-colors pointer-events-none" />

      <div className="relative flex flex-col h-full justify-between gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#9146FF]/20 rounded-xl text-[#9146FF] ring-1 ring-[#9146FF]/30">
              <MdiTwitch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Twitch</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_8px]", twitchStatus.linked ? "bg-green-500 shadow-green-500/50" : "bg-neutral-500")} />
                <span className={cn("text-xs font-medium", twitchStatus.linked ? "text-green-400" : "text-neutral-400")}>
                  {twitchStatus.linked ? `Conectado` : "No conectado"}
                </span>
              </div>
            </div>
          </div>
          {twitchStatus.linked && (
            <div className="hidden sm:block text-xs font-mono text-[#9146FF] bg-[#9146FF]/10 px-2 py-1 rounded border border-[#9146FF]/20">
              {twitchStatus.twitchUsername}
            </div>
          )}
        </div>

        {/* Content Area with Animation */}
        <AnimatePresence mode="wait">
          {twitchStatus.linked ? (
            <motion.div
              key="linked"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2"
            >
              <p className="text-neutral-400 text-sm mb-4 leading-relaxed">
                Tienes acceso a los modpacks exclusivos para suscriptores y contenido anticipado.
              </p>
              <Button
                onClick={handleUnlinkTwitch}
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
              key="unlinked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs text-neutral-300">
                  <LucideCheck className="w-3 h-3 text-[#9146FF]" /> Acceso a modpacks de suscriptores
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-300">
                  <LucideCheck className="w-3 h-3 text-[#9146FF]" /> Insignia de Supporter
                </div>
              </div>

              <Button
                onClick={handleLinkTwitch}
                disabled={loading}
                className="w-full bg-[#9146FF] hover:bg-[#772ce8] text-white font-medium transition-all shadow-[0_0_20px_rgba(145,70,255,0.15)] hover:shadow-[0_0_25px_rgba(145,70,255,0.3)]"
              >
                {loading ? <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" /> : <LucideExternalLink className="w-4 h-4 mr-2" />}
                Conectar Twitch
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};