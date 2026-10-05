import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  twitchDisplayName?: string | null;
  twitchAvatarUrl?: string | null;
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
        const json = await response.json();
        const raw = json?.data ?? json;
        setTwitchStatus({
          linked: !!raw?.linked,
          twitchId: raw?.twitchId,
          twitchUsername: raw?.twitchUsername ?? raw?.twitchDisplayName ?? undefined,
          twitchDisplayName: raw?.twitchDisplayName ?? raw?.twitchUsername ?? null,
          twitchAvatarUrl: raw?.twitchAvatarUrl ?? null,
        });
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
      <Card>
        <CardContent className="p-6 h-[190px] flex items-center justify-center">
          <LucideLoader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const displayName = twitchStatus.twitchUsername ?? twitchStatus.twitchDisplayName;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-[#9146FF]/10 text-[#9146FF] shrink-0">
            <MdiTwitch className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground">Twitch</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", twitchStatus.linked ? "bg-green-500" : "bg-muted-foreground/40")} />
              <span className="text-xs text-muted-foreground">
                {twitchStatus.linked ? "Conectado" : "No conectado"}
              </span>
            </div>
          </div>
          {twitchStatus.linked && displayName && (
            <Badge variant="secondary" className="font-mono font-normal shrink-0 max-w-[140px] truncate">
              {displayName}
            </Badge>
          )}
        </div>

        <Separator />

        <AnimatePresence mode="wait">
          {twitchStatus.linked ? (
            <motion.div
              key="linked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tienes acceso a los modpacks exclusivos para suscriptores y contenido anticipado.
              </p>
              <Button
                onClick={handleUnlinkTwitch}
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
              key="unlinked"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LucideCheck className="w-3 h-3 text-[#9146FF] shrink-0" /> Acceso a modpacks de suscriptores
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LucideCheck className="w-3 h-3 text-[#9146FF] shrink-0" /> Insignia de Supporter
                </div>
              </div>

              <Button
                onClick={handleLinkTwitch}
                disabled={loading}
                className="w-full bg-[#9146FF] hover:bg-[#9146FF]/90 text-white"
              >
                {loading ? <LucideLoader2 className="w-4 h-4 mr-2 animate-spin" /> : <LucideExternalLink className="w-4 h-4 mr-2" />}
                Conectar Twitch
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};