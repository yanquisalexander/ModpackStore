import { LucideTwitch, LucideExternalLink, LucideLock, LucideCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuthentication } from '@/stores/AuthContext';
import { MdiTwitch } from "@/icons/MdiTwitch";
import { API_ENDPOINT } from "@/consts";

interface TwitchRequirementsProps {
  requiresTwitchSubscription: boolean;
  requiredTwitchChannels: string[];
  userHasTwitchLinked: boolean;
  modpackId: string; // Agregado para verificar acceso
  className?: string;
}

interface ChannelInfo {
  id: string;
  username: string;
  displayName: string;
  isSubscribed?: boolean;
}

// Hook personalizado para obtener información de canales de Twitch
const useTwitchChannelInfo = (channelIds: string[], userCanAccess: boolean | undefined, userHasTwitchLinked: boolean) => {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { session, sessionTokens } = useAuthentication();

  useEffect(() => {
    const fetchChannelInfo = async () => {
      console.log('Fetching channel info for:', channelIds);
      if (!channelIds.length) return;

      setLoading(true);
      try {
        // First, get basic channel information
        const channelResponse = await fetch(`${API_ENDPOINT}/explore/twitch-channels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channelIds }),
        });

        if (!channelResponse.ok) {
          throw new Error('Failed to fetch channel info');
        }

        const channelData = await channelResponse.json();
        let channelsWithSubscription: ChannelInfo[] = channelData.data.map((channel: any) => ({
          ...channel,
          isSubscribed: false
        }));

        // If user has Twitch linked, check specific subscriptions
        if (userHasTwitchLinked && session && sessionTokens) {
          try {
            const subscriptionResponse = await fetch(`${API_ENDPOINT}/explore/user-twitch-subscriptions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionTokens.accessToken}`,
              },
              body: JSON.stringify({ channelIds }),
            });

            if (subscriptionResponse.ok) {
              const subscriptionData = await subscriptionResponse.json();
              const subscribedChannelIds = subscriptionData.subscribedChannels.map((ch: any) => ch.id);

              channelsWithSubscription = channelsWithSubscription.map((channel: ChannelInfo) => ({
                ...channel,
                isSubscribed: subscribedChannelIds.includes(channel.id)
              }));
            }
          } catch (error) {
            console.log('Could not fetch subscription details:', error);
            // Keep the default assumption that if user has access, they're subscribed to all
            channelsWithSubscription = channelsWithSubscription.map((channel: ChannelInfo) => ({
              ...channel,
              isSubscribed: userCanAccess || false
            }));
          }
        }

        setChannels(channelsWithSubscription);
      } catch (error) {
        console.error('Error fetching channel info:', error);
        // Fallback: usar los IDs como nombres
        const fallbackData: ChannelInfo[] = channelIds.map(id => ({
          id,
          username: id,
          displayName: id,
          isSubscribed: false
        }));
        setChannels(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchChannelInfo();
  }, [channelIds, userCanAccess, userHasTwitchLinked, session, sessionTokens]);

  return { channels, loading };
};

// Función para formatear lista de canales manualmente (compatible con navegadores antiguos)
const formatChannelList = (channels: ChannelInfo[]): string => {
  const subscribedChannels = channels.filter(c => c.isSubscribed);
  if (subscribedChannels.length === 0) return '';

  const channelNames = subscribedChannels.map(c => c.displayName);

  if (channelNames.length === 1) {
    return channelNames[0];
  }

  if (channelNames.length === 2) {
    return `${channelNames[0]} y ${channelNames[1]}`;
  }

  // Para más de 2 canales
  const allButLast = channelNames.slice(0, -1).join(', ');
  const last = channelNames[channelNames.length - 1];
  return `${allButLast} y ${last}`;
};

// Hook personalizado para verificar el acceso del usuario a un modpack
const useModpackAccess = (modpackId: string, requiresTwitchSubscription: boolean) => {
  const [accessState, setAccessState] = useState<{
    canAccess: boolean;
    loading: boolean;
    reason?: string;
    requiredChannels?: string[];
  }>({
    canAccess: false,
    loading: true
  });
  const { session, sessionTokens } = useAuthentication();

  useEffect(() => {
    // Si no requiere suscripción de Twitch, el acceso es automático
    if (!requiresTwitchSubscription) {
      setAccessState({
        canAccess: true,
        loading: false
      });
      return;
    }

    const checkAccess = async () => {
      try {
        const response = await fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/check-access`, {
          method: 'GET',
          headers: sessionTokens ? {
            'Authorization': `Bearer ${sessionTokens.accessToken}`,
          } : {},
        });

        if (!response.ok) {
          throw new Error('Failed to check access');
        }

        const data = await response.json();
        setAccessState({
          canAccess: data.canAccess,
          loading: false,
          reason: data.reason,
          requiredChannels: data.requiredChannels
        });
      } catch (error) {
        console.error('Error checking modpack access:', error);
        // En caso de error, asumimos que no tiene acceso
        setAccessState({
          canAccess: false,
          loading: false,
          reason: 'Error checking access'
        });
      }
    };

    checkAccess();
  }, [modpackId, requiresTwitchSubscription, session, sessionTokens]);

  return accessState;
};

export const TwitchRequirements = ({
  requiresTwitchSubscription,
  requiredTwitchChannels,
  userHasTwitchLinked,
  modpackId,
  className = ""
}: TwitchRequirementsProps) => {
  const navigate = useNavigate();

  // Usar el hook para verificar acceso
  const { canAccess: userCanAccess, loading: accessLoading } = useModpackAccess(modpackId, requiresTwitchSubscription);

  const { channels } = useTwitchChannelInfo(requiredTwitchChannels, userCanAccess, userHasTwitchLinked);

  if (!requiresTwitchSubscription) {
    return null;
  }

  // Mostrar loading mientras se verifica el acceso
  if (accessLoading) {
    return (
      <div className={`bg-purple-900/20 border border-purple-700/30 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <LucideTwitch size={16} className="text-white" />
          </div>
          <div className="text-sm text-purple-200">
            Verificando acceso...
          </div>
        </div>
      </div>
    );
  }

  const handleLinkTwitch = () => {
    navigate('/profile');
  };

  const getChannelUrl = (channelIdOrUsername: string) => {
    return `https://www.twitch.tv/${channelIdOrUsername}/subs`;
  };

  const subscribedChannelsText = formatChannelList(channels);

  return (
    <div className={`bg-purple-900/20 border border-purple-700/30 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <MdiTwitch className="text-white" />
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <LucideLock size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-300">
              Solo para Suscriptores de Twitch
            </h3>
          </div>

          {userCanAccess ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-green-400">
                <LucideCheck size={16} />
                <span>Tienes acceso a este modpack</span>
              </div>
              {subscribedChannelsText && (
                <div className="text-sm text-green-300">
                  Gracias a tu suscripción a {subscribedChannelsText}
                </div>
              )}
            </div>
          ) : (
            <div>
              {!userHasTwitchLinked ? (
                <div className="text-sm text-purple-200 mb-3">
                  Vincula tu cuenta de Twitch para acceder a este modpack exclusivo para suscriptores.
                </div>
              ) : (
                <div className="text-sm text-purple-200 mb-3">
                  Necesitas estar suscrito a al menos uno de los siguientes canales para acceder a este modpack: {channels.map(c => c.displayName || c.username || c.id).join(', ')}.
                </div>
              )}
            </div>
          )}

          {channels.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-purple-300 mb-2">
                {userCanAccess ? 'Canales suscritos:' : 'Suscripciones requeridas:'}
              </div>
              <div className="space-y-1">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      {channel.isSubscribed && userCanAccess && (
                        <LucideCheck size={14} className="text-green-400" />
                      )}
                      <span className={`${channel.isSubscribed && userCanAccess
                        ? 'text-green-300'
                        : 'text-purple-200'
                        }`}>
                        {channel.displayName || channel.username || channel.id}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-400 hover:text-purple-300 h-auto p-1"
                      onClick={() => window.open(getChannelUrl(channel.username || channel.id), '_blank')}
                    >
                      <LucideExternalLink size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!userCanAccess && (
            <div className="flex flex-wrap gap-2">
              {!userHasTwitchLinked && (
                <Button
                  onClick={handleLinkTwitch}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Vincular Cuenta de Twitch
                </Button>
              )}

              {channels.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
                  onClick={() => {
                    if (channels.length === 1) {
                      window.open(getChannelUrl(channels[0].username), '_blank');
                    } else {
                      // Abrir el primer canal si hay múltiples
                      window.open(getChannelUrl(channels[0].username), '_blank');
                    }
                  }}
                >
                  Suscribirse en Twitch
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};