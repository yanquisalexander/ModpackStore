import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { LucideExternalLink, LucideUnlink } from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { API_ENDPOINT } from "@/consts";
import { listen } from "@tauri-apps/api/event";
import { MdiTwitch } from "@/icons/MdiTwitch";
import { Card, CardContent } from "@/components/ui/card";

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

  // Fetch current Twitch status
  const fetchTwitchStatus = async () => {
    try {
      const token = sessionTokens?.accessToken;
      if (!token) {
        // Not authenticated locally — Twitch cannot be linked
        setTwitchStatus({ linked: false });
        return;
      }

      const response = await fetch(`${API_ENDPOINT}/auth/twitch/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const status = await response.json();
        console.log('Fetched Twitch status:', status);
        setTwitchStatus(status);
      } else {
        console.error('Failed to fetch Twitch status');
        setTwitchStatus({ linked: false });
      }
    } catch (error) {
      console.error('Error fetching Twitch status:', error);
      setTwitchStatus({ linked: false });
    }
  };

  // Start Twitch OAuth flow
  const handleLinkTwitch = async () => {
    setLoading(true);
    try {
      await invoke('start_twitch_auth');
      toast.success('Twitch authorization started. Please complete the process in your browser.');

      // Poll for completion or listen for events
      // The Rust backend will emit events when the linking is complete
    } catch (error) {
      console.error('Error starting Twitch auth:', error);
      toast.error('Failed to start Twitch authorization');
    } finally {
      setLoading(false);
    }
  };

  // Unlink Twitch account
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
        toast.success('Tu cuenta de Twitch ha sido desvinculada con éxito');
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'No se pudo desvincular la cuenta de Twitch');
      }
    } catch (error) {
      console.error('Error unlinking Twitch:', error);
      toast.error('No se pudo desvincular la cuenta de Twitch');
    } finally {
      setUnlinking(false);
    }
  };
  useEffect(() => {
    fetchTwitchStatus();

    // Listen for Twitch auth success events
    const handleTwitchAuthSuccess = () => {
      toast.success('Twitch account linked successfully!');
      fetchTwitchStatus(); // Refresh status
    };

    // listen returns a Promise<UnlistenFn>, keep the promise and call the returned unlisten function in cleanup
    const unlistenPromise = listen('twitch-auth-success', handleTwitchAuthSuccess);

    // Add event listener for Twitch auth events (you might need to adjust this based on your event system)

    return () => {
      unlistenPromise
        .then((unlisten) => {
          try {
            unlisten();
          } catch (err) {
            console.error('Error during unlisten:', err);
          }
        })
        .catch((err) => {
          console.error('Failed to subscribe/listen to twitch-auth-success event:', err);
        });
    };
    // Re-run when tokens change so component reflects current authenticated user
  }, [sessionTokens]);

  if (!twitchStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <MdiTwitch className="text-[#9146FF]" />
            <h3 className="text-lg font-semibold text-white">Integración de Twitch</h3>
          </div>
          <div className="text-neutral-400">Cargando estado de Twitch...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MdiTwitch className="text-[#9146FF]" />
          <h3 className="text-lg font-semibold text-white">Integración de Twitch</h3>
        </div>

        {twitchStatus.linked ? (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-green-400 font-medium">Conectado</span>
            </div>

            {twitchStatus.twitchId && (
              <div className="text-sm text-muted-foreground mb-4">
                ID de Twitch: {twitchStatus.twitchId} ({twitchStatus.twitchUsername || 'unknown'})
              </div>
            )}

            <p className="text-neutral-300 text-sm mb-4">
              Tu cuenta de Twitch está conectada. Ahora puedes acceder a modpacks exclusivos para suscriptores de los creadores a los que estés suscrito.
            </p>

            <Button
              onClick={handleUnlinkTwitch}
              disabled={unlinking}
              variant="destructive"
              size="sm"
              className="flex items-center space-x-2"
            >
              <LucideUnlink size={16} />
              <span>{unlinking ? 'Desvinculando...' : 'Desvincular Twitch'}</span>
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-neutral-500 rounded-full"></div>
              <span className="text-neutral-400 font-medium">No conectado</span>
            </div>

            <p className="text-neutral-300 text-sm mb-4">
              Vincula tu cuenta de Twitch para acceder a modpacks exclusivos para suscriptores de tus creadores favoritos.
            </p>

            <div className="space-y-2 mb-4">
              <div className="text-xs text-neutral-400">Beneficios de vincular tu cuenta de Twitch:</div>
              <ul className="text-xs text-neutral-300 space-y-1 ml-4">
                <li>• Acceder a modpacks solo para suscriptores</li>
                <li>• Apoyar a tus creadores favoritos</li>
                <li>• Contenido exclusivo y acceso anticipado</li>
              </ul>
            </div>

            <Button
              onClick={handleLinkTwitch}
              disabled={loading}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700"
              size="sm"
            >
              <LucideExternalLink size={16} />
              <span>{loading ? 'Conectando...' : 'Vincular cuenta de Twitch'}</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};