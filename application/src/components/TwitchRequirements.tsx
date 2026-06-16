import { LucideExternalLink, LucideLock, LucideCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useAuthentication } from '@/stores/AuthContext';
import { MdiTwitch } from "@/icons/MdiTwitch";
import { API_ENDPOINT } from "@/consts";

interface ChannelInfo {
  id: string;
  username: string;
  displayName: string;
}

interface TwitchRequirementsProps {
  requiresTwitchSubscription: boolean;
  requiredTwitchChannels: ChannelInfo[];
  userHasTwitchLinked: boolean;
  modpackId: string;
  className?: string;
}

const useModpackAccess = (modpackId: string, requiresTwitchSubscription: boolean) => {
  const [accessState, setAccessState] = useState<{
    canAccess: boolean;
    loading: boolean;
  }>({
    canAccess: false,
    loading: true,
  });
  const { session, sessionTokens } = useAuthentication();

  useEffect(() => {
    if (!requiresTwitchSubscription) {
      setAccessState({ canAccess: true, loading: false });
      return;
    }

    const checkAccess = async () => {
      try {
        const [accessRes, acqRes] = await Promise.all([
          fetch(`${API_ENDPOINT}/explore/modpacks/${modpackId}/access`, {
            headers: sessionTokens ? { 'Authorization': `Bearer ${sessionTokens.accessToken}` } : {},
          }),
          sessionTokens
            ? fetch(`${API_ENDPOINT}/explore/user/acquisitions`, {
                headers: { 'Authorization': `Bearer ${sessionTokens.accessToken}` },
              })
            : Promise.resolve(null),
        ]);

        if (acqRes && acqRes.ok) {
          const acqJson = await acqRes.json();
          const acquisitions = acqJson.data || [];
          const hasAccess = acquisitions.some(
            (a: any) => a.acquisition?.modpackId === modpackId && a.acquisition?.status === 'active',
          );
          setAccessState({ canAccess: hasAccess, loading: false });
        } else {
          setAccessState({ canAccess: false, loading: false });
        }
      } catch (error) {
        console.error('Error checking modpack access:', error);
        setAccessState({ canAccess: false, loading: false });
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
  className = "",
}: TwitchRequirementsProps) => {
  const { canAccess: userCanAccess, loading: accessLoading } = useModpackAccess(modpackId, requiresTwitchSubscription);

  if (!requiresTwitchSubscription) return null;

  if (accessLoading) {
    return (
      <div className={`bg-purple-900/20 border border-purple-700/30 rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <MdiTwitch className="text-white" />
          </div>
          <div className="text-sm text-purple-200">Verificando acceso...</div>
        </div>
      </div>
    );
  }

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
            <h3 className="text-sm font-semibold text-purple-300">Solo para Suscriptores de Twitch</h3>
          </div>

          {userCanAccess ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-green-400">
                <LucideCheck size={16} />
                <span>Tienes acceso a este modpack</span>
              </div>
            </div>
          ) : (
            <div>
              {!userHasTwitchLinked ? (
                <div className="text-sm text-purple-200 mb-3">
                  Vincula tu cuenta de Twitch para acceder a este modpack exclusivo para suscriptores.
                </div>
              ) : (
                <div className="text-sm text-purple-200 mb-3">
                  Necesitas estar suscrito a al menos uno de los siguientes canales para acceder a este modpack:{' '}
                  {requiredTwitchChannels.map((c) => c.displayName || c.username || c.id).join(', ')}.
                </div>
              )}
            </div>
          )}

          {requiredTwitchChannels.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-purple-300 mb-2">Canales requeridos:</div>
              <div className="space-y-1">
                {requiredTwitchChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between text-sm">
                    <span className="text-purple-200">{channel.displayName || channel.username || channel.id}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-400 hover:text-purple-300 h-auto p-1"
                      onClick={() => window.open(`https://www.twitch.tv/${channel.username || channel.id}/subs`, '_blank')}
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
                  onClick={() => window.location.href = '/profile'}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Vincular Cuenta de Twitch
                </Button>
              )}
              {requiredTwitchChannels.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-purple-600 text-purple-400 hover:bg-purple-600/10"
                  onClick={() => window.open(
                    `https://www.twitch.tv/${requiredTwitchChannels[0].username || requiredTwitchChannels[0].id}/subs`,
                    '_blank',
                  )}
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